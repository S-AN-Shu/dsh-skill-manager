import {
  MarketplaceSourceError,
  type MarketplaceEntry,
  type MarketplaceFetch,
  type MarketplaceSearchRequest,
  type MarketplaceSearchResult,
  type MarketplaceSource
} from "./types.js";

const GITHUB_API_ROOT = "https://api.github.com";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_REPOSITORY_LIMIT = 3;
const MAX_REPOSITORY_LIMIT = 5;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

export interface GitHubMarketplaceSourceOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  repositoryLimit?: number;
  token?: string;
}

interface GitHubRepositoryCandidate {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
}

export function createGitHubMarketplaceSource(
  options: GitHubMarketplaceSourceOptions = {}
): MarketplaceSource {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const repositoryLimit = options.repositoryLimit ?? DEFAULT_REPOSITORY_LIMIT;
  assertPositiveInteger(timeoutMs, "INVALID_MARKETPLACE_TIMEOUT", "Marketplace timeout");
  if (!Number.isInteger(repositoryLimit) || repositoryLimit < 1 || repositoryLimit > MAX_REPOSITORY_LIMIT) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      `GitHub repository validation limit must be an integer from 1 to ${MAX_REPOSITORY_LIMIT}.`
    );
  }
  const token = normalizeToken(options.token);

  return {
    async search(request) {
      const query = normalizeQuery(request.query);
      const limit = normalizeLimit(request.limit);
      return searchWithDeadline(fetch, request, timeoutMs, repositoryLimit, query, limit, token);
    }
  };
}

async function searchWithDeadline(
  fetch: MarketplaceFetch,
  request: MarketplaceSearchRequest,
  timeoutMs: number,
  repositoryLimit: number,
  query: string,
  limit: number,
  token: string | undefined
): Promise<MarketplaceSearchResult> {
  if (request.signal?.aborted) aborted();
  const controller = new AbortController();
  let rejectBoundary: (error: MarketplaceSourceError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => { rejectBoundary = reject; });
  let timedOut = false;
  let callerAborted = false;
  const cancelFromCaller = () => {
    callerAborted = true;
    rejectBoundary(new MarketplaceSourceError("MARKETPLACE_ABORTED", "Marketplace search was cancelled."));
    controller.abort(request.signal?.reason);
  };
  request.signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectBoundary(new MarketplaceSourceError(
      "MARKETPLACE_TIMEOUT",
      `GitHub marketplace discovery exceeded ${timeoutMs} ms.`
    ));
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([
      discover(fetch, controller.signal, repositoryLimit, query, limit, token),
      boundary
    ]);
  } catch (error) {
    if (timedOut) {
      throw new MarketplaceSourceError(
        "MARKETPLACE_TIMEOUT",
        `GitHub marketplace discovery exceeded ${timeoutMs} ms.`,
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
    if (error instanceof MarketplaceSourceError) throw error;
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "Unable to reach GitHub marketplace discovery.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function discover(
  fetch: MarketplaceFetch,
  signal: AbortSignal,
  repositoryLimit: number,
  query: string,
  limit: number,
  token: string | undefined
): Promise<MarketplaceSearchResult> {
  const url = new URL(`${GITHUB_API_ROOT}/search/repositories`);
  url.searchParams.set("q", `${query} SKILL.md in:name,description,readme`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(repositoryLimit));
  const response = await fetch(url, requestInit(signal, token));
  assertResponse(response, "GitHub repository search");
  const payload = await parseJson(response, "GitHub repository search returned malformed JSON.");
  const { repositories, incomplete } = parseSearch(payload);
  const discovered = await Promise.all(repositories.map((repository) => (
    discoverRepository(fetch, signal, repository, query, token)
  )));
  const entries = discovered.flat().sort(compareEntries).slice(0, limit);
  return {
    source: "github",
    query,
    returnedCount: entries.length,
    entries,
    sources: [{
      source: "github",
      status: incomplete ? "unavailable" : "available",
      returnedCount: entries.length,
      error: incomplete ? {
        code: "GITHUB_SEARCH_INCOMPLETE",
        message: "GitHub returned incomplete repository search results."
      } : null
    }]
  };
}

async function discoverRepository(
  fetch: MarketplaceFetch,
  signal: AbortSignal,
  repository: GitHubRepositoryCandidate,
  query: string,
  token: string | undefined
): Promise<MarketplaceEntry[]> {
  const url = `${GITHUB_API_ROOT}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.defaultBranch)}?recursive=1`;
  const response = await fetch(url, requestInit(signal, token));
  assertResponse(response, `GitHub tree for ${repository.fullName}`);
  const payload = await parseJson(response, `GitHub returned malformed tree JSON for ${repository.fullName}.`);
  if (!isRecord(payload) || !Array.isArray(payload.tree) || typeof payload.truncated !== "boolean") {
    invalidResponse(`GitHub returned an unsupported tree for ${repository.fullName}.`);
  }
  if (payload.truncated) return [];
  const paths = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  for (const item of payload.tree) {
    if (!isRecord(item) || item.type !== "blob" || typeof item.path !== "string") continue;
    const path = normalizeSkillDocumentPath(item.path);
    if (path === undefined) continue;
    const name = path.split("/").at(-2);
    if (name === undefined || !SKILL_NAME.test(name)) continue;
    const directory = path.slice(0, -"/SKILL.md".length);
    if (paths.has(name)) ambiguousNames.add(name);
    else paths.set(name, directory);
  }
  for (const name of ambiguousNames) paths.delete(name);
  const terms = query.toLocaleLowerCase().split(/\s+/u);
  return [...paths]
    .filter(([name, path]) => matches(repository, name, path, terms))
    .map(([name, path]) => toEntry(repository, name, path));
}

function parseSearch(payload: unknown): {
  repositories: GitHubRepositoryCandidate[];
  incomplete: boolean;
} {
  if (!isRecord(payload) || typeof payload.incomplete_results !== "boolean" || !Array.isArray(payload.items)) {
    invalidResponse("GitHub repository search returned an unsupported response shape.");
  }
  const repositories = payload.items.map(parseRepository);
  return { repositories, incomplete: payload.incomplete_results };
}

function parseRepository(value: unknown): GitHubRepositoryCandidate {
  if (!isRecord(value) || !isRecord(value.owner)) invalidResponse("GitHub search returned an invalid repository.");
  const owner = readNonEmptyString(value.owner.login);
  const name = readNonEmptyString(value.name);
  const fullName = readNonEmptyString(value.full_name);
  const url = readNonEmptyString(value.html_url);
  const defaultBranch = readNonEmptyString(value.default_branch);
  if (
    owner === undefined || name === undefined || fullName !== `${owner}/${name}`
    || url !== `https://github.com/${owner}/${name}` || defaultBranch === undefined
    || !REPOSITORY_PART.test(owner) || !REPOSITORY_PART.test(name)
    || typeof value.stargazers_count !== "number" || !Number.isSafeInteger(value.stargazers_count)
    || value.stargazers_count < 0
    || !(value.description === null || typeof value.description === "string")
  ) invalidResponse("GitHub search returned an invalid repository.");
  return {
    owner,
    name,
    fullName,
    url,
    description: value.description,
    defaultBranch,
    stars: value.stargazers_count
  };
}

function toEntry(repository: GitHubRepositoryCandidate, name: string, path: string): MarketplaceEntry {
  const id = `${repository.fullName}/${path || name}`;
  const encodedBranch = encodeURIComponent(repository.defaultBranch);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return {
    id,
    source: "github",
    catalogs: ["github"],
    name,
    description: null,
    publisher: { name: repository.owner, url: `https://github.com/${repository.owner}` },
    author: null,
    repository: {
      host: "github",
      owner: repository.owner,
      name: repository.name,
      path: path || null,
      url: repository.url
    },
    skillUrl: path
      ? `${repository.url}/tree/${encodedBranch}/${encodedPath}`
      : `${repository.url}/blob/${encodedBranch}/SKILL.md`,
    install: {
      kind: "github",
      repository: repository.fullName,
      skill: name,
      path: path || null
    },
    metrics: {
      installs: null,
      stars: { value: repository.stars, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: id }
  };
}

function matches(
  repository: GitHubRepositoryCandidate,
  name: string,
  path: string,
  terms: string[]
): boolean {
  const haystack = `${name} ${path} ${repository.fullName} ${repository.description ?? ""}`.toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
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

function assertResponse(response: Response, operation: string): void {
  if (response.ok) return;
  if (response.status === 429 || (
    response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"
  )) {
    throw new MarketplaceSourceError(
      "GITHUB_RATE_LIMITED",
      "GitHub API rate limit was exceeded. Try again later or configure authentication."
    );
  }
  throw new MarketplaceSourceError(
    "MARKETPLACE_HTTP_ERROR",
    `${operation} failed with HTTP ${response.status}.`
  );
}

async function parseJson(response: Response, message: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new MarketplaceSourceError("INVALID_MARKETPLACE_RESPONSE", message, { cause: error });
  }
}

function normalizeSkillDocumentPath(value: string): string | undefined {
  if (!value.endsWith("/SKILL.md") || value.startsWith("/") || value.includes("\\")) return undefined;
  const segments = value.split("/");
  if (segments.some((segment) => (
    segment.length === 0 || segment === "." || segment === ".."
    || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[. ]$/u.test(segment)
    || WINDOWS_RESERVED_NAME.test(segment)
  ))) return undefined;
  return value;
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

function normalizeToken(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const token = input.trim();
  return token.length > 0 ? token : undefined;
}

function assertPositiveInteger(
  value: number,
  code: "INVALID_MARKETPLACE_TIMEOUT",
  label: string
): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new MarketplaceSourceError(code, `${label} must be a positive integer in milliseconds.`);
  }
}

function compareEntries(left: MarketplaceEntry, right: MarketplaceEntry): number {
  return (right.metrics.stars?.value ?? 0) - (left.metrics.stars?.value ?? 0)
    || left.name.localeCompare(right.name);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function aborted(): never {
  throw new MarketplaceSourceError("MARKETPLACE_ABORTED", "Marketplace search was cancelled.");
}

function invalidResponse(message: string): never {
  throw new MarketplaceSourceError("INVALID_MARKETPLACE_RESPONSE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
