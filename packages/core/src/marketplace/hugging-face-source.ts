import { Buffer } from "node:buffer";

import {
  MarketplaceSourceError,
  type MarketplaceEntry,
  type MarketplaceFetch,
  type MarketplaceSearchRequest,
  type MarketplaceSearchResult,
  type MarketplaceSource
} from "./types.js";

const MANIFEST_URL = "https://api.github.com/repos/huggingface/skills/contents/.claude-plugin/marketplace-internal.json?ref=main";
const REPOSITORY = "huggingface/skills";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 10_000;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface HuggingFaceMarketplaceSourceOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
}

export function createHuggingFaceMarketplaceSource(
  options: HuggingFaceMarketplaceSourceOptions = {}
): MarketplaceSource {
  const fetch = options.fetch ?? globalThis.fetch;
  if (typeof fetch !== "function") {
    throw new MarketplaceSourceError(
      "MARKETPLACE_FETCH_FAILED",
      "This runtime does not provide fetch."
    );
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  assertTimeout(timeoutMs);

  return {
    async search(request) {
      const query = normalizeQuery(request.query);
      const limit = normalizeLimit(request.limit);
      return searchWithDeadline(fetch, request, timeoutMs, query, limit);
    }
  };
}

async function searchWithDeadline(
  fetch: MarketplaceFetch,
  request: MarketplaceSearchRequest,
  timeoutMs: number,
  query: string,
  limit: number
): Promise<MarketplaceSearchResult> {
  if (request.signal?.aborted) aborted();
  const controller = new AbortController();
  let rejectBoundary: (error: MarketplaceSourceError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => { rejectBoundary = reject; });
  let timedOut = false;
  let callerAborted = false;
  const cancelFromCaller = () => {
    callerAborted = true;
    rejectBoundary(new MarketplaceSourceError(
      "MARKETPLACE_ABORTED",
      "Marketplace search was cancelled."
    ));
    controller.abort(request.signal?.reason);
  };
  request.signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectBoundary(new MarketplaceSourceError(
      "MARKETPLACE_TIMEOUT",
      `Hugging Face marketplace search exceeded ${timeoutMs} ms.`
    ));
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([
      fetchManifest(fetch, controller.signal, query, limit),
      boundary
    ]);
  } catch (error) {
    if (timedOut) {
      throw new MarketplaceSourceError(
        "MARKETPLACE_TIMEOUT",
        `Hugging Face marketplace search exceeded ${timeoutMs} ms.`,
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
      "Unable to reach the official Hugging Face Skill catalog.",
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function fetchManifest(
  fetch: MarketplaceFetch,
  signal: AbortSignal,
  query: string,
  limit: number
): Promise<MarketplaceSearchResult> {
  const response = await fetch(MANIFEST_URL, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "dsh-skill-manager"
    },
    signal
  });
  if (!response.ok) {
    throw new MarketplaceSourceError(
      "MARKETPLACE_HTTP_ERROR",
      `Hugging Face marketplace manifest failed with HTTP ${response.status}.`
    );
  }
  const manifest = await parseManifestResponse(response);
  const terms = query.toLocaleLowerCase().split(/\s+/u);
  const entries = manifest
    .filter((entry) => matches(entry, terms))
    .sort(compareEntries)
    .slice(0, limit);
  return {
    source: "hugging-face",
    query,
    returnedCount: entries.length,
    entries,
    sources: [{
      source: "hugging-face",
      status: "available",
      returnedCount: entries.length,
      error: null
    }]
  };
}

async function parseManifestResponse(response: Response): Promise<MarketplaceEntry[]> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    invalidResponse("GitHub returned malformed JSON for the Hugging Face manifest.", error);
  }
  if (!isRecord(payload) || payload.encoding !== "base64") {
    invalidResponse("Hugging Face manifest response has an unsupported shape.");
  }
  const content = readNonEmptyString(payload.content);
  if (content === undefined) invalidResponse("Hugging Face manifest response is missing content.");
  const encoded = content.replace(/\s/gu, "");
  if (!BASE64_PATTERN.test(encoded)) invalidResponse("Hugging Face manifest content is not valid base64.");

  let manifest: unknown;
  try {
    manifest = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch (error) {
    invalidResponse("Hugging Face marketplace manifest contains malformed JSON.", error);
  }
  if (
    !isRecord(manifest)
    || manifest.name !== "huggingface-skills"
    || !isRecord(manifest.owner)
    || manifest.owner.name !== "Hugging Face"
    || !Array.isArray(manifest.plugins)
  ) {
    invalidResponse("Hugging Face marketplace manifest has an unsupported schema.");
  }
  const entries: MarketplaceEntry[] = [];
  const names = new Set<string>();
  for (const plugin of manifest.plugins) {
    const entry = parsePlugin(plugin);
    if (names.has(entry.name)) invalidResponse("Hugging Face marketplace manifest contains duplicate Skills.");
    names.add(entry.name);
    entries.push(entry);
  }
  return entries;
}

function parsePlugin(value: unknown): MarketplaceEntry {
  if (!isRecord(value)) invalidResponse("Hugging Face marketplace manifest contains an invalid plugin.");
  const name = readNonEmptyString(value.name);
  const description = readNonEmptyString(value.description);
  const source = readNonEmptyString(value.source);
  if (
    name === undefined
    || description === undefined
    || source !== `./skills/${name}`
    || value.skills !== "./"
    || !SKILL_NAME.test(name)
  ) invalidResponse("Hugging Face marketplace manifest contains an invalid Skill entry.");
  const path = `skills/${name}`;
  const id = `${REPOSITORY}/${path}`;
  return {
    id,
    source: "hugging-face",
    catalogs: ["hugging-face"],
    name,
    description,
    publisher: {
      name: "Hugging Face",
      url: "https://huggingface.co"
    },
    author: null,
    repository: {
      host: "github",
      owner: "huggingface",
      name: "skills",
      path,
      url: "https://github.com/huggingface/skills"
    },
    skillUrl: `https://github.com/huggingface/skills/tree/main/${path}`,
    install: {
      kind: "github",
      repository: REPOSITORY,
      skill: name,
      path
    },
    metrics: {
      installs: null,
      stars: null,
      downloads: null
    },
    cover: {
      kind: "generated",
      seed: id
    }
  };
}

function matches(entry: MarketplaceEntry, terms: string[]): boolean {
  const haystack = `${entry.name} ${entry.description ?? ""}`.toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function compareEntries(left: MarketplaceEntry, right: MarketplaceEntry): number {
  return left.name.localeCompare(right.name);
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

function assertTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_TIMEOUT",
      "Marketplace timeout must be a positive integer in milliseconds."
    );
  }
}

function aborted(): never {
  throw new MarketplaceSourceError(
    "MARKETPLACE_ABORTED",
    "Marketplace search was cancelled."
  );
}

function invalidResponse(message: string, cause?: unknown): never {
  throw new MarketplaceSourceError(
    "INVALID_MARKETPLACE_RESPONSE",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
