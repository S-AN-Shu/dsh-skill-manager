import {
  MarketplaceSourceError,
  type DiscoveryProvider,
  type DiscoverySignal,
  type MarketplaceFetch,
  type RepositoryCandidate,
  type RepositoryQueryRequest,
  type RepositoryQueryResult,
  type RepositorySort
} from "./types.js";
import type { GitHubTrendingDiscovery } from "./github-trending.js";
import { classifySkill } from "./skill-classification.js";

const GITHUB_API_ROOT = "https://api.github.com";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 25_000;
const FORMAT_TOPICS = new Set([
  "agent-skills",
  "agent-skill",
  "claude-skills",
  "codex-skills",
  "ai-agent-skills"
]);
const CATEGORY_TOPICS = new Set([
  "coding", "software-engineering", "developer-tooling", "automation", "agent-orchestration", "prompting",
  "data", "databases",
  "security",
  "design", "diagramming", "presentations",
  "research",
  "writing", "docs", "media",
  "game-development",
  "data-analysis", "productivity", "business", "product", "marketing", "sales", "finance", "blockchain",
  "healthcare", "lifestyle", "skill-creation", "skill-management", "testing", "devops", "mobile"
]);
const BROWSE_QUERY = [...FORMAT_TOPICS].map((topic) => `${topic} in:topics`).join(" OR ");
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;

export interface GitHubRepositoryDiscoveryOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  token?: string;
  now?: () => Date;
  trending?: GitHubTrendingDiscovery;
}

export function createGitHubRepositoryDiscovery(
  options: GitHubRepositoryDiscoveryOptions = {}
): DiscoveryProvider {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_TIMEOUT",
      "Repository discovery timeout must be a positive integer in milliseconds."
    );
  }
  const token = normalizeToken(options.token);
  const now = options.now ?? (() => new Date());
  const trending = options.trending;

  return {
    searchRepositories(request) {
      if (isTrendingSort(request.sort)) {
        return requireTrending(trending, request.sort, request);
      }
      const query = normalizeSearchQuery(request.query);
      return queryRepositories(fetch, request, timeoutMs, token, now, query);
    },
    browseRepositories(request = {}) {
      if (isTrendingSort(request.sort)) {
        return requireTrending(trending, request.sort, request);
      }
      return queryRepositories(fetch, request, timeoutMs, token, now, null);
    }
  };
}

async function queryRepositories(
  fetch: MarketplaceFetch,
  request: RepositoryQueryRequest,
  timeoutMs: number,
  token: string | undefined,
  now: () => Date,
  query: string | null
): Promise<RepositoryQueryResult> {
  const page = normalizePage(request.page);
  const limit = normalizeLimit(request.limit);
  const sort = normalizeSort(request.sort, query);
  return withDeadline(request.signal, timeoutMs, async (signal) => {
    const url = new URL(`${GITHUB_API_ROOT}/search/repositories`);
    const searchQuery = query === null ? BROWSE_QUERY : `${query} in:name,description,topics`;
    if (sort === "latest") {
      const cutoff = new Date(now().getTime() - 60 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
      url.searchParams.set("q", `created:>=${cutoff} ${searchQuery}`);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
    } else {
      url.searchParams.set("q", searchQuery);
    }
    if (sort === "popular") {
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
    }
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(limit));

    const response = await fetch(url, requestInit(signal, token));
    assertResponse(response);
    const payload = await parseJson(response);
    if (!isRecord(payload) || !Array.isArray(payload.items)
      || typeof payload.total_count !== "number"
      || typeof payload.incomplete_results !== "boolean") {
      invalidResponse("GitHub repository search returned an unsupported response shape.");
    }
    const discoveredAt = now().toISOString();
    const repositories = payload.items.map((item) => parseGitHubRepositoryPayload(item, query, discoveredAt));
    return {
      source: "github",
      query,
      sort,
      page,
      returnedCount: repositories.length,
      total: Math.min(Math.max(0, Math.trunc(payload.total_count)), 1_000),
      hasMore: page * limit < Math.min(Math.max(0, Math.trunc(payload.total_count)), 1_000),
      incomplete: payload.incomplete_results,
      dataUpdatedAt: discoveredAt,
      sourceState: "live",
      sourceMessage: null,
      repositories
    };
  });
}

export function parseGitHubRepositoryPayload(value: unknown, query: string | null, discoveredAt: string): RepositoryCandidate {
  if (!isRecord(value) || !isRecord(value.owner)) invalidResponse("GitHub returned an invalid repository.");
  const repositoryId = readInteger(value.id);
  const nodeId = readString(value.node_id);
  const owner = readString(value.owner.login);
  const ownerId = readInteger(value.owner.id);
  const ownerType = readOwnerType(value.owner.type);
  const name = readString(value.name);
  const fullName = readString(value.full_name);
  const url = readHttpsUrl(value.html_url);
  const defaultBranch = readString(value.default_branch);
  const stars = readInteger(value.stargazers_count);
  const forks = readInteger(value.forks_count);
  const createdAt = readDate(value.created_at);
  const updatedAt = readDate(value.updated_at);
  const pushedAt = readDate(value.pushed_at);
  const topics = Array.isArray(value.topics)
    ? value.topics.map(readString).filter((topic): topic is string => topic !== undefined)
    : [];
  const archived = typeof value.archived === "boolean" ? value.archived : undefined;
  const license = value.license === null
    ? null
    : isRecord(value.license) ? readString(value.license.spdx_id) ?? null : null;
  const description = value.description === null || typeof value.description === "string"
    ? value.description
    : undefined;
  if (
    repositoryId === undefined || nodeId === undefined || ownerId === undefined || owner === undefined || ownerType === undefined
    || name === undefined || fullName !== `${owner}/${name}` || url !== `https://github.com/${owner}/${name}`
    || defaultBranch === undefined || stars === undefined || forks === undefined || createdAt === undefined
    || updatedAt === undefined || pushedAt === undefined || archived === undefined || description === undefined
    || !REPOSITORY_PART.test(owner) || !REPOSITORY_PART.test(name)
  ) invalidResponse("GitHub returned an invalid repository.");

  const normalizedTopics = [...new Set(topics.map((topic) => topic.toLocaleLowerCase()))].sort();
  const formatTopics = normalizedTopics.filter((topic) => FORMAT_TOPICS.has(topic));
  const categoryTopics = normalizedTopics.filter((topic) => CATEGORY_TOPICS.has(topic));
  const signals: DiscoverySignal[] = formatTopics.map((topic) => ({
    source: "github",
    kind: "format-topic",
    label: `Topic: ${topic}`
  }));
  if (query !== null) {
    signals.push({ source: "github", kind: "ordinary-search", label: `搜索: ${query}` });
  } else if (formatTopics.length === 0) {
    signals.push({ source: "github", kind: "metadata", label: "GitHub 仓库元数据" });
  }
  const repoKey = `github:${fullName}` as RepositoryCandidate["repoKey"];
  return {
    repositoryId,
    nodeId,
    repoKey,
    host: "github",
    owner,
    ownerType,
    ownerId,
    ownerAvatar: { type: "github-avatar", owner, accountId: ownerId },
    name,
    fullName,
    description,
    url,
    defaultBranch,
    stars,
    forks,
    createdAt,
    updatedAt,
    pushedAt,
    topics: normalizedTopics,
    formatTopics,
    categoryTopics,
    archived,
    license,
    knownSkillCount: null,
    classification: classifySkill({ name, description, topics: normalizedTopics }),
    trend: null,
    cover: { type: "generated", seed: repoKey },
    discovery: { signals, discoveredAt }
  };
}

async function withDeadline<T>(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (callerSignal?.aborted) aborted();
  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;
  let rejectBoundary: (error: MarketplaceSourceError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => { rejectBoundary = reject; });
  const cancel = () => {
    callerAborted = true;
    controller.abort(callerSignal?.reason);
    rejectBoundary(new MarketplaceSourceError("MARKETPLACE_ABORTED", "Repository discovery was cancelled."));
  };
  callerSignal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectBoundary(new MarketplaceSourceError(
      "MARKETPLACE_TIMEOUT",
      `Repository discovery exceeded ${timeoutMs} ms.`
    ));
  }, timeoutMs);
  try {
    return await Promise.race([operation(controller.signal), boundary]);
  } catch (error) {
    if (timedOut) throw new MarketplaceSourceError(
      "MARKETPLACE_TIMEOUT",
      `Repository discovery exceeded ${timeoutMs} ms.`,
      { cause: error }
    );
    if (callerAborted || callerSignal?.aborted) throw new MarketplaceSourceError(
      "MARKETPLACE_ABORTED",
      "Repository discovery was cancelled.",
      { cause: error }
    );
    if (error instanceof MarketplaceSourceError) throw error;
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "Unable to reach GitHub repository discovery.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancel);
  }
}

function requestInit(signal: AbortSignal, token: string | undefined): RequestInit {
  return {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "dsh-skill-manager",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` })
    },
    signal
  };
}

function assertResponse(response: Response): void {
  if (response.ok) return;
  if (response.status === 429 || (response.status === 403
    && response.headers.get("x-ratelimit-remaining") === "0")) {
    throw new MarketplaceSourceError(
      "GITHUB_RATE_LIMITED",
      "GitHub API rate limit was exceeded. Try again later or configure authentication."
    );
  }
  throw new MarketplaceSourceError(
    "MARKETPLACE_HTTP_ERROR",
    `GitHub repository discovery failed with HTTP ${response.status}.`
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_RESPONSE",
      "GitHub repository discovery returned malformed JSON.",
      { cause: error }
    );
  }
}

function normalizeSearchQuery(value: string | undefined): string {
  const query = value?.trim() ?? "";
  if (query.length < 2) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_QUERY",
      "Repository search queries must contain at least two characters."
    );
  }
  return query;
}

function normalizeLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      `Repository result limit must be an integer from 1 to ${MAX_LIMIT}.`
    );
  }
  return limit;
}

function normalizePage(value: number | undefined): number {
  const page = value ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > 10) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      "Repository result page must be an integer from 1 to 10."
    );
  }
  return page;
}

function normalizeSort(value: RepositorySort | undefined, query: string | null): RepositorySort {
  if (value !== undefined) return value;
  return query === null ? "popular" : "relevance";
}

function isTrendingSort(value: RepositorySort | undefined): value is "trend-weekly" | "trend-monthly" {
  return value === "trend-weekly" || value === "trend-monthly";
}

function requireTrending(
  trending: GitHubTrendingDiscovery | undefined,
  sort: "trend-weekly" | "trend-monthly",
  request: RepositoryQueryRequest
): Promise<RepositoryQueryResult> {
  if (trending === undefined) {
    throw new MarketplaceSourceError("MARKETPLACE_FETCH_FAILED", "GitHub Trending is not available in this Host.");
  }
  return trending.browseTrending({
    period: sort === "trend-weekly" ? "weekly" : "monthly",
    ...(request.page === undefined ? {} : { page: request.page }),
    ...(request.limit === undefined ? {} : { limit: request.limit }),
    ...(request.signal === undefined ? {} : { signal: request.signal })
  });
}

function normalizeToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token ? token : undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readHttpsUrl(value: unknown): string | undefined {
  const text = readString(value);
  if (text === undefined) return undefined;
  try { return new URL(text).protocol === "https:" ? text : undefined; } catch { return undefined; }
}

function readInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function readDate(value: unknown): string | undefined {
  const text = readString(value);
  return text !== undefined && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function readOwnerType(value: unknown): RepositoryCandidate["ownerType"] | undefined {
  return value === "User" || value === "Organization" || value === "Bot" ? value : undefined;
}

function aborted(): never {
  throw new MarketplaceSourceError("MARKETPLACE_ABORTED", "Repository discovery was cancelled.");
}

function invalidResponse(message: string): never {
  throw new MarketplaceSourceError("INVALID_MARKETPLACE_RESPONSE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
