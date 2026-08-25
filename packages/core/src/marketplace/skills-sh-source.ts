import {
  MarketplaceSourceError,
  type MarketplaceEntry,
  type MarketplaceBrowseRequest,
  type MarketplaceBrowseResult,
  type MarketplaceBrowser,
  type MarketplaceFetch,
  type MarketplaceSearchRequest,
  type MarketplaceSearchResult,
  type MarketplaceSource
} from "./types.js";

const SEARCH_ENDPOINT = "https://skills.sh/api/search";
const LEADERBOARD_ENDPOINT = "https://skills.sh/api/skills/all-time";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 10_000;
const LEADERBOARD_PAGE_SIZE = 200;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

export interface SkillsShMarketplaceSourceOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export interface SkillsShMarketplaceSource extends MarketplaceSource, MarketplaceBrowser {}

interface SkillsShSearchEntry {
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

export function createSkillsShMarketplaceSource(
  options: SkillsShMarketplaceSourceOptions = {}
): SkillsShMarketplaceSource {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  assertTimeout(timeoutMs);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 0) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_TIMEOUT",
      "Marketplace cache TTL must be a non-negative integer in milliseconds."
    );
  }
  const leaderboardCache = new Map<number, {
    expiresAt: number;
    value: Promise<LeaderboardPage>;
  }>();

  return {
    async search(request) {
      const query = normalizeQuery(request.query);
      const limit = normalizeLimit(request.limit);
      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));

      const response = await fetchWithDeadline(fetch, url, request, timeoutMs);
      if (!response.ok) {
        throw new MarketplaceSourceError(
          "MARKETPLACE_HTTP_ERROR",
          `skills.sh search failed with HTTP ${response.status}.`
        );
      }

      const payload = await parseJson(response);
      const entries = normalizeResponse(payload);
      return {
        source: "skills-sh",
        query,
        returnedCount: entries.length,
        entries,
        sources: [{
          source: "skills-sh",
          status: "available",
          returnedCount: entries.length,
          error: null
        }]
      } satisfies MarketplaceSearchResult;
    },

    async browse(request: MarketplaceBrowseRequest = {}) {
      const offset = normalizeOffset(request.offset);
      const limit = normalizeLimit(request.limit);
      const firstPage = Math.floor(offset / LEADERBOARD_PAGE_SIZE);
      const lastPage = Math.floor((offset + limit - 1) / LEADERBOARD_PAGE_SIZE);
      const pages = await Promise.all(Array.from(
        { length: lastPage - firstPage + 1 },
        (_, index) => loadLeaderboardPage(firstPage + index, request)
      ));
      const entries = pages.flatMap((page) => page.entries);
      const firstIndex = offset - firstPage * LEADERBOARD_PAGE_SIZE;
      const selected = entries.slice(firstIndex, firstIndex + limit);
      const total = pages[0]?.total ?? 0;
      return {
        source: "skills-sh",
        ranking: "all-time-installs",
        offset,
        returnedCount: selected.length,
        total,
        hasMore: offset + selected.length < total,
        entries: selected
      } satisfies MarketplaceBrowseResult;
    }
  };

  async function loadLeaderboardPage(
    page: number,
    request: MarketplaceBrowseRequest
  ): Promise<LeaderboardPage> {
    const cached = leaderboardCache.get(page);
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;
    const value = fetchLeaderboardPage(fetch, page, request, timeoutMs).catch((error) => {
      if (leaderboardCache.get(page)?.value === value) leaderboardCache.delete(page);
      throw error;
    });
    leaderboardCache.set(page, { expiresAt: Date.now() + cacheTtlMs, value });
    return value;
  }
}

interface LeaderboardPage {
  page: number;
  total: number;
  hasMore: boolean;
  entries: MarketplaceEntry[];
}

async function fetchLeaderboardPage(
  fetch: MarketplaceFetch,
  page: number,
  request: MarketplaceBrowseRequest,
  timeoutMs: number
): Promise<LeaderboardPage> {
  const url = new URL(`${LEADERBOARD_ENDPOINT}/${page}`);
  const response = await fetchWithDeadline(fetch, url, {
    query: "all-time",
    ...(request.signal === undefined ? {} : { signal: request.signal })
  }, timeoutMs);
  if (!response.ok) {
    throw new MarketplaceSourceError(
      "MARKETPLACE_HTTP_ERROR",
      `skills.sh leaderboard failed with HTTP ${response.status}.`
    );
  }
  const payload = await parseJson(response);
  if (
    !isRecord(payload)
    || payload.page !== page
    || !Number.isSafeInteger(payload.total)
    || Number(payload.total) < 0
    || typeof payload.hasMore !== "boolean"
    || !Array.isArray(payload.skills)
    || payload.skills.length > LEADERBOARD_PAGE_SIZE
  ) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_RESPONSE",
      "skills.sh leaderboard returned an unsupported response shape."
    );
  }
  const entries = normalizeLeaderboardEntries(payload.skills);
  return {
    page,
    total: Number(payload.total),
    hasMore: payload.hasMore,
    entries
  };
}

function normalizeLeaderboardEntries(values: unknown[]): MarketplaceEntry[] {
  const entries: MarketplaceEntry[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const entry = parseEntry(value);
    if (entry === undefined) {
      if (isUnsupportedLeaderboardEntry(value)) continue;
      throw new MarketplaceSourceError(
        "INVALID_MARKETPLACE_RESPONSE",
        "skills.sh leaderboard contains an invalid Skill."
      );
    }
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return entries;
}

function isUnsupportedLeaderboardEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const skillId = readNonEmptyString(value.skillId);
  const name = readNonEmptyString(value.name);
  const installs = readInstallCount(value.installs);
  const source = readNonEmptyString(value.source);
  return isPathSegment(skillId)
    && name.length > 0
    && installs >= 0
    && source.length > 0
    && parseGitHubRepository(source) === undefined;
}

function normalizeQuery(input: string): string {
  const query = input.trim();
  if (query.length < 2) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_QUERY",
      "Marketplace search queries must contain at least two characters."
    );
  }
  return query;
}

function normalizeLimit(input: number | undefined): number {
  const limit = input ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      `Marketplace search limit must be an integer from 1 to ${MAX_LIMIT}.`
    );
  }
  return limit;
}

function normalizeOffset(input: number | undefined): number {
  const offset = input ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      "Marketplace browse offset must be an integer from 0 to 100000."
    );
  }
  return offset;
}

function assertTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_TIMEOUT",
      "Marketplace timeout must be a positive integer in milliseconds."
    );
  }
}

async function fetchWithDeadline(
  fetch: MarketplaceFetch,
  url: URL,
  request: MarketplaceSearchRequest,
  timeoutMs: number
): Promise<Response> {
  if (request.signal?.aborted) {
    throw new MarketplaceSourceError(
      "MARKETPLACE_ABORTED",
      "Marketplace search was cancelled."
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;
  const cancelFromCaller = () => {
    callerAborted = true;
    controller.abort(request.signal?.reason);
  };
  request.signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
  } catch (error) {
    if (timedOut) {
      throw new MarketplaceSourceError(
        "MARKETPLACE_TIMEOUT",
        `skills.sh search exceeded ${timeoutMs} ms.`,
        { cause: error }
      );
    }
    if (callerAborted || request.signal?.aborted) {
      throw new MarketplaceSourceError(
        "MARKETPLACE_ABORTED",
        "Marketplace search was cancelled.",
        { cause: error }
      );
    }
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "Unable to reach skills.sh.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_RESPONSE",
      "skills.sh returned malformed JSON.",
      { cause: error }
    );
  }
}

function normalizeResponse(payload: unknown): MarketplaceEntry[] {
  if (!isRecord(payload) || !Array.isArray(payload.skills)) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_RESPONSE",
      "skills.sh returned an unsupported response shape."
    );
  }

  const entries: MarketplaceEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of payload.skills) {
    const parsed = parseEntry(candidate);
    if (parsed === undefined || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    entries.push(parsed);
  }
  return entries;
}

function parseEntry(value: unknown): MarketplaceEntry | undefined {
  if (!isRecord(value)) return undefined;
  const raw: SkillsShSearchEntry = {
    skillId: readNonEmptyString(value.skillId),
    name: readNonEmptyString(value.name),
    installs: readInstallCount(value.installs),
    source: readNonEmptyString(value.source)
  };
  if (
    raw.skillId.length === 0
    || raw.name.length === 0
    || raw.source.length === 0
    || raw.installs < 0
  ) return undefined;

  const repository = parseGitHubRepository(raw.source);
  if (repository === undefined || !isPathSegment(raw.skillId)) return undefined;

  const id = `${raw.source}/${raw.skillId}`;
  const repositoryUrl = `https://github.com/${raw.source}`;
  return {
    id,
    source: "skills-sh",
    catalogs: ["skills-sh"],
    name: raw.name,
    description: null,
    publisher: {
      name: repository.owner,
      url: `https://github.com/${repository.owner}`
    },
    author: null,
    repository: {
      host: "github",
      owner: repository.owner,
      name: repository.name,
      path: null,
      url: repositoryUrl
    },
    skillUrl: `https://skills.sh/${id}`,
    install: {
      kind: "github",
      repository: raw.source,
      skill: raw.skillId,
      path: null
    },
    metrics: {
      installs: {
        value: raw.installs,
        source: "skills.sh"
      },
      stars: null,
      downloads: null
    },
    cover: {
      kind: "generated",
      seed: id
    }
  };
}

function parseGitHubRepository(value: string): { owner: string; name: string } | undefined {
  const segments = value.split("/");
  if (segments.length !== 2) return undefined;
  const [owner, name] = segments;
  if (owner === undefined || name === undefined) return undefined;
  if (!isPathSegment(owner) || !isPathSegment(name)) return undefined;
  return { owner, name };
}

function isPathSegment(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value);
}

function readNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readInstallCount(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
