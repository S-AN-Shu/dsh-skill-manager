import { parse } from "yaml";

import {
  MarketplaceResolverError,
  type MarketplaceFetch,
  type MarketplaceParty,
  type MediaSource,
  type RepositoryCandidate,
  type RepositoryInspection,
  type RepositoryInspectionRequest,
  type RepositoryInspector,
  type SkillDescriptor
} from "./types.js";
import { classifySkill } from "./skill-classification.js";
import {
  createGitHubSnapshotCache,
  type GitHubPreparedSnapshot,
  type GitHubSnapshotCache
} from "./github-snapshot-cache.js";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_DOCUMENT_BYTES = 512 * 1024;
const DOCUMENT_CONCURRENCY = 3;
const TRANSIENT_RETRY_DELAYS_MS = [150, 300] as const;
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MANIFEST_PATHS = [
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  ".claude-plugin/plugin.json",
  "skills.json"
] as const;
const FORMAT_TOPICS = new Set(["agent-skills", "agent-skill", "claude-skills", "codex-skills"]);
const CATEGORY_TOPICS = new Set(["coding", "security", "design", "research", "writing", "game-development", "data-analysis"]);

export interface GitHubRepositoryInspectorOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  token?: string;
  now?: () => Date;
  cacheRoot?: string;
  snapshotCache?: GitHubSnapshotCache;
  refreshCommit?: boolean;
}

interface TreeBlob {
  path: string;
  sha: string;
  size: number;
}

interface TreeEntryLike {
  path: string;
  type: "blob" | "tree" | "commit";
  mode: string;
  sha: string;
  size: number;
}

interface ManifestSkillHint {
  category?: unknown;
  tags?: unknown;
}

export function createGitHubRepositoryInspector(
  options: GitHubRepositoryInspectorOptions = {}
): RepositoryInspector {
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
      "Repository inspection timeout must be a positive integer in milliseconds."
    );
  }
  const now = options.now ?? (() => new Date());
  const snapshotCache = options.snapshotCache ?? createGitHubSnapshotCache(options);
  return {
    inspectRepository(request) {
      assertRepository(request.repository);
      return withDeadline(request, timeoutMs, (signal) => inspect(
        snapshotCache,
        request,
        signal,
        now,
        options.refreshCommit === true
      ));
    }
  };
}

async function inspect(
  snapshotCache: GitHubSnapshotCache,
  request: RepositoryInspectionRequest,
  signal: AbortSignal,
  now: () => Date,
  refreshCommit: boolean
): Promise<RepositoryInspection> {
  const slug = `${request.repository.owner}/${request.repository.name}`;
  return await snapshotCache.withSnapshot(request.repository, signal, async (snapshot) => {
  const repository = parseRepository(snapshot.repositoryPayload, now().toISOString());
  if (repository.fullName !== slug) invalidResponse("GitHub repository identity changed during inspection.");
  const inspectionCommit = snapshot.commit;
  const tree = snapshot.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size }));
  const byPath = new Map(tree.map((blob) => [blob.path, blob]));
  const readmeBlob = tree.find((blob) => /^[^/]*readme(?:\.[^/]*)?$/iu.test(blob.path));
  const manifestBlobs = MANIFEST_PATHS.map((path) => byPath.get(path)).filter((blob): blob is TreeBlob => blob !== undefined);
  const skillBlobs = tree.filter((blob) => blob.path === "SKILL.md" || blob.path.endsWith("/SKILL.md"));

  const documentBlobs = [
    ...(readmeBlob === undefined ? [] : [{ kind: "readme" as const, blob: readmeBlob }]),
    ...manifestBlobs.map((blob) => ({ kind: "manifest" as const, blob })),
    ...skillBlobs.map((blob) => ({ kind: "skill" as const, blob }))
  ];
  const documents = await mapConcurrent(documentBlobs, DOCUMENT_CONCURRENCY, async (document) => ({
    ...document,
    content: await readSnapshotTextWithRetry(snapshot, document.blob, signal)
  }));
  const readmeDocument = documents.find((document) => document.kind === "readme")?.content ?? null;
  const manifestDocuments = documents.filter((document) => document.kind === "manifest");
  const skillDocuments = documents.filter((document) => document.kind === "skill");

  const declaredSkillPaths = new Set<string>();
  const explicitMediaPaths = new Set<string>();
  const declaredResourceFiles = new Map<string, Set<string>>();
  const manifestHints = new Map<string, ManifestSkillHint>();
  const warnings: string[] = [];
  for (const manifest of manifestDocuments) {
    try {
      const parsed = JSON.parse(manifest.content);
      collectManifestPaths(parsed, declaredSkillPaths, explicitMediaPaths);
      collectManifestResourceFiles(parsed, declaredResourceFiles);
      collectManifestHints(parsed, manifestHints);
    } catch {
      warnings.push(`${manifest.blob.path} 不是有效 JSON，已忽略其中的发现线索。`);
    }
  }

  const skills: SkillDescriptor[] = [];
  for (const document of skillDocuments) {
    const descriptor = parseSkillDescriptor(
      repository,
      inspectionCommit,
      document.blob,
      document.content,
      resolveManifestFiles(document.blob.path, declaredResourceFiles, byPath, warnings),
      manifestHints.get(document.blob.path === "SKILL.md" ? "." : document.blob.path.slice(0, -"/SKILL.md".length)),
      summarizeReadme(readmeDocument),
      snapshot.tree
    );
    if (descriptor !== null) skills.push(descriptor);
  }
  skills.sort((left, right) => left.path.localeCompare(right.path));
  for (const declared of declaredSkillPaths) {
    const normalized = normalizeSkillPath(declared);
    if (normalized === undefined) {
      warnings.push(`manifest 声明了不安全的 Skill 路径：${declared}`);
      continue;
    }
    if (!skills.some((skill) => skill.path === normalized)) {
      warnings.push(`manifest 声明的 ${normalized} 未找到有效 SKILL.md。`);
    }
  }

  const media = collectMedia(repository.repoKey, inspectionCommit, tree, readmeDocument, explicitMediaPaths);
  return {
    repository: { ...repository, knownSkillCount: skills.length },
    inspectionCommit,
    inspectedAt: now().toISOString(),
    status: skills.length > 0 ? "structure-verified" : "inspected",
    readme: readmeBlob === undefined || readmeDocument === null ? null : {
      path: readmeBlob.path,
      title: /^#\s+(.+)$/mu.exec(readmeDocument)?.[1]?.trim() ?? null,
      content: readmeDocument,
      blobSha: readmeBlob.sha
    },
    manifestPaths: manifestBlobs.map((blob) => blob.path),
    declaredSkillPaths: [...declaredSkillPaths].map((path) => normalizeSkillPath(path) ?? path),
    skills,
    media,
    warnings
  };
  }, { refreshCommit });
}

function parseSkillDescriptor(
  repository: RepositoryCandidate,
  commit: string,
  blob: TreeBlob,
  document: string,
  manifestFiles: string[],
  manifestHint: ManifestSkillHint | undefined,
  readmeSummary: string | null,
  repositoryTree: readonly TreeEntryLike[]
): SkillDescriptor | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(document);
  if (match === null) return null;
  let frontmatter: unknown;
  try { frontmatter = parse(match[1] ?? ""); } catch { return null; }
  if (!isRecord(frontmatter)) return null;
  const name = readString(frontmatter.name);
  const description = readString(frontmatter.description);
  if (name === undefined || description === undefined || !SKILL_NAME.test(name)) return null;
  const path = blob.path === "SKILL.md" ? "." : blob.path.slice(0, -"/SKILL.md".length);
  const finalSegment = path === "." ? name : path.split("/").at(-1);
  const warnings: string[] = [];
  const installable = validateSkillBoundary(path, repositoryTree, warnings);
  const frontmatterRecord = frontmatter as Record<string, unknown>;
  const metadata = isRecord(frontmatterRecord.metadata) ? frontmatterRecord.metadata : {};
  const frontmatterClassification = {
    category: frontmatterRecord.category ?? metadata.category,
    tags: frontmatterRecord.tags ?? metadata.tags
  };
  return {
    skillKey: `github:${repository.fullName}#${path}` as SkillDescriptor["skillKey"],
    repositoryId: repository.repositoryId,
    path,
    name,
    description,
    classification: classifySkill({
      name,
      description,
      readmeSummary,
      topics: repository.topics,
      frontmatter: frontmatterClassification,
      manifest: manifestHint
    }),
    author: parseAuthor(frontmatter),
    structureStatus: "structure-verified",
    validatedAtCommit: commit,
    skillDocumentBlobSha: blob.sha,
    manifestFiles,
    installable,
    warnings
  };
}

function validateSkillBoundary(path: string, tree: readonly TreeEntryLike[], warnings: string[]): boolean {
  const prefix = path === "." ? "" : `${path}/`;
  let installable = true;
  for (const entry of tree) {
    if (entry.path === "AGENTS.md" || entry.path === "CLAUDE.md" || entry.path.endsWith("/AGENTS.md") || entry.path.endsWith("/CLAUDE.md")) continue;
    if (path !== "." && entry.path !== path && !entry.path.startsWith(prefix)) continue;
    if (path === "." && !isRootBundlePath(entry.path)) continue;
    if (entry.type === "tree" && entry.mode === "040000") continue;
    if (entry.type !== "blob" || (entry.mode !== "100644" && entry.mode !== "100755")) {
      installable = false;
      warnings.push(`Skill bundle 包含不支持的 ${entry.type} 条目：${entry.path}`);
    }
  }
  return installable;
}

function isRootBundlePath(path: string): boolean {
  return path === "SKILL.md" || path.startsWith("scripts/") || path.startsWith("references/") || path.startsWith("assets/");
}

function parseAuthor(frontmatter: Record<string, unknown>): MarketplaceParty | null {
  if (!isRecord(frontmatter.metadata)) return null;
  const name = readString(frontmatter.metadata.author);
  return name === undefined ? null : { name, url: null };
}

function collectManifestPaths(
  value: unknown,
  skillPaths: Set<string>,
  mediaPaths: Set<string>,
  key = ""
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectManifestPaths(item, skillPaths, mediaPaths, key);
    return;
  }
  if (!isRecord(value)) return;
  for (const [childKey, child] of Object.entries(value)) {
    const normalizedKey = childKey.toLocaleLowerCase();
    if (typeof child === "string") {
      if (normalizedKey === "path" && /skill/iu.test(key)) skillPaths.add(child);
      if (/^(?:logo|screenshot|screenshots|image|images)$/u.test(normalizedKey)) mediaPaths.add(child);
      continue;
    }
    collectManifestPaths(child, skillPaths, mediaPaths, `${key}/${normalizedKey}`);
  }
}

function collectManifestHints(
  value: unknown,
  hints: Map<string, ManifestSkillHint>,
  key = ""
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectManifestHints(item, hints, key);
    return;
  }
  if (!isRecord(value)) return;
  const rawPath = typeof value.path === "string" && /skill/iu.test(key) ? value.path : undefined;
  if (rawPath !== undefined) {
    const normalizedPath = normalizeSkillPath(rawPath);
    if (normalizedPath !== undefined) {
      hints.set(normalizedPath, { category: value.category, tags: value.tags });
    }
  }
  for (const [childKey, child] of Object.entries(value)) {
    collectManifestHints(child, hints, `${key}/${childKey.toLocaleLowerCase()}`);
  }
}

function collectManifestResourceFiles(
  value: unknown,
  declarations: Map<string, Set<string>>,
  key = ""
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectManifestResourceFiles(item, declarations, key);
    return;
  }
  if (!isRecord(value)) return;
  const rawPath = typeof value.path === "string" && /skill/iu.test(key) ? value.path : undefined;
  const skillPath = rawPath === undefined ? undefined : normalizeSkillPath(rawPath);
  if (skillPath !== undefined) {
    const files = declarations.get(skillPath) ?? new Set<string>();
    for (const resourceKey of ["files", "resources", "include", "includes"] as const) {
      collectStringValues(value[resourceKey], files);
    }
    if (files.size > 0) declarations.set(skillPath, files);
  }
  for (const [childKey, child] of Object.entries(value)) {
    collectManifestResourceFiles(child, declarations, `${key}/${childKey.toLocaleLowerCase()}`);
  }
}

function collectStringValues(value: unknown, output: Set<string>): void {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, output);
  }
}

function resolveManifestFiles(
  skillDocumentPath: string,
  declarations: Map<string, Set<string>>,
  byPath: Map<string, TreeBlob>,
  warnings: string[]
): string[] {
  const skillPath = skillDocumentPath === "SKILL.md"
    ? "."
    : skillDocumentPath.slice(0, -"/SKILL.md".length);
  if (skillPath !== ".") return [];
  const files: string[] = [];
  for (const declared of declarations.get(skillPath) ?? []) {
    const normalized = normalizeRepositoryPath(declared.trim().replace(/^\.\//u, ""));
    if (normalized === undefined || /^(?:AGENTS|CLAUDE)\.md$/iu.test(normalized)) {
      warnings.push(`manifest 声明了不可导入的根目录资源：${declared}`);
      continue;
    }
    if (!byPath.has(normalized)) {
      warnings.push(`manifest 声明的根目录资源不存在：${normalized}`);
      continue;
    }
    if (normalized !== "SKILL.md") files.push(normalized);
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function collectMedia(
  repo: RepositoryCandidate["repoKey"],
  commit: string,
  tree: TreeBlob[],
  readme: string | null,
  explicit: Set<string>
): MediaSource[] {
  const treePaths = new Set(tree.map((item) => item.path));
  const paths = new Set<string>();
  for (const path of explicit) {
    const normalized = normalizeRepositoryPath(path);
    if (normalized !== undefined && treePaths.has(normalized) && isRasterImage(normalized)) paths.add(normalized);
  }
  if (readme !== null) {
    for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
      const raw = match[1];
      if (raw === undefined || /^https?:/iu.test(raw)) continue;
      const normalized = normalizeRepositoryPath(raw.replace(/^\.\//u, ""));
      if (normalized !== undefined && treePaths.has(normalized) && isRasterImage(normalized)) paths.add(normalized);
    }
  }
  const media: MediaSource[] = [...paths].slice(0, 8).map((path) => ({
    type: "repo-blob",
    repo,
    commit,
    path
  }));
  media.push({ type: "github-social-preview", repo });
  return media;
}

function parseRepository(payload: unknown, discoveredAt: string): RepositoryCandidate {
  if (!isRecord(payload) || !isRecord(payload.owner)) invalidResponse("GitHub returned an invalid repository.");
  const repositoryId = readInteger(payload.id);
  const nodeId = readString(payload.node_id);
  const owner = readString(payload.owner.login);
  const ownerId = readInteger(payload.owner.id);
  const ownerType = payload.owner.type === "Organization" ? "Organization"
    : payload.owner.type === "Bot" ? "Bot" : payload.owner.type === "User" ? "User" : undefined;
  const name = readString(payload.name);
  const fullName = readString(payload.full_name);
  const url = readHttpsUrl(payload.html_url);
  const defaultBranch = readString(payload.default_branch);
  const stars = readInteger(payload.stargazers_count);
  const forks = readInteger(payload.forks_count);
  const createdAt = readDate(payload.created_at);
  const updatedAt = readDate(payload.updated_at);
  const pushedAt = readDate(payload.pushed_at);
  const description = payload.description === null || typeof payload.description === "string" ? payload.description : undefined;
  const archived = typeof payload.archived === "boolean" ? payload.archived : undefined;
  const topics = Array.isArray(payload.topics)
    ? payload.topics.map(readString).filter((topic): topic is string => topic !== undefined).map((topic) => topic.toLocaleLowerCase())
    : [];
  if (repositoryId === undefined || nodeId === undefined || ownerId === undefined || owner === undefined || ownerType === undefined
    || name === undefined || fullName !== `${owner}/${name}` || url !== `https://github.com/${fullName}`
    || defaultBranch === undefined || stars === undefined || forks === undefined || createdAt === undefined || updatedAt === undefined
    || pushedAt === undefined || description === undefined || archived === undefined) {
    invalidResponse("GitHub returned an invalid repository.");
  }
  const repoKey = `github:${fullName}` as RepositoryCandidate["repoKey"];
  const formatTopics = topics.filter((topic) => FORMAT_TOPICS.has(topic));
  return {
    repositoryId, nodeId, repoKey, host: "github", owner, ownerId, ownerType,
    ownerAvatar: { type: "github-avatar", owner, accountId: ownerId }, name, fullName, description, url,
    defaultBranch, stars, forks, createdAt, updatedAt, pushedAt, topics,
    formatTopics, categoryTopics: topics.filter((topic) => CATEGORY_TOPICS.has(topic)), archived,
    license: isRecord(payload.license) ? readString(payload.license.spdx_id) ?? null : null,
    knownSkillCount: null,
    classification: classifySkill({ name, description, topics }),
    trend: null,
    cover: { type: "generated", seed: repoKey },
    discovery: {
      signals: formatTopics.map((topic) => ({ source: "github", kind: "format-topic", label: `Topic: ${topic}` })),
      discoveredAt
    }
  };
}

async function readSnapshotText(
  snapshot: GitHubPreparedSnapshot,
  blob: TreeBlob,
): Promise<string> {
  if (blob.size > MAX_DOCUMENT_BYTES) {
    throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", `${blob.path} exceeds the inspection size limit.`);
  }
  const content = await snapshot.readFile(blob.path);
  if (content.byteLength !== blob.size) {
    invalidResponse(`GitHub returned bytes that do not match the fixed Tree for ${blob.path}.`);
  }
  return content.toString("utf8");
}

async function readSnapshotTextWithRetry(
  snapshot: GitHubPreparedSnapshot,
  blob: TreeBlob,
  signal: AbortSignal
): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await readSnapshotText(snapshot, blob);
    } catch (error) {
      const delay = TRANSIENT_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || signal.aborted || !isTransientTransportError(error)) throw error;
      await waitForRetry(delay, signal);
    }
  }
}

async function mapConcurrent<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>
): Promise<Output[]> {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("Repository inspection was cancelled."));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Repository inspection was cancelled."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isTransientTransportError(error: unknown, depth = 0): boolean {
  if (depth > 4 || error instanceof MarketplaceResolverError || !isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code !== undefined && new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EPIPE",
    "UND_ERR_CONNECT_TIMEOUT"
  ]).has(code)) return true;
  return "cause" in error && isTransientTransportError(error.cause, depth + 1);
}

async function withDeadline<T>(
  request: RepositoryInspectionRequest,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (request.signal?.aborted) aborted();
  const controller = new AbortController();
  let rejectBoundary: (error: MarketplaceResolverError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => { rejectBoundary = reject; });
  let timedOut = false;
  let callerAborted = false;
  const cancel = () => {
    callerAborted = true;
    controller.abort(request.signal?.reason);
    rejectBoundary(new MarketplaceResolverError("MARKETPLACE_RESOLUTION_ABORTED", "Repository inspection was cancelled."));
  };
  request.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      `Repository inspection exceeded ${timeoutMs} ms.`
    ));
  }, timeoutMs);
  try { return await Promise.race([operation(controller.signal), boundary]); }
  catch (error) {
    if (timedOut) throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      `Repository inspection exceeded ${timeoutMs} ms.`,
      { cause: error }
    );
    if (callerAborted || request.signal?.aborted) throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Repository inspection was cancelled.",
      { cause: error }
    );
    if (error instanceof MarketplaceResolverError) throw error;
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_FETCH_FAILED",
      "Unable to inspect the GitHub repository.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", cancel);
  }
}

function normalizeSkillPath(value: string): string | undefined {
  const path = value.trim().replace(/^\.\//u, "").replace(/\/$/u, "");
  if (path === "." || path.length === 0) return ".";
  return normalizeRepositoryPath(path);
}

function normalizeRepositoryPath(value: string): string | undefined {
  if (value.length === 0 || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return undefined;
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..") ? value : undefined;
}

function isRasterImage(path: string): boolean {
  return /\.(?:png|jpe?g|webp|gif)$/iu.test(path);
}

function summarizeReadme(readme: string | null): string | null {
  if (readme === null) return null;
  const summary = readme
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/[#>*`]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return summary.length > 2_000 ? summary.slice(0, 2_000) : summary;
}

function assertRepository(repository: { owner: string; name: string }): void {
  if (!REPOSITORY_PART.test(repository.owner) || !REPOSITORY_PART.test(repository.name)) {
    throw new MarketplaceResolverError("INVALID_MARKETPLACE_ENTRY", "Repository identity is invalid.");
  }
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function readHttpsUrl(value: unknown): string | undefined {
  const text = readString(value);
  if (text === undefined) return undefined;
  try { return new URL(text).protocol === "https:" ? text : undefined; } catch { return undefined; }
}

function readDate(value: unknown): string | undefined {
  const text = readString(value);
  return text !== undefined && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function aborted(): never {
  throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_ABORTED", "Repository inspection was cancelled.");
}

function invalidResponse(message: string): never {
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
