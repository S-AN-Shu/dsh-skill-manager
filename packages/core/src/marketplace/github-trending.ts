import {
  MarketplaceSourceError,
  type MarketplaceFetch,
  type RepositoryCandidate,
  type RepositoryKey,
  type RepositoryQueryResult,
  type RepositorySort
} from "./types.js";
import { classifySkill } from "./skill-classification.js";

const GITHUB_ROOT = "https://github.com";
// Trending uses two HTML requests in parallel, and Windows proxy/TLS setup can
// exceed the old 12-second bound. Keep the request cancellable while matching
// the repository discovery deadline used by the Host.
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TRENDING_ITEMS = 25;
const FRESH_CACHE_MS = 30 * 60 * 1000;
const STALE_CACHE_MS = 24 * 60 * 60 * 1000;
const SKILL_SIGNAL = /(?:^|[^a-z])(skill|skills|agent|claude|codex|opencode|prompt|mcp)(?:$|[^a-z])/iu;

export type GitHubTrendingPeriod = "weekly" | "monthly";

export interface GitHubTrendingDiscoveryOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  token?: string;
  now?: () => Date;
  cacheTtlMs?: number;
  staleTtlMs?: number;
}

export interface GitHubTrendingDiscovery {
  browseTrending(request: {
    period: GitHubTrendingPeriod;
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<RepositoryQueryResult>;
}

export interface ParsedTrendingRepository {
  owner: string;
  name: string;
  description: string | null;
  stars: number | null;
  weeklyStars: number | null;
  monthlyStars: number | null;
}

interface Snapshot {
  period: GitHubTrendingPeriod;
  observedAt: string;
  candidates: RepositoryCandidate[];
  state: "live" | "cached" | "empty" | "unavailable";
  message: string | null;
}

interface CacheEntry {
  storedAt: number;
  snapshot: Snapshot;
}

export function createGitHubTrendingDiscovery(
  options: GitHubTrendingDiscoveryOptions = {}
): GitHubTrendingDiscovery {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceSourceError("MARKETPLACE_FETCH_FAILED", "This runtime does not provide fetch.");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceSourceError("INVALID_MARKETPLACE_TIMEOUT", "Trending timeout must be a positive integer in milliseconds.");
  }
  const now = options.now ?? (() => new Date());
  const cacheTtlMs = options.cacheTtlMs ?? FRESH_CACHE_MS;
  const staleTtlMs = options.staleTtlMs ?? STALE_CACHE_MS;
  const cache = new Map<GitHubTrendingPeriod, CacheEntry>();

  return {
    browseTrending(request) {
      const page = normalizePage(request.page);
      const limit = normalizeLimit(request.limit);
      if (page !== 1) {
        throw new MarketplaceSourceError("INVALID_MARKETPLACE_LIMIT", "GitHub Trending only provides one bounded page.");
      }
      return loadTrending({
        fetch, now, timeoutMs, cache, cacheTtlMs, staleTtlMs,
        period: request.period,
        limit,
        ...(request.signal === undefined ? {} : { signal: request.signal })
      });
    }
  };
}

export function parseGitHubTrendingHtml(
  html: string,
  period: GitHubTrendingPeriod
): ParsedTrendingRepository[] {
  if (typeof html !== "string" || html.length === 0 || html.length > MAX_HTML_BYTES) return [];
  const entries: ParsedTrendingRepository[] = [];
  const articles = html.match(/<article\b[^>]*class=["'][^"']*\bBox-row\b[^"']*["'][^>]*>[\s\S]*?<\/article>/giu) ?? [];
  for (const article of articles.slice(0, MAX_TRENDING_ITEMS)) {
    const repository = parseRepositorySlug(article);
    if (repository === null) continue;
    const description = cleanText(article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/iu)?.[1] ?? "") || null;
    const weeklyStars = parseMetric(article, "week");
    const monthlyStars = parseMetric(article, "month");
    const metric = period === "weekly" ? weeklyStars : monthlyStars;
    if (metric === null || !SKILL_SIGNAL.test(`${repository.owner}/${repository.name} ${description ?? ""}`)) continue;
    entries.push({
      ...repository,
      description,
      stars: parseTotalStars(article, repository),
      weeklyStars,
      monthlyStars
    });
  }
  return dedupeTrending(entries);
}

async function loadTrending(options: {
  fetch: MarketplaceFetch;
  now: () => Date;
  timeoutMs: number;
  cache: Map<GitHubTrendingPeriod, CacheEntry>;
  cacheTtlMs: number;
  staleTtlMs: number;
  period: GitHubTrendingPeriod;
  limit: number;
  signal?: AbortSignal;
}): Promise<RepositoryQueryResult> {
  const [weekly, monthly] = await Promise.all([
    loadPeriod(options, "weekly"),
    loadPeriod(options, "monthly")
  ]);
  const requested = options.period === "weekly" ? weekly : monthly;
  const merged = mergeSnapshots(weekly, monthly, options.period)
    .sort((left, right) => compareTrend(left, right, options.period))
    .slice(0, options.limit);
  const state = requested.snapshot.state;
  const message = requested.snapshot.message
    ?? (state === "cached" ? "GitHub Trending 暂时不可用，正在显示缓存数据。" : null);
  return {
    source: "github",
    query: null,
    sort: options.period === "weekly" ? "trend-weekly" : "trend-monthly",
    page: 1,
    returnedCount: merged.length,
    total: merged.length,
    hasMore: false,
    incomplete: state === "unavailable",
    dataUpdatedAt: requested.snapshot.observedAt,
    sourceState: state === "cached" ? "cached" : state === "unavailable" ? "unavailable" : state,
    sourceMessage: message,
    repositories: merged
  };
}

async function loadPeriod(
  options: Parameters<typeof loadTrending>[0],
  period: GitHubTrendingPeriod
): Promise<{ snapshot: Snapshot; stale: boolean }> {
  const current = options.cache.get(period);
  const nowMs = options.now().getTime();
  const age = current === undefined ? Number.POSITIVE_INFINITY : nowMs - current.storedAt;
  if (current !== undefined && age <= options.cacheTtlMs) return { snapshot: current.snapshot, stale: false };
  try {
    const snapshot = await fetchPeriod(options, period);
    options.cache.set(period, { storedAt: options.now().getTime(), snapshot });
    return { snapshot, stale: false };
  } catch (error) {
    if (current !== undefined && age <= options.staleTtlMs) {
      return {
        snapshot: {
          ...current.snapshot,
          state: "cached",
          message: error instanceof Error ? error.message : "GitHub Trending 请求失败。"
        },
        stale: true
      };
    }
    return {
      snapshot: {
        period,
        observedAt: options.now().toISOString(),
        candidates: [],
        state: "unavailable",
        message: error instanceof Error ? error.message : "GitHub Trending 暂时不可用。"
      },
      stale: false
    };
  }
}

async function fetchPeriod(
  options: Parameters<typeof loadTrending>[0],
  period: GitHubTrendingPeriod
): Promise<Snapshot> {
  const html = await fetchText(options.fetch, `${GITHUB_ROOT}/trending?since=${period}`, options.timeoutMs, options.signal, {
    accept: "text/html",
    "user-agent": "dsh-skill-manager"
  });
  const parsed = parseGitHubTrendingHtml(html, period);
  if (parsed.length === 0) {
    return {
      period,
      observedAt: options.now().toISOString(),
      candidates: [],
      state: "empty",
      message: "GitHub Trending 当前没有可识别的 Skill 候选。"
    };
  }
  const observedAt = options.now().toISOString();
  const resolved = parsed.map((entry) => trendingCandidate(entry, observedAt));
  return {
    period,
    observedAt,
    candidates: resolved,
    state: "live",
    message: "近期热度只覆盖 GitHub Trending 全站榜单中的 Skill 候选；列表阶段不消耗 GitHub REST 配额。"
  };
}

function trendingCandidate(
  entry: ParsedTrendingRepository,
  observedAt: string
): RepositoryCandidate {
  const fullName = `${entry.owner}/${entry.name}`;
  const repoKey = `github:${fullName}` as RepositoryKey;
  return {
    repositoryId: 0,
    nodeId: `trending:${fullName}`,
    repoKey,
    host: "github",
    owner: entry.owner,
    ownerId: 0,
    ownerType: "User",
    ownerAvatar: { type: "generated", seed: `owner:${entry.owner}` },
    name: entry.name,
    fullName,
    description: entry.description,
    url: `${GITHUB_ROOT}/${fullName}`,
    defaultBranch: "HEAD",
    stars: entry.stars ?? 0,
    forks: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: observedAt,
    pushedAt: observedAt,
    topics: [],
    formatTopics: [],
    categoryTopics: [],
    archived: false,
    license: null,
    knownSkillCount: null,
    classification: classifySkill({ name: entry.name, description: entry.description, topics: [] }),
    trend: {
      weeklyStars: entry.weeklyStars,
      monthlyStars: entry.monthlyStars,
      observedAt,
      source: "github-trending-html",
      stale: false
    },
    cover: { type: "generated", seed: repoKey },
    discovery: {
      signals: [{ source: "github", kind: "metadata", label: "GitHub Trending HTML 候选" }],
      discoveredAt: observedAt
    }
  };
}

function mergeSnapshots(
  weekly: { snapshot: Snapshot; stale: boolean },
  monthly: { snapshot: Snapshot; stale: boolean },
  requested: GitHubTrendingPeriod
): RepositoryCandidate[] {
  const byKey = new Map<string, RepositoryCandidate>();
  for (const candidate of [...weekly.snapshot.candidates, ...monthly.snapshot.candidates]) {
    const existing = byKey.get(candidate.repoKey);
    if (existing === undefined) {
      byKey.set(candidate.repoKey, { ...candidate, trend: candidate.trend === null ? null : { ...candidate.trend } });
      continue;
    }
    const existingTrend = existing.trend;
    const candidateTrend = candidate.trend;
    existing.trend = {
      weeklyStars: candidateTrend?.weeklyStars ?? existingTrend?.weeklyStars ?? null,
      monthlyStars: candidateTrend?.monthlyStars ?? existingTrend?.monthlyStars ?? null,
      observedAt: candidateTrend?.observedAt ?? existingTrend?.observedAt ?? new Date(0).toISOString(),
      source: "github-trending-html",
      stale: weekly.stale || monthly.stale
    };
  }
  return [...byKey.values()].filter((candidate) => {
    const metric = requested === "weekly" ? candidate.trend?.weeklyStars : candidate.trend?.monthlyStars;
    if (metric !== null && metric !== undefined) return true;
    return requested === "monthly"
      && candidate.trend?.weeklyStars !== null
      && candidate.trend?.weeklyStars !== undefined;
  }).map((candidate) => candidate.trend === null ? candidate : {
    ...candidate,
    trend: { ...candidate.trend, stale: weekly.stale || monthly.stale }
  });
}

function compareTrend(left: RepositoryCandidate, right: RepositoryCandidate, period: GitHubTrendingPeriod): number {
  const leftMetric = period === "weekly" ? left.trend?.weeklyStars ?? -1 : left.trend?.monthlyStars ?? -1;
  const rightMetric = period === "weekly" ? right.trend?.weeklyStars ?? -1 : right.trend?.monthlyStars ?? -1;
  const primary = rightMetric - leftMetric;
  if (primary !== 0) return primary;
  const weekly = (right.trend?.weeklyStars ?? -1) - (left.trend?.weeklyStars ?? -1);
  return weekly || right.stars - left.stars || left.fullName.localeCompare(right.fullName);
}

function parseRepositorySlug(article: string): { owner: string; name: string } | null {
  const matches = [...article.matchAll(/href=["']\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)["']/giu)];
  const match = matches.find((candidate) => candidate[1] !== "sponsors" && candidate[1] !== "trending");
  if (match === undefined) return null;
  const owner = match[1];
  const name = match[2];
  return owner === undefined || name === undefined ? null : { owner, name };
}

function parseMetric(article: string, unit: "week" | "month"): number | null {
  const match = article.match(new RegExp(`([0-9][0-9,]*)\\s+stars this ${unit}`, "iu"));
  return match === null || match[1] === undefined ? null : Number.parseInt(match[1].replace(/,/gu, ""), 10);
}

function parseTotalStars(
  article: string,
  repository: { owner: string; name: string }
): number | null {
  const path = `/${repository.owner}/${repository.name}/stargazers`
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = article.match(new RegExp(`href=["']${path}["'][^>]*>([\\s\\S]*?)<\\/a>`, "iu"));
  if (match?.[1] === undefined) return null;
  const metric = cleanText(match[1]).match(/[0-9][0-9,]*/u)?.[0];
  return metric === undefined ? null : Number.parseInt(metric.replace(/,/gu, ""), 10);
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim());
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">");
}

async function fetchText(
  fetch: MarketplaceFetch,
  url: string,
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  headers: Record<string, string>
): Promise<string> {
  const response = await fetchWithDeadline(fetch, url, timeoutMs, callerSignal, { headers });
  if (!response.ok) throw new MarketplaceSourceError("MARKETPLACE_HTTP_ERROR", `GitHub Trending failed with HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > MAX_HTML_BYTES) throw new MarketplaceSourceError("INVALID_MARKETPLACE_RESPONSE", "GitHub Trending response was too large.");
  return text;
}

async function fetchWithDeadline(
  fetch: MarketplaceFetch,
  url: string,
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (callerSignal?.aborted) throw new MarketplaceSourceError("MARKETPLACE_ABORTED", "GitHub Trending request was cancelled.", { cause: error });
    if (timedOut) throw new MarketplaceSourceError("MARKETPLACE_TIMEOUT", `GitHub Trending exceeded ${timeoutMs} ms.`, { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancel);
  }
}

function dedupeTrending(entries: ParsedTrendingRepository[]): ParsedTrendingRepository[] {
  const byKey = new Map<string, ParsedTrendingRepository>();
  for (const entry of entries) {
    const key = `${entry.owner}/${entry.name}`.toLocaleLowerCase();
    const existing = byKey.get(key);
    byKey.set(key, existing === undefined ? entry : {
      ...existing,
      weeklyStars: entry.weeklyStars ?? existing.weeklyStars,
      monthlyStars: entry.monthlyStars ?? existing.monthlyStars
    });
  }
  return [...byKey.values()];
}

function normalizePage(value: number | undefined): number {
  const page = value ?? 1;
  if (!Number.isInteger(page) || page < 1) throw new MarketplaceSourceError("INVALID_MARKETPLACE_LIMIT", "Trending page must be a positive integer.");
  return page;
}

function normalizeLimit(value: number | undefined): number {
  const limit = value ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new MarketplaceSourceError("INVALID_MARKETPLACE_LIMIT", "Trending result limit must be an integer from 1 to 25.");
  return limit;
}
