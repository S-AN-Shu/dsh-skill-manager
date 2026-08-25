import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { SkillManagerError } from "../skill-manager-error.js";
import type { GitHubSkillSource, SkillSnapshot } from "../types.js";
import {
  MarketplaceResolverError,
  type MarketplaceFetch,
  type ResolvedMarketplaceEntry
} from "./types.js";
import type { GitHubSnapshotCache } from "./github-snapshot-cache.js";

const GITHUB_API_ROOT = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_FILE_COUNT = 512;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 25 * 1024 * 1024;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const GITHUB_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export interface GitHubBundleFile {
  path: string;
  content: Uint8Array;
  blobSha: string;
  size: number;
  mode: "100644" | "100755";
}

export interface GitHubBundle {
  files: GitHubBundleFile[];
  bundleHash: string;
}

export interface GitHubBundleFetcherOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  snapshotCache?: GitHubSnapshotCache;
}

export interface GitHubBundleFetcher {
  fetchBundle(
    entry: ResolvedMarketplaceEntry,
    request?: { signal?: AbortSignal }
  ): Promise<GitHubBundle>;
}

export interface GitHubUpdateCheckerOptions {
  fetch?: MarketplaceFetch;
}

export interface GitHubUpdateChecker {
  checkLatest(
    name: string,
    source: GitHubSkillSource,
    request?: { signal?: AbortSignal }
  ): Promise<SkillSnapshot>;
}

interface TreeFile {
  repositoryPath: string;
  relativePath: string;
  mode: "100644" | "100755";
  sha: string;
  size: number;
}

export function createGitHubBundleFetcher(
  options: GitHubBundleFetcherOptions = {}
): GitHubBundleFetcher {
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
      "Marketplace installation timeout must be a positive integer in milliseconds."
    );
  }

  return {
    async fetchBundle(entry, request = {}) {
      assertInstallEntry(entry);
      return fetchWithBoundary(fetch, entry, request.signal, timeoutMs, options.snapshotCache);
    }
  };
}

export function createGitHubUpdateChecker(
  options: GitHubUpdateCheckerOptions = {}
): GitHubUpdateChecker {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }

  return {
    async checkLatest(name, source, request = {}) {
      assertUpdateSource(name, source);
      const [owner, repositoryName] = source.repository.split("/") as [string, string];
      const repositoryPayload = await getJson(
        fetch,
        `${GITHUB_API_ROOT}/repos/${source.repository}`,
        request.signal ?? new AbortController().signal
      );
      const defaultBranch = parseDefaultBranch(repositoryPayload);
      const commitPayload = await getJson(
        fetch,
        `${GITHUB_API_ROOT}/repos/${source.repository}/commits/${encodeURIComponent(defaultBranch)}`,
        request.signal ?? new AbortController().signal
      );
      const commitSha = parseCommitSha(commitPayload);
      const treePayload = await getJson(
        fetch,
        `${GITHUB_API_ROOT}/repos/${owner}/${repositoryName}/git/trees/${commitSha}?recursive=1`,
        request.signal ?? new AbortController().signal
      );
      const treeFiles = parseDirectoryTree(treePayload, source.path, source.manifestFiles);
      const skillDocument = treeFiles.find((file) => file.relativePath === "SKILL.md");
      if (skillDocument === undefined) {
        throw new SkillManagerError(
          "INVALID_MARKETPLACE_INSTALL",
          "GitHub source directory no longer contains SKILL.md."
        );
      }
      return {
        commitSha,
        blobSha: skillDocument.sha,
        bundleHash: hashTreeFiles(treeFiles)
      };
    }
  };
}

async function fetchWithBoundary(
  fetch: MarketplaceFetch,
  entry: ResolvedMarketplaceEntry,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  snapshotCache: GitHubSnapshotCache | undefined
): Promise<GitHubBundle> {
  if (callerSignal?.aborted) {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Marketplace installation was cancelled."
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
      "Marketplace installation was cancelled."
    ));
    controller.abort(callerSignal?.reason);
  };
  callerSignal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      `Marketplace installation exceeded ${timeoutMs} ms.`
    ));
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([
      downloadBundle(fetch, entry, controller.signal, snapshotCache),
      boundary
    ]);
  } catch (error) {
    if (timedOut) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_TIMEOUT",
        `Marketplace installation exceeded ${timeoutMs} ms.`,
        { cause: error }
      );
    }
    if (callerAborted || callerSignal?.aborted) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_ABORTED",
        "Marketplace installation was cancelled.",
        { cause: error }
      );
    }
    if (error instanceof MarketplaceResolverError || error instanceof SkillManagerError) {
      throw error;
    }
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_FETCH_FAILED",
      "Unable to fetch the GitHub Skill bundle.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function downloadBundle(
  fetch: MarketplaceFetch,
  entry: ResolvedMarketplaceEntry,
  signal: AbortSignal,
  snapshotCache: GitHubSnapshotCache | undefined
): Promise<GitHubBundle> {
  const repository = `${entry.repository.owner}/${entry.repository.name}`;
  if (snapshotCache !== undefined) {
    return await snapshotCache.withSnapshot(entry.repository, signal, async (snapshot) => {
      if (snapshot.commit !== entry.snapshot.commitSha) {
        throw new SkillManagerError(
          "INVALID_MARKETPLACE_INSTALL",
          "Repository changed after Inspection; prepare the installation again."
        );
      }
      const treeFiles = parseTree({ truncated: false, tree: snapshot.tree }, entry);
      const files: GitHubBundleFile[] = [];
      for (const treeFile of treeFiles) {
        const content = await snapshot.readFile(treeFile.repositoryPath);
        if (content.byteLength !== treeFile.size || gitBlobSha(content) !== treeFile.sha) {
          invalidGitHubResponse();
        }
        files.push({
          path: treeFile.relativePath,
          content,
          blobSha: treeFile.sha,
          size: treeFile.size,
          mode: treeFile.mode
        });
      }
      return { files, bundleHash: hashTreeFiles(treeFiles) };
    });
  }
  const treePayload = await getJson(
    fetch,
    `${GITHUB_API_ROOT}/repos/${repository}/git/trees/${entry.snapshot.commitSha}?recursive=1`,
    signal
  );
  const treeFiles = parseTree(treePayload, entry);
  const files: GitHubBundleFile[] = [];
  for (const treeFile of treeFiles) {
    const payload = await getJson(
      fetch,
      `${GITHUB_API_ROOT}/repos/${repository}/git/blobs/${treeFile.sha}`,
      signal
    );
    files.push({
      path: treeFile.relativePath,
      content: parseBlob(payload, treeFile),
      blobSha: treeFile.sha,
      size: treeFile.size,
      mode: treeFile.mode
    });
  }
  return {
    files,
    bundleHash: hashTreeFiles(treeFiles)
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
      throw new MarketplaceResolverError("GITHUB_RATE_LIMITED", "GitHub API rate limit was exceeded.");
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

function assertInstallEntry(entry: ResolvedMarketplaceEntry): void {
  const repository = `${entry.repository.owner}/${entry.repository.name}`;
  const expectedId = `${repository}/${entry.install.skill}`;
  const rootSkill = entry.repository.path === ".";
  if (
    entry.repository.host !== "github"
    || !GITHUB_SEGMENT.test(entry.repository.owner)
    || !GITHUB_SEGMENT.test(entry.repository.name)
    || entry.install.kind !== "github"
    || entry.install.repository !== repository
    || !SKILL_NAME.test(entry.install.skill)
    || entry.id !== expectedId
    || entry.install.path !== entry.repository.path
    || (!rootSkill && !isSafeRelativePath(entry.repository.path))
    || !SHA_PATTERN.test(entry.snapshot.commitSha)
    || !SHA_PATTERN.test(entry.snapshot.blobSha)
    || !isValidManifestFiles(entry.snapshot.manifestFiles)
  ) {
    throw new SkillManagerError(
      "INVALID_MARKETPLACE_INSTALL",
      "Resolved marketplace entry has inconsistent or unsafe installation identity."
    );
  }
}

function parseTree(payload: unknown, entry: ResolvedMarketplaceEntry): TreeFile[] {
  const files = parseDirectoryTree(payload, entry.repository.path, entry.snapshot.manifestFiles);
  const skillDocument = files.find((file) => file.relativePath === "SKILL.md");
  if (skillDocument?.sha !== entry.snapshot.blobSha) {
    throw new SkillManagerError(
      "INVALID_MARKETPLACE_INSTALL",
      "Resolved SKILL.md blob no longer matches the selected snapshot."
    );
  }
  return files;
}

function parseDirectoryTree(payload: unknown, directoryPath: string, manifestFiles: string[] = []): TreeFile[] {
  if (!isRecord(payload) || typeof payload.truncated !== "boolean" || !Array.isArray(payload.tree)) {
    invalidGitHubResponse();
  }
  if (payload.truncated) {
    throw new MarketplaceResolverError(
      "GITHUB_TREE_TRUNCATED",
      "GitHub returned a truncated repository tree."
    );
  }

  const rootSkill = directoryPath === ".";
  const prefix = rootSkill ? "" : `${directoryPath}/`;
  const files: TreeFile[] = [];
  const comparablePaths = new Set<string>();
  let totalBytes = 0;
  let skillDocumentFound = false;
  for (const item of payload.tree) {
    if (!isRecord(item) || typeof item.path !== "string" || !item.path.startsWith(prefix)) continue;
    if (isAgentInstructionPath(item.path)) continue;
    if (rootSkill && !isRootSkillBundlePath(item.path, manifestFiles)) continue;
    if (!isSafeRelativePath(item.path)) unsafeBundle(`Unsafe repository path "${item.path}".`);
    if (item.type === "tree") continue;
    if (item.type !== "blob" || (item.mode !== "100644" && item.mode !== "100755")) {
      unsafeBundle(`Unsupported repository entry "${item.path}".`);
    }
    const sha = readSha(item.sha);
    const size = readSize(item.size);
    if (sha === undefined || size === undefined) invalidGitHubResponse();
    if (size > MAX_FILE_BYTES) tooLarge(`Skill file "${item.path}" exceeds the size limit.`);
    const relativePath = item.path.slice(prefix.length);
    if (!isSafeRelativePath(relativePath)) unsafeBundle(`Unsafe Skill path "${relativePath}".`);
    const comparable = relativePath.toLowerCase();
    if (comparablePaths.has(comparable)) {
      unsafeBundle(`Skill bundle contains a duplicate path "${relativePath}".`);
    }
    comparablePaths.add(comparable);
    totalBytes += size;
    if (totalBytes > MAX_BUNDLE_BYTES) tooLarge("Skill bundle exceeds the total size limit.");
    files.push({
      repositoryPath: item.path,
      relativePath,
      mode: item.mode,
      sha,
      size
    });
    if (relativePath === "SKILL.md") skillDocumentFound = true;
  }
  if (!skillDocumentFound) {
    throw new SkillManagerError(
      "INVALID_MARKETPLACE_INSTALL",
      "Resolved Skill directory does not contain the selected SKILL.md blob."
    );
  }
  if (files.length > MAX_FILE_COUNT) tooLarge("Skill bundle contains too many files.");
  return files.sort((left, right) => {
    if (left.relativePath === "SKILL.md") return -1;
    if (right.relativePath === "SKILL.md") return 1;
    return left.relativePath.localeCompare(right.relativePath);
  });
}

function assertUpdateSource(name: string, source: GitHubSkillSource): void {
  const segments = source.repository.split("/");
  if (
    !SKILL_NAME.test(name)
    || segments.length !== 2
    || !segments.every((segment) => GITHUB_SEGMENT.test(segment))
    || (source.path !== "." && !isSafeRelativePath(source.path))
    || !SHA_PATTERN.test(source.commitSha)
    || !SHA_PATTERN.test(source.blobSha)
    || !/^[a-f0-9]{64}$/i.test(source.bundleHash)
    || !isValidManifestFiles(source.manifestFiles)
  ) {
    throw new SkillManagerError(
      "INVALID_MARKETPLACE_INSTALL",
      "Managed GitHub source has inconsistent or unsafe update identity."
    );
  }
}

function isRootSkillBundlePath(path: string, manifestFiles: string[]): boolean {
  return !isAgentInstructionPath(path) && (path === "SKILL.md"
    || path.startsWith("scripts/")
    || path.startsWith("references/")
    || path.startsWith("assets/")
    || manifestFiles.includes(path));
}

function isValidManifestFiles(value: string[] | undefined): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || new Set(value).size !== value.length) return false;
  return value.every((path) => isSafeRelativePath(path)
    && !isAgentInstructionPath(path));
}

function isAgentInstructionPath(path: string): boolean {
  return /^(?:AGENTS|CLAUDE)\.md$/iu.test(path.split("/").at(-1) ?? "");
}

function parseDefaultBranch(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.default_branch !== "string") invalidGitHubResponse();
  const branch = payload.default_branch.trim();
  if (branch.length === 0) invalidGitHubResponse();
  return branch;
}

function parseCommitSha(payload: unknown): string {
  if (!isRecord(payload)) invalidGitHubResponse();
  const sha = readSha(payload.sha);
  if (sha === undefined) invalidGitHubResponse();
  return sha;
}

function parseBlob(payload: unknown, expected: TreeFile): Uint8Array {
  if (!isRecord(payload) || payload.encoding !== "base64") invalidGitHubResponse();
  const sha = readSha(payload.sha);
  const size = readSize(payload.size);
  const rawContent = typeof payload.content === "string" ? payload.content.replace(/\s/g, "") : undefined;
  if (sha !== expected.sha || size !== expected.size || rawContent === undefined) {
    invalidGitHubResponse();
  }
  if (!BASE64_PATTERN.test(rawContent)) invalidGitHubResponse();
  const content = Buffer.from(rawContent, "base64");
  if (content.byteLength !== expected.size) invalidGitHubResponse();
  const computedSha = gitBlobSha(content);
  if (computedSha !== expected.sha) invalidGitHubResponse();
  return content;
}

function gitBlobSha(content: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest("hex");
}

function hashTreeFiles(files: TreeFile[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath))) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.mode);
    hash.update("\0");
    hash.update(file.sha);
    hash.update("\0");
    hash.update(String(file.size));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((segment) => {
    if (
      segment.length === 0
      || segment === "."
      || segment === ".."
      || /[<>:"|?*\u0000-\u001f]/u.test(segment)
      || /[. ]$/u.test(segment)
      || WINDOWS_RESERVED_NAME.test(segment)
    ) return false;
    return true;
  });
}

function readSha(value: unknown): string | undefined {
  return typeof value === "string" && SHA_PATTERN.test(value) ? value : undefined;
}

function readSize(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function unsafeBundle(message: string): never {
  throw new SkillManagerError("MARKETPLACE_BUNDLE_UNSAFE", message);
}

function tooLarge(message: string): never {
  throw new SkillManagerError("MARKETPLACE_BUNDLE_TOO_LARGE", message);
}

function invalidGitHubResponse(): never {
  throw new MarketplaceResolverError(
    "INVALID_GITHUB_RESPONSE",
    "GitHub returned an unsupported response shape."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
