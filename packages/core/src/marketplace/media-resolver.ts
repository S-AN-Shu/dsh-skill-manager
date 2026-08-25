import { Buffer } from "node:buffer";

import type { GitHubSnapshotCache } from "./github-snapshot-cache.js";
import { MarketplaceResolverError, type MarketplaceFetch, type MediaAsset, type MediaResolver, type MediaSource } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 4_096;
const MAX_PIXELS = 12_000_000;
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/iu;

export interface GitHubMediaResolverOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  snapshotCache?: GitHubSnapshotCache;
}

export function createGitHubMediaResolver(options: GitHubMediaResolverOptions = {}): MediaResolver {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_FETCH_FAILED", "This runtime does not provide fetch.");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceResolverError("INVALID_MARKETPLACE_RESOLUTION_TIMEOUT", "Media timeout must be a positive integer.");
  }
  return {
    resolveMedia: (source, request = {}) => resolveWithDeadline(
      fetch,
      source,
      request.signal,
      timeoutMs,
      options.snapshotCache
    )
  };
}

async function resolveWithDeadline(
  fetch: MarketplaceFetch,
  source: MediaSource,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  snapshotCache: GitHubSnapshotCache | undefined
): Promise<MediaAsset> {
  const url = sourceUrl(source);
  const controller = new AbortController();
  const cancel = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { bytes, declaredType } = await loadMediaBytes(fetch, source, url, controller.signal, snapshotCache);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) tooLarge();
    const image = parseImage(bytes);
    if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION || image.width * image.height > MAX_PIXELS) {
      throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Image dimensions exceed the media safety limit.");
    }
    if (declaredType !== undefined && declaredType.length > 0 && declaredType !== image.mimeType) {
      throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Image MIME type does not match its bytes.");
    }
    return {
      source,
      dataUrl: `data:${image.mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height
    };
  } catch (error) {
    if (error instanceof MarketplaceResolverError) throw error;
    if (callerSignal?.aborted) throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_ABORTED", "Media request was cancelled.");
    if (controller.signal.aborted) throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_TIMEOUT", `Media request exceeded ${timeoutMs} ms.`);
    throw new MarketplaceResolverError("MARKETPLACE_RESOLUTION_FETCH_FAILED", "Unable to load GitHub media.", { cause: error });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancel);
  }
}

async function loadMediaBytes(
  fetch: MarketplaceFetch,
  source: MediaSource,
  url: string,
  signal: AbortSignal,
  snapshotCache: GitHubSnapshotCache | undefined
): Promise<{ bytes: Uint8Array; declaredType?: string }> {
  if (source.type === "repo-blob" && snapshotCache !== undefined) {
    const repository = parseRepoKey(source.repo);
    try {
      const bytes = await snapshotCache.withSnapshot(repository, signal, async (snapshot) => {
        if (snapshot.commit !== source.commit) {
          throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Repository media commit is no longer current.");
        }
        return await snapshot.readFile(source.path);
      });
      return { bytes };
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "image/png,image/jpeg,image/gif,image/webp", "user-agent": "dsh-skill-manager" },
    redirect: "error",
    signal
  });
  if (!response.ok) throw new MarketplaceResolverError("GITHUB_HTTP_ERROR", `GitHub media request failed with HTTP ${response.status}.`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) tooLarge();
  const bytes = new Uint8Array(await response.arrayBuffer());
  const declaredType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase();
  return { bytes, ...(declaredType === undefined ? {} : { declaredType }) };
}

function sourceUrl(source: MediaSource): string {
  if (source.type === "generated") {
    throw new MarketplaceResolverError("INVALID_MARKETPLACE_ENTRY", "Generated covers do not require remote media resolution.");
  }
  if (source.type === "github-avatar") {
    assertRepositoryPart(source.owner);
    if (!Number.isSafeInteger(source.accountId) || source.accountId < 1) invalidSource();
    return `https://avatars.githubusercontent.com/u/${source.accountId}?s=128&v=4`;
  }
  const { owner, name: repository } = parseRepoKey(source.repo);
  if (source.type === "github-social-preview") {
    return `https://opengraph.githubassets.com/dsh-skill-manager/${owner}/${repository}`;
  }
  if (!SHA_PATTERN.test(source.commit) || !isSafePath(source.path) || /\.svg$/iu.test(source.path)) invalidSource();
  return `https://raw.githubusercontent.com/${owner}/${repository}/${source.commit}/${source.path.split("/").map(encodeURIComponent).join("/")}`;
}

function parseRepoKey(repo: string): { owner: string; name: string } {
  const match = /^github:([^/]+)\/(.+)$/u.exec(repo);
  if (match === null) invalidSource();
  const owner = match[1]!;
  const name = match[2]!;
  assertRepositoryPart(owner);
  assertRepositoryPart(name);
  return { owner, name };
}

function parseImage(bytes: Uint8Array): { mimeType: MediaAsset["mimeType"]; width: number; height: number } {
  if (bytes.length >= 24 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: "image/png", width: readU32(bytes, 16), height: readU32(bytes, 20) };
  }
  if (bytes.length >= 10 && Buffer.from(bytes.subarray(0, 3)).toString("ascii") === "GIF") {
    return { mimeType: "image/gif", width: readU16LE(bytes, 6), height: readU16LE(bytes, 8) };
  }
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 2)).equals(Buffer.from([0xff, 0xd8]))) {
    return parseJpeg(bytes);
  }
  if (bytes.length >= 30 && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") {
    return parseWebp(bytes);
  }
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Remote media is not a supported raster image.");
}

function parseJpeg(bytes: Uint8Array): { mimeType: "image/jpeg"; width: number; height: number } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { mimeType: "image/jpeg", height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!, width: (bytes[offset + 7]! << 8) | bytes[offset + 8]! };
    }
    offset += length + 2;
  }
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "JPEG dimensions could not be decoded.");
}

function parseWebp(bytes: Uint8Array): { mimeType: "image/webp"; width: number; height: number } {
  const kind = Buffer.from(bytes.subarray(12, 16)).toString("ascii");
  if (kind === "VP8X") return {
    mimeType: "image/webp",
    width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
    height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16)
  };
  throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Unsupported WebP dimensions.");
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}
function readU16LE(bytes: Uint8Array, offset: number): number { return bytes[offset]! | (bytes[offset + 1]! << 8); }
function assertRepositoryPart(value: string): void { if (!REPOSITORY_PART.test(value)) invalidSource(); }
function isSafePath(path: string): boolean { return !path.startsWith("/") && !path.includes("\\") && path.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."); }
function invalidSource(): never { throw new MarketplaceResolverError("INVALID_MARKETPLACE_ENTRY", "Media source is invalid or unsupported."); }
function tooLarge(): never { throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "Image exceeds the media byte limit."); }
