import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { unzipSync } from "fflate";

import { MarketplaceResolverError, type MarketplaceFetch } from "./types.js";

const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_CODELOAD_ROOT = "https://codeload.github.com";
const GITHUB_RAW_ROOT = "https://raw.githubusercontent.com";
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 50 * 1024 * 1024;
const MAX_CACHE_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 5_000;
const MAX_EXPANSION_RATIO = 200;
const CACHE_TTL_MS = 60 * 60 * 1_000;
const RESOLUTION_TTL_MS = CACHE_TTL_MS;
const SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/u;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const METADATA_FILE = "snapshot.json";

export interface GitHubSnapshotTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  mode: string;
  sha: string;
  size: number;
}

export interface GitHubPreparedSnapshot {
  repositoryPayload: unknown;
  commit: string;
  tree: GitHubSnapshotTreeEntry[];
  source: "codeload-cache" | "raw-fallback";
  fallbackReason?: { code: string; message: string };
  readFile(path: string): Promise<Buffer>;
}

export interface GitHubSnapshotCache {
  withSnapshot<T>(
    repository: { owner: string; name: string },
    signal: AbortSignal,
    operation: (snapshot: GitHubPreparedSnapshot) => Promise<T>,
    options?: { refreshCommit?: boolean }
  ): Promise<T>;
}

export interface GitHubSnapshotCacheOptions {
  fetch?: MarketplaceFetch;
  cacheRoot?: string;
  token?: string;
  now?: () => Date;
}

interface Resolution {
  repositoryPayload: unknown;
  commit: string;
  tree: GitHubSnapshotTreeEntry[];
  resolvedAt: number;
}

interface CachedSnapshotMetadata {
  schemaVersion: 1;
  key: string;
  commit: string;
  createdAt: string;
  lastAccessedAt: string;
  sizeBytes: number;
  files: Array<{ path: string; sha: string; size: number; mode: string }>;
}

interface PreparedContent {
  source: "codeload-cache" | "raw-fallback";
  sizeBytes: number;
  fallbackReason?: { code: string; message: string };
  readFile(path: string, signal: AbortSignal): Promise<Buffer>;
}

export function createGitHubSnapshotCache(
  options: GitHubSnapshotCacheOptions = {}
): GitHubSnapshotCache {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_FETCH_FAILED", "This runtime does not provide fetch.");
  }
  const cacheRoot = options.cacheRoot === undefined ? undefined : resolve(options.cacheRoot);
  const token = normalizeToken(options.token);
  const now = options.now ?? (() => new Date());
  const resolutions = new Map<string, Resolution>();
  const resolving = new Map<string, Promise<Resolution>>();
  const preparing = new Map<string, Promise<PreparedContent>>();
  const memorySnapshots = new Map<string, { content: PreparedContent; accessedAt: number }>();
  const activeKeys = new Map<string, number>();
  let initialized = false;
  let initializing: Promise<void> | undefined;
  let cleaning: Promise<void> | undefined;

  return {
    async withSnapshot(repository, signal, operation, requestOptions = {}) {
      assertRepository(repository);
      const slug = `${repository.owner}/${repository.name}`;
      const resolution = await resolveRepository(slug, signal, requestOptions.refreshCommit === true);
      const key = `github:${slug}@${resolution.commit}`;
      while (cleaning !== undefined) await raceAbort(cleaning, signal);
      retain(key);
      try {
        const content = await prepareContent(slug, key, resolution, signal);
        return await operation({
          repositoryPayload: resolution.repositoryPayload,
          commit: resolution.commit,
          tree: resolution.tree,
          source: content.source,
          ...(content.fallbackReason === undefined ? {} : { fallbackReason: content.fallbackReason }),
          readFile: (path) => content.readFile(path, signal)
        });
      } finally {
        release(key);
        scheduleCleanup();
      }
    }
  };

  async function resolveRepository(slug: string, signal: AbortSignal, refresh: boolean): Promise<Resolution> {
    const current = resolutions.get(slug);
    if (!refresh && current !== undefined && now().getTime() - current.resolvedAt <= RESOLUTION_TTL_MS) return current;
    const existing = resolving.get(slug);
    if (existing !== undefined) return await raceAbort(existing, signal);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const pending = (async () => {
      const repositoryPayload = await getJson(fetch, `${GITHUB_API_ROOT}/repos/${slug}`, controller.signal, token);
      const defaultBranch = readDefaultBranch(repositoryPayload);
      const commitPayload = await getJson(
        fetch,
        `${GITHUB_API_ROOT}/repos/${slug}/commits/${encodeURIComponent(defaultBranch)}`,
        controller.signal,
        token
      );
      const commit = readCommit(commitPayload);
      const treePayload = await getJson(
        fetch,
        `${GITHUB_API_ROOT}/repos/${slug}/git/trees/${commit}?recursive=1`,
        controller.signal,
        token
      );
      const tree = parseTree(treePayload);
      const resolution = { repositoryPayload, commit, tree, resolvedAt: now().getTime() };
      resolutions.set(slug, resolution);
      return resolution;
    })().finally(() => clearTimeout(timer));
    resolving.set(slug, pending);
    void pending.then(() => {
      if (resolving.get(slug) === pending) resolving.delete(slug);
    }, () => {
      if (resolving.get(slug) === pending) resolving.delete(slug);
    });
    return await raceAbort(pending, signal);
  }

  async function prepareContent(
    slug: string,
    key: string,
    resolution: Resolution,
    signal: AbortSignal
  ): Promise<PreparedContent> {
    if (cacheRoot !== undefined) {
      await initializeCache(cacheRoot);
      const cached = await loadCachedSnapshot(
        cacheRoot,
        key,
        resolution,
        now(),
        (activeKeys.get(key) ?? 0) > 1
      );
      if (cached !== null) return cached;
    }
    const memory = memorySnapshots.get(key);
    if (memory !== undefined) {
      memory.accessedAt = now().getTime();
      return memory.content;
    }
    const existing = preparing.get(key);
    if (existing !== undefined) return await raceAbort(existing, signal);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    retain(key);
    const pending = (async (): Promise<PreparedContent> => {
      try {
        const files = await downloadAndVerifyArchive(fetch, slug, resolution, controller.signal);
        if (cacheRoot === undefined) return rememberMemory(key, memoryContent(files));
        return await storeSnapshot(cacheRoot, key, resolution, files, now());
      } catch (error) {
        return rawContent(fetch, slug, resolution, fallbackReason(error));
      }
    })().finally(() => {
      clearTimeout(timer);
      release(key);
      scheduleCleanup();
    });
    preparing.set(key, pending);
    void pending.then(() => {
      if (preparing.get(key) === pending) preparing.delete(key);
    }, () => {
      if (preparing.get(key) === pending) preparing.delete(key);
    });
    return await raceAbort(pending, signal);
  }

  function rememberMemory(key: string, content: PreparedContent): PreparedContent {
    if (content.source !== "codeload-cache" || content.sizeBytes > MAX_CACHE_BYTES) return content;
    const timestamp = now().getTime();
    for (const [candidateKey, candidate] of memorySnapshots) {
      if (timestamp - candidate.accessedAt > CACHE_TTL_MS) memorySnapshots.delete(candidateKey);
    }
    let total = [...memorySnapshots.values()].reduce((sum, candidate) => sum + candidate.content.sizeBytes, 0);
    for (const [candidateKey, candidate] of [...memorySnapshots.entries()]
      .sort(([, left], [, right]) => left.accessedAt - right.accessedAt)) {
      if (total + content.sizeBytes <= MAX_CACHE_BYTES) break;
      memorySnapshots.delete(candidateKey);
      total -= candidate.content.sizeBytes;
    }
    if (total + content.sizeBytes <= MAX_CACHE_BYTES) {
      memorySnapshots.set(key, { content, accessedAt: timestamp });
    }
    return content;
  }

  async function initializeCache(root: string): Promise<void> {
    if (initialized) return;
    if (initializing !== undefined) return await initializing;
    const pending = (async () => {
      await mkdir(join(root, ".staging"), { recursive: true });
      await mkdir(join(root, "snapshots"), { recursive: true });
      for (const entry of await safeReadDirectory(join(root, ".staging"))) {
        await rm(join(root, ".staging", entry), { recursive: true, force: true });
      }
      await cleanupCache(root, activeKeys, now().getTime());
      initialized = true;
    })();
    initializing = pending;
    try {
      await pending;
    } finally {
      if (initializing === pending) initializing = undefined;
    }
  }

  function retain(key: string): void {
    activeKeys.set(key, (activeKeys.get(key) ?? 0) + 1);
  }

  function release(key: string): void {
    const remaining = (activeKeys.get(key) ?? 1) - 1;
    if (remaining <= 0) activeKeys.delete(key); else activeKeys.set(key, remaining);
  }

  function scheduleCleanup(): void {
    if (cacheRoot === undefined || !initialized || cleaning !== undefined) return;
    const pending = cleanupCache(cacheRoot, activeKeys, now().getTime())
      .catch(() => undefined)
      .finally(() => {
        if (cleaning === pending) cleaning = undefined;
      });
    cleaning = pending;
  }
}

async function downloadAndVerifyArchive(
  fetch: MarketplaceFetch,
  slug: string,
  resolution: Resolution,
  signal: AbortSignal
): Promise<Map<string, Buffer>> {
  const response = await fetch(`${GITHUB_CODELOAD_ROOT}/${slug}/zip/${resolution.commit}`, {
    method: "GET",
    headers: { accept: "application/zip", "user-agent": "dsh-skill-manager" },
    redirect: "error",
    signal
  });
  if (!response.ok) {
    throw new MarketplaceResolverError("GITHUB_HTTP_ERROR", `GitHub codeload request failed with HTTP ${response.status}.`);
  }
  const archive = await readBoundedResponse(response, MAX_ARCHIVE_BYTES, "GitHub repository ZIP exceeds the compressed size limit.");
  const entries = parseCentralDirectory(archive);
  validateArchiveEntries(entries, archive.byteLength);
  let unzipped: Record<string, Uint8Array>;
  try { unzipped = unzipSync(archive); } catch (error) {
    throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid repository ZIP.", { cause: error });
  }
  validateUnzippedFiles(unzipped);
  const tree = new Map(resolution.tree.map((entry) => [entry.path, entry]));
  const files = new Map<string, Buffer>();
  let rootName: string | undefined;
  for (const [archivePath, bytes] of Object.entries(unzipped)) {
    if (archivePath.endsWith("/")) continue;
    const normalized = normalizeArchivePath(archivePath);
    const [root, ...segments] = normalized.split("/");
    if (rootName === undefined) rootName = root;
    if (root !== rootName || segments.length === 0) invalidArchive("Repository ZIP has an invalid root directory.");
    const path = segments.join("/");
    const expected = tree.get(path);
    if (expected === undefined || expected.type !== "blob") invalidArchive(`Repository ZIP contains unexpected file ${path}.`);
    // Codeload represents Git symlinks as archive entries containing their target.
    // They are never extracted or exposed; bundle validation still rejects a
    // symlink when it falls inside the selected Skill boundary.
    if (expected.mode !== "100644" && expected.mode !== "100755") continue;
    const content = Buffer.from(bytes);
    if (content.byteLength !== expected.size || gitBlobSha(content) !== expected.sha) {
      invalidArchive(`Repository ZIP does not match the fixed Tree for ${path}.`);
    }
    files.set(path, content);
  }
  for (const entry of resolution.tree) {
    if (entry.type === "blob" && (entry.mode === "100644" || entry.mode === "100755") && !files.has(entry.path)) {
      invalidArchive(`Repository ZIP is missing fixed Tree file ${entry.path}.`);
    }
  }
  return files;
}

function memoryContent(files: Map<string, Buffer>): PreparedContent {
  return {
    source: "codeload-cache",
    sizeBytes: [...files.values()].reduce((total, content) => total + content.byteLength, 0),
    async readFile(path) {
      const content = files.get(path);
      if (content === undefined) missingFile(path);
      return Buffer.from(content);
    }
  };
}

function rawContent(
  fetch: MarketplaceFetch,
  slug: string,
  resolution: Resolution,
  reason: { code: string; message: string }
): PreparedContent {
  const tree = new Map(resolution.tree.map((entry) => [entry.path, entry]));
  return {
    source: "raw-fallback",
    sizeBytes: 0,
    fallbackReason: reason,
    async readFile(path, signal) {
      const expected = tree.get(path);
      if (expected === undefined || expected.type !== "blob" || (expected.mode !== "100644" && expected.mode !== "100755")) {
        missingFile(path);
      }
      if (expected.size > MAX_FILE_BYTES) {
        throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", `${path} exceeds the repository file size limit.`);
      }
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const controller = new AbortController();
      const cancel = () => controller.abort(signal.reason);
      signal.addEventListener("abort", cancel, { once: true });
      const timer = setTimeout(() => controller.abort(), 25_000);
      let response: Response;
      try {
        response = await fetch(`${GITHUB_RAW_ROOT}/${slug}/${resolution.commit}/${encodedPath}`, {
          method: "GET",
          headers: { accept: "application/octet-stream", "user-agent": "dsh-skill-manager" },
          redirect: "error",
          signal: controller.signal
        });
        if (!response.ok) {
          if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
            throw new MarketplaceResolverError("GITHUB_RATE_LIMITED", "GitHub content rate limit was exceeded.");
          }
          throw new MarketplaceResolverError("GITHUB_HTTP_ERROR", `GitHub content request failed with HTTP ${response.status} for ${path}.`);
        }
        const content = await readBoundedResponse(response, MAX_FILE_BYTES, `${path} exceeds the repository file size limit.`);
        if (content.byteLength !== expected.size || gitBlobSha(content) !== expected.sha) {
          invalidArchive(`GitHub returned bytes that do not match the fixed Tree for ${path}.`);
        }
        return content;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
      }
    }
  };
}

function fallbackReason(error: unknown): { code: string; message: string } {
  if (error instanceof MarketplaceResolverError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) return { code: "ARCHIVE_PREPARATION_FAILED", message: error.message };
  return { code: "ARCHIVE_PREPARATION_FAILED", message: "Repository ZIP preparation failed." };
}

async function storeSnapshot(
  root: string,
  key: string,
  resolution: Resolution,
  files: Map<string, Buffer>,
  now: Date
): Promise<PreparedContent> {
  const id = createHash("sha256").update(key).digest("hex");
  const staging = join(root, ".staging", `${id}-${randomUUID()}`);
  const target = join(root, "snapshots", id);
  const contentRoot = join(staging, "content");
  const metadata: CachedSnapshotMetadata = {
    schemaVersion: 1,
    key,
    commit: resolution.commit,
    createdAt: now.toISOString(),
    lastAccessedAt: now.toISOString(),
    sizeBytes: 0,
    files: []
  };
  const tree = new Map(resolution.tree.map((entry) => [entry.path, entry]));
  await mkdir(contentRoot, { recursive: true });
  try {
    for (const [path, content] of files) {
      const destination = safeCachePath(contentRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content);
      metadata.sizeBytes += content.byteLength;
      const mode = tree.get(path)?.mode;
      if (mode !== "100644" && mode !== "100755") invalidArchive(`Repository cache mode is invalid for ${path}.`);
      metadata.files.push({ path, sha: gitBlobSha(content), size: content.byteLength, mode });
    }
    await writeFile(join(staging, METADATA_FILE), JSON.stringify(metadata), "utf8");
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return diskContent(target, metadata);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function loadCachedSnapshot(
  root: string,
  key: string,
  resolution: Resolution,
  now: Date,
  protectedByOtherLease: boolean
): Promise<PreparedContent | null> {
  const id = createHash("sha256").update(key).digest("hex");
  const directory = join(root, "snapshots", id);
  try {
    const metadata = parseMetadata(JSON.parse(await readFile(join(directory, METADATA_FILE), "utf8")));
    if (metadata.key !== key || metadata.commit !== resolution.commit || !metadataMatchesResolution(metadata, resolution)) {
      return null;
    }
    const accessedAt = Date.parse(metadata.lastAccessedAt);
    if (now.getTime() - accessedAt > CACHE_TTL_MS && !protectedByOtherLease) {
      await rm(directory, { recursive: true, force: true });
      return null;
    }
    metadata.lastAccessedAt = now.toISOString();
    await writeFile(join(directory, METADATA_FILE), JSON.stringify(metadata), "utf8");
    return diskContent(directory, metadata);
  } catch {
    return null;
  }
}

function metadataMatchesResolution(metadata: CachedSnapshotMetadata, resolution: Resolution): boolean {
  const expected = resolution.tree.filter((entry) => entry.type === "blob"
    && (entry.mode === "100644" || entry.mode === "100755"));
  if (metadata.files.length !== expected.length) return false;
  const files = new Map(metadata.files.map((file) => [file.path, file]));
  return expected.every((entry) => {
    const file = files.get(entry.path);
    return file !== undefined && file.sha === entry.sha && file.size === entry.size && file.mode === entry.mode;
  });
}

function diskContent(directory: string, metadata: CachedSnapshotMetadata): PreparedContent {
  const files = new Map(metadata.files.map((file) => [file.path, file]));
  const contentRoot = join(directory, "content");
  return {
    source: "codeload-cache",
    sizeBytes: metadata.sizeBytes,
    async readFile(path) {
      const expected = files.get(path);
      if (expected === undefined) missingFile(path);
      const content = await readFile(safeCachePath(contentRoot, path));
      if (content.byteLength !== expected.size || gitBlobSha(content) !== expected.sha) {
        invalidArchive(`Cached repository bytes are invalid for ${path}.`);
      }
      return content;
    }
  };
}

async function cleanupCache(root: string, active: Map<string, number>, now: number): Promise<void> {
  const snapshotsRoot = join(root, "snapshots");
  const entries: Array<{ directory: string; metadata: CachedSnapshotMetadata; accessedAt: number }> = [];
  for (const name of await safeReadDirectory(snapshotsRoot)) {
    const directory = join(snapshotsRoot, name);
    try {
      const metadata = parseMetadata(JSON.parse(await readFile(join(directory, METADATA_FILE), "utf8")));
      const accessedAt = Date.parse(metadata.lastAccessedAt);
      if (!active.has(metadata.key) && (!Number.isFinite(accessedAt) || now - accessedAt > CACHE_TTL_MS)) {
        await rm(directory, { recursive: true, force: true });
      } else {
        entries.push({ directory, metadata, accessedAt });
      }
    } catch {
      await rm(directory, { recursive: true, force: true });
    }
  }
  let total = entries.reduce((sum, entry) => sum + entry.metadata.sizeBytes, 0);
  for (const entry of entries.sort((left, right) => left.accessedAt - right.accessedAt)) {
    if (total <= MAX_CACHE_BYTES) break;
    if (active.has(entry.metadata.key)) continue;
    await rm(entry.directory, { recursive: true, force: true });
    total -= entry.metadata.sizeBytes;
  }
}

interface ZipEntry { name: string; compressedSize: number; originalSize: number; compression: number; flags: number }

function parseCentralDirectory(bytes: Buffer): ZipEntry[] {
  const minimum = Math.max(0, bytes.byteLength - 65_558);
  let end = bytes.byteLength - 22;
  while (end >= minimum) {
    if (bytes.readUInt32LE(end) === 0x06054b50
      && end + 22 + bytes.readUInt16LE(end + 20) === bytes.byteLength) break;
    end -= 1;
  }
  if (end < minimum) invalidArchive("Repository ZIP has no valid central directory.");
  const disk = bytes.readUInt16LE(end + 4);
  const centralDisk = bytes.readUInt16LE(end + 6);
  const diskEntryCount = bytes.readUInt16LE(end + 8);
  const entryCount = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount) {
    invalidArchive("Multi-disk repository ZIP archives are not supported.");
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    invalidArchive("ZIP64 repository archives are not supported.");
  }
  if (centralOffset + centralSize > end || centralOffset > bytes.byteLength) {
    invalidArchive("Repository ZIP central directory is out of bounds.");
  }
  const entries: ZipEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || bytes.readUInt32LE(offset) !== 0x02014b50) {
      invalidArchive("Repository ZIP central directory is invalid.");
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const originalSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.byteLength) invalidArchive("Repository ZIP entry name is invalid.");
    entries.push({
      name: bytes.subarray(nameStart, nameEnd).toString((flags & 0x800) === 0 ? "latin1" : "utf8"),
      compressedSize,
      originalSize,
      compression,
      flags
    });
    offset = nameEnd + extraLength + commentLength;
    if (offset > centralOffset + centralSize) invalidArchive("Repository ZIP central directory is invalid.");
  }
  if (offset !== centralOffset + centralSize) invalidArchive("Repository ZIP central directory size is invalid.");
  return entries;
}

function validateArchiveEntries(entries: ZipEntry[], archiveBytes: number): void {
  if (entries.length > MAX_FILE_COUNT) invalidArchive("Repository ZIP contains too many entries.");
  let extractedBytes = 0;
  const comparablePaths = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeArchivePath(entry.name);
    const comparable = normalized.toLocaleLowerCase();
    if (comparablePaths.has(comparable)) invalidArchive(`Repository ZIP contains a duplicate path ${entry.name}.`);
    comparablePaths.add(comparable);
    if ((entry.flags & 1) !== 0) invalidArchive("Encrypted repository ZIP entries are not supported.");
    if (entry.compression !== 0 && entry.compression !== 8) invalidArchive("Repository ZIP uses an unsupported compression method.");
    if (entry.originalSize > MAX_FILE_BYTES) invalidArchive(`Repository ZIP file ${entry.name} exceeds the file size limit.`);
    extractedBytes += entry.originalSize;
    if (extractedBytes > MAX_EXTRACTED_BYTES) invalidArchive("Repository ZIP exceeds the extracted size limit.");
  }
  if (archiveBytes > 0 && extractedBytes / archiveBytes > MAX_EXPANSION_RATIO) {
    invalidArchive("Repository ZIP exceeds the allowed compression expansion ratio.");
  }
}

function validateUnzippedFiles(files: Record<string, Uint8Array>): void {
  const entries = Object.entries(files);
  if (entries.length > MAX_FILE_COUNT) invalidArchive("Repository ZIP contains too many extracted entries.");
  let extractedBytes = 0;
  for (const [path, content] of entries) {
    normalizeArchivePath(path);
    if (content.byteLength > MAX_FILE_BYTES) invalidArchive(`Repository ZIP file ${path} exceeds the file size limit.`);
    extractedBytes += content.byteLength;
    if (extractedBytes > MAX_EXTRACTED_BYTES) invalidArchive("Repository ZIP exceeds the extracted size limit.");
  }
}

function normalizeArchivePath(value: string): string {
  if (value.length === 0 || value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
    invalidArchive("Repository ZIP contains an unsafe path.");
  }
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  if (normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    invalidArchive("Repository ZIP contains an unsafe path.");
  }
  return normalized;
}

function parseTree(payload: unknown): GitHubSnapshotTreeEntry[] {
  if (!isRecord(payload) || payload.truncated !== false || !Array.isArray(payload.tree)) {
    if (isRecord(payload) && payload.truncated === true) {
      throw new MarketplaceResolverError("GITHUB_TREE_TRUNCATED", "GitHub returned a truncated repository tree.");
    }
    invalidArchive("GitHub returned an unsupported repository tree.");
  }
  const tree: GitHubSnapshotTreeEntry[] = [];
  for (const item of payload.tree) {
    if (!isRecord(item) || (item.type !== "blob" && item.type !== "tree" && item.type !== "commit")) continue;
    const path = typeof item.path === "string" ? item.path : undefined;
    const mode = typeof item.mode === "string" ? item.mode : undefined;
    const sha = typeof item.sha === "string" ? item.sha : undefined;
    const size = typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size >= 0 ? item.size : 0;
    if (path === undefined || mode === undefined || sha === undefined || !SHA_PATTERN.test(sha) || !isSafeRepositoryPath(path)) continue;
    tree.push({ path, mode, sha: sha.toLocaleLowerCase(), size, type: item.type });
  }
  return tree;
}

async function getJson(
  fetch: MarketplaceFetch,
  url: string,
  signal: AbortSignal,
  token: string | undefined
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "dsh-skill-manager",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` })
    },
    signal
  });
  if (!response.ok) {
    if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
      throw new MarketplaceResolverError("GITHUB_RATE_LIMITED", "GitHub API rate limit was exceeded.");
    }
    throw new MarketplaceResolverError("GITHUB_HTTP_ERROR", `GitHub request failed with HTTP ${response.status}.`);
  }
  try { return await response.json(); } catch (error) {
    throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "GitHub returned malformed JSON.", { cause: error });
  }
}

async function readBoundedResponse(response: Response, limit: number, message: string): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) invalidArchive(message);
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        invalidArchive(message);
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}

function parseMetadata(value: unknown): CachedSnapshotMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.key !== "string" || !SHA_PATTERN.test(String(value.commit))
    || typeof value.createdAt !== "string" || typeof value.lastAccessedAt !== "string"
    || typeof value.sizeBytes !== "number" || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 0
    || value.sizeBytes > MAX_EXTRACTED_BYTES || !Array.isArray(value.files) || value.files.length > MAX_FILE_COUNT
    || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.lastAccessedAt))) {
    invalidArchive("Cached repository snapshot metadata is invalid.");
  }
  const comparablePaths = new Set<string>();
  let sizeBytes = 0;
  const files = value.files.map((file) => {
    if (!isRecord(file) || typeof file.path !== "string" || !isSafeRepositoryPath(file.path)
      || typeof file.sha !== "string" || !SHA_PATTERN.test(file.sha)
      || typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES
      || (file.mode !== "100644" && file.mode !== "100755")) invalidArchive("Cached repository snapshot metadata is invalid.");
    const comparable = file.path.toLocaleLowerCase();
    if (comparablePaths.has(comparable)) invalidArchive("Cached repository snapshot metadata is invalid.");
    comparablePaths.add(comparable);
    sizeBytes += file.size;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes > MAX_EXTRACTED_BYTES) {
      invalidArchive("Cached repository snapshot metadata is invalid.");
    }
    return { path: file.path, sha: file.sha, size: file.size, mode: file.mode };
  });
  if (sizeBytes !== value.sizeBytes) invalidArchive("Cached repository snapshot metadata is invalid.");
  return {
    schemaVersion: 1,
    key: value.key,
    commit: String(value.commit),
    createdAt: value.createdAt,
    lastAccessedAt: value.lastAccessedAt,
    sizeBytes: value.sizeBytes,
    files
  };
}

function readDefaultBranch(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.default_branch !== "string" || payload.default_branch.trim().length === 0) {
    invalidArchive("GitHub returned an invalid default branch.");
  }
  return payload.default_branch.trim();
}

function readCommit(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.sha !== "string" || !SHA_PATTERN.test(payload.sha)) {
    invalidArchive("GitHub returned an invalid commit.");
  }
  return payload.sha.toLocaleLowerCase();
}

function safeCachePath(root: string, path: string): string {
  if (!isSafeRepositoryPath(path)) invalidArchive("Repository cache path is unsafe.");
  const target = resolve(root, ...path.split("/"));
  const prefix = resolve(root) + sep;
  if (!target.startsWith(prefix)) invalidArchive("Repository cache path escaped its root.");
  return target;
}

function gitBlobSha(content: Uint8Array): string {
  return createHash("sha1").update(`blob ${content.byteLength}\0`).update(content).digest("hex");
}

function isSafeRepositoryPath(path: string): boolean {
  return path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0")
    && path.split("/").every((segment) => segment.length > 0
      && segment !== "."
      && segment !== ".."
      && !/[<>:"|?*\u0000-\u001f]/u.test(segment)
      && !/[. ]$/u.test(segment)
      && !WINDOWS_RESERVED_NAME.test(segment));
}

function assertRepository(repository: { owner: string; name: string }): void {
  if (!REPOSITORY_PART.test(repository.owner) || !REPOSITORY_PART.test(repository.name)) {
    throw new MarketplaceResolverError("INVALID_MARKETPLACE_ENTRY", "Repository identity is invalid.");
  }
}

function normalizeToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token ? token : undefined;
}

async function safeReadDirectory(path: string): Promise<string[]> {
  try { return await readdir(path); } catch { return []; }
}

async function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new Error("Repository snapshot was cancelled.");
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Repository snapshot was cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function missingFile(path: string): never {
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", `Repository snapshot does not contain ${path}.`);
}

function invalidArchive(message: string): never {
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
