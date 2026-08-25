import { Buffer } from "node:buffer";

import { parse } from "yaml";

import {
  MarketplaceResolverError,
  type GitHubMarketplaceResolver,
  type MarketplaceEntry,
  type MarketplaceFetch,
  type MarketplaceResolveRequest,
  type MarketplaceParty,
  type ResolvedMarketplaceEntry
} from "./types.js";

const GITHUB_API_ROOT = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const GITHUB_PATH_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface GitHubMarketplaceResolverOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  now?: () => Date;
}

interface RepositoryPayload {
  id: number;
  nodeId: string;
  defaultBranch: string;
  stars: number;
  url: string;
  ownerName: string;
  ownerUrl: string;
}

interface TreeCandidate {
  path: string;
  blobSha: string;
}

interface SkillMetadata {
  name: string;
  description: string;
  author: MarketplaceParty | null;
}

export function createGitHubMarketplaceResolver(
  options: GitHubMarketplaceResolverOptions = {}
): GitHubMarketplaceResolver {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceResolverError(
      "INVALID_MARKETPLACE_RESOLUTION_TIMEOUT",
      "Marketplace resolution timeout must be a positive integer in milliseconds."
    );
  }
  const now = options.now ?? (() => new Date());

  return {
    async resolve(entry, request = {}) {
      assertResolvableEntry(entry);
      return resolveWithDeadline(fetch, entry, request, timeoutMs, now);
    }
  };
}

async function resolveWithDeadline(
  fetch: MarketplaceFetch,
  entry: MarketplaceEntry,
  request: MarketplaceResolveRequest,
  timeoutMs: number,
  now: () => Date
): Promise<ResolvedMarketplaceEntry> {
  if (request.signal?.aborted) {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Marketplace resolution was cancelled."
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;
  let rejectBoundary: (error: MarketplaceResolverError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => {
    rejectBoundary = reject;
  });
  const cancelFromCaller = () => {
    callerAborted = true;
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Marketplace resolution was cancelled."
    ));
    controller.abort(request.signal?.reason);
  };
  request.signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      `Marketplace resolution exceeded ${timeoutMs} ms.`
    ));
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([
      resolveSnapshot(fetch, entry, controller.signal, now),
      boundary
    ]);
  } catch (error) {
    if (timedOut) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_TIMEOUT",
        `Marketplace resolution exceeded ${timeoutMs} ms.`,
        { cause: error }
      );
    }
    if (callerAborted || request.signal?.aborted) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_ABORTED",
        "Marketplace resolution was cancelled.",
        { cause: error }
      );
    }
    if (error instanceof MarketplaceResolverError) throw error;
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_FETCH_FAILED",
      "Unable to reach GitHub.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function resolveSnapshot(
  fetch: MarketplaceFetch,
  entry: MarketplaceEntry,
  signal: AbortSignal,
  now: () => Date
): Promise<ResolvedMarketplaceEntry> {
  const repositorySlug = `${entry.repository.owner}/${entry.repository.name}`;
  const repository = parseRepository(await getJson(
    fetch,
    `${GITHUB_API_ROOT}/repos/${repositorySlug}`,
    signal
  ));
  const commitSha = parseCommit(await getJson(
    fetch,
    `${GITHUB_API_ROOT}/repos/${repositorySlug}/commits/${encodeURIComponent(repository.defaultBranch)}`,
    signal
  ));
  const candidate = parseTree(await getJson(
    fetch,
    `${GITHUB_API_ROOT}/repos/${repositorySlug}/git/trees/${commitSha}?recursive=1`,
    signal
  ), entry.install.skill, entry.install.path);
  const skill = parseSkillBlob(await getJson(
    fetch,
    `${GITHUB_API_ROOT}/repos/${repositorySlug}/git/blobs/${candidate.blobSha}`,
    signal
  ), entry.install.skill);

  return {
    ...entry,
    description: skill.description,
    publisher: {
      name: repository.ownerName,
      url: repository.ownerUrl
    },
    author: skill.author,
    repository: {
      host: "github",
      id: repository.id,
      nodeId: repository.nodeId,
      owner: entry.repository.owner,
      name: entry.repository.name,
      path: candidate.path,
      url: repository.url
    },
    install: {
      ...entry.install,
      path: candidate.path
    },
    metrics: {
      ...entry.metrics,
      stars: {
        value: repository.stars,
        source: "github",
        scope: "repository"
      }
    },
    snapshot: {
      commitSha,
      blobSha: candidate.blobSha,
      fetchedAt: now().toISOString()
    }
  };
}

async function getJson(
  fetch: MarketplaceFetch,
  url: string,
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "dsh-skill-manager"
    },
    signal
  });
  if (!response.ok) {
    if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
      throw new MarketplaceResolverError(
        "GITHUB_RATE_LIMITED",
        "GitHub API rate limit was exceeded."
      );
    }
    throw new MarketplaceResolverError(
      "GITHUB_HTTP_ERROR",
      `GitHub request failed with HTTP ${response.status}.`
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new MarketplaceResolverError(
      "INVALID_GITHUB_RESPONSE",
      "GitHub returned malformed JSON.",
      { cause: error }
    );
  }
}

function assertResolvableEntry(entry: MarketplaceEntry): void {
  const repositorySlug = `${entry.repository.owner}/${entry.repository.name}`;
  if (
    entry.repository.host !== "github"
    || !GITHUB_PATH_SEGMENT.test(entry.repository.owner)
    || !GITHUB_PATH_SEGMENT.test(entry.repository.name)
    || entry.install.kind !== "github"
    || !SKILL_NAME.test(entry.install.skill)
    || entry.install.repository !== repositorySlug
    || entry.repository.path !== entry.install.path
    || (entry.install.path !== null
      && entry.install.path !== "."
      && !isSafeRepositoryPath(entry.install.path))
  ) {
    throw new MarketplaceResolverError(
      "INVALID_MARKETPLACE_ENTRY",
      "Marketplace entry is not a resolvable GitHub Skill."
    );
  }
}

function parseRepository(payload: unknown): RepositoryPayload {
  if (!isRecord(payload) || !isRecord(payload.owner)) invalidGitHubResponse();
  const id = readSafeNonNegativeInteger(payload.id);
  const stars = readSafeNonNegativeInteger(payload.stargazers_count);
  const nodeId = readNonEmptyString(payload.node_id);
  const defaultBranch = readNonEmptyString(payload.default_branch);
  const url = readHttpsUrl(payload.html_url);
  const ownerName = readNonEmptyString(payload.owner.login);
  const ownerUrl = readHttpsUrl(payload.owner.html_url);
  if (
    id === undefined
    || stars === undefined
    || nodeId === undefined
    || defaultBranch === undefined
    || url === undefined
    || ownerName === undefined
    || ownerUrl === undefined
  ) invalidGitHubResponse();
  return { id, nodeId, defaultBranch, stars, url, ownerName, ownerUrl };
}

function parseCommit(payload: unknown): string {
  if (!isRecord(payload)) invalidGitHubResponse();
  const sha = readNonEmptyString(payload.sha);
  if (sha === undefined || !SHA_PATTERN.test(sha)) invalidGitHubResponse();
  return sha;
}

function parseTree(
  payload: unknown,
  skillName: string,
  exactPath: string | null
): TreeCandidate {
  if (!isRecord(payload) || typeof payload.truncated !== "boolean" || !Array.isArray(payload.tree)) {
    invalidGitHubResponse();
  }
  if (payload.truncated) {
    throw new MarketplaceResolverError(
      "GITHUB_TREE_TRUNCATED",
      "GitHub returned a truncated repository tree."
    );
  }

  const expectedDocument = exactPath === null
    ? null
    : exactPath === "." ? "SKILL.md" : `${exactPath}/SKILL.md`;
  const matches: TreeCandidate[] = [];
  for (const item of payload.tree) {
    if (!isRecord(item) || item.type !== "blob") continue;
    const path = readNonEmptyString(item.path);
    const blobSha = readNonEmptyString(item.sha);
    if (path === undefined || blobSha === undefined || !SHA_PATTERN.test(blobSha)) continue;
    const segments = path.split("/");
    if (expectedDocument !== null && path !== expectedDocument) continue;
    if (path === "SKILL.md" && exactPath === ".") {
      matches.push({ path: ".", blobSha });
      continue;
    }
    if (segments.length >= 2 && segments.at(-1) === "SKILL.md" && segments.at(-2) === skillName) {
      if (!isSafeRepositoryPath(path)) invalidGitHubResponse();
      matches.push({ path: segments.slice(0, -1).join("/"), blobSha });
    }
  }
  if (matches.length === 0) {
    throw new MarketplaceResolverError(
      "GITHUB_SKILL_NOT_FOUND",
      expectedDocument === null
        ? `GitHub repository does not contain an exact ${skillName}/SKILL.md candidate.`
        : `GitHub repository does not contain the exact ${expectedDocument} Skill document.`
    );
  }
  if (matches.length > 1) {
    throw new MarketplaceResolverError(
      "GITHUB_SKILL_AMBIGUOUS",
      `GitHub repository contains multiple ${skillName}/SKILL.md candidates.`
    );
  }
  return matches[0]!;
}

function parseSkillBlob(payload: unknown, expectedName: string): SkillMetadata {
  if (!isRecord(payload) || payload.encoding !== "base64") invalidGitHubResponse();
  const content = readNonEmptyString(payload.content);
  if (content === undefined) invalidGitHubResponse();

  const encoded = content.replace(/\s/g, "");
  if (!BASE64_PATTERN.test(encoded)) {
    throw new MarketplaceResolverError(
      "INVALID_GITHUB_RESPONSE",
      "GitHub returned an invalid base64 Skill blob."
    );
  }
  const document = Buffer.from(encoded, "base64").toString("utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(document);
  if (match === null) invalidSkillDocument("Skill document is missing valid frontmatter.");

  let frontmatter: unknown;
  try {
    frontmatter = parse(match[1] ?? "");
  } catch (error) {
    throw new MarketplaceResolverError(
      "INVALID_SKILL_DOCUMENT",
      "Skill document contains malformed YAML frontmatter.",
      { cause: error }
    );
  }
  if (!isRecord(frontmatter)) invalidSkillDocument("Skill frontmatter must be a mapping.");
  const name = readNonEmptyString(frontmatter.name);
  const description = readNonEmptyString(frontmatter.description);
  if (name !== expectedName) {
    invalidSkillDocument(`Skill frontmatter name must equal ${expectedName}.`);
  }
  if (description === undefined) {
    invalidSkillDocument("Skill frontmatter must contain a description.");
  }

  let author: MarketplaceParty | null = null;
  if (isRecord(frontmatter.metadata) && frontmatter.metadata.author !== undefined) {
    const authorName = readNonEmptyString(frontmatter.metadata.author);
    if (authorName === undefined) {
      invalidSkillDocument("Skill metadata author must be a non-empty string.");
    }
    author = { name: authorName, url: null };
  }
  return { name, description, author };
}

function invalidGitHubResponse(): never {
  throw new MarketplaceResolverError(
    "INVALID_GITHUB_RESPONSE",
    "GitHub returned an unsupported response shape."
  );
}

function invalidSkillDocument(message: string): never {
  throw new MarketplaceResolverError("INVALID_SKILL_DOCUMENT", message);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readSafeNonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function readHttpsUrl(value: unknown): string | undefined {
  const url = readNonEmptyString(value);
  if (url === undefined) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function isSafeRepositoryPath(path: string): boolean {
  return !path.includes("\\")
    && !path.includes("\0")
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
