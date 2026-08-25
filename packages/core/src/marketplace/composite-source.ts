import {
  MarketplaceSourceError,
  type MarketplaceEntry,
  type MarketplaceSearchRequest,
  type MarketplaceSearchResult,
  type MarketplaceSource,
  type MarketplaceSourceKind,
  type MarketplaceSourceStatus
} from "./types.js";

export interface CompositeMarketplaceSourceOptions {
  sources: ReadonlyArray<{
    kind: MarketplaceSourceKind;
    source: MarketplaceSource;
  }>;
}

export function createCompositeMarketplaceSource(
  options: CompositeMarketplaceSourceOptions
): MarketplaceSource {
  if (options.sources.length === 0) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_RESPONSE",
      "Composite marketplace requires at least one source."
    );
  }
  return {
    async search(request) {
      validateRequest(request);
      const settled = await Promise.all(options.sources.map((child) => settleSource(child, request)));
      const sources: MarketplaceSourceStatus[] = [];
      const entries = new Map<string, MarketplaceEntry>();
      for (const result of settled) {
        sources.push(result.status);
        for (const entry of result.entries) {
          const identity = entryIdentity(entry);
          const existing = entries.get(identity);
          entries.set(identity, existing === undefined ? entry : mergeEntry(existing, entry));
        }
      }
      const limit = request.limit ?? 20;
      const merged = [...entries.values()]
        .sort(compareEntries)
        .slice(0, limit);
      return {
        source: "composite",
        query: request.query.trim(),
        returnedCount: merged.length,
        entries: merged,
        sources
      } satisfies MarketplaceSearchResult;
    }
  };
}

async function settleSource(
  child: CompositeMarketplaceSourceOptions["sources"][number],
  request: MarketplaceSearchRequest
): Promise<{ status: MarketplaceSourceStatus; entries: MarketplaceEntry[] }> {
  try {
    const result = await child.source.search(request);
    const status = result.sources[0];
    if (status === undefined || result.sources.length !== 1 || status.source !== child.kind) {
      throw new MarketplaceSourceError(
        "INVALID_MARKETPLACE_RESPONSE",
        "A composite child source returned an unsupported status set."
      );
    }
    return { status, entries: result.entries };
  } catch (error) {
    const normalized = error instanceof MarketplaceSourceError
      ? error
      : new MarketplaceSourceError(
        "MARKETPLACE_FETCH_FAILED",
        "Marketplace source failed unexpectedly.",
        { cause: error }
      );
    return {
      status: {
        source: child.kind,
        status: "unavailable",
        returnedCount: 0,
        error: { code: normalized.code, message: normalized.message }
      },
      entries: []
    };
  }
}

function validateRequest(request: MarketplaceSearchRequest): void {
  if (request.signal?.aborted) {
    throw new MarketplaceSourceError("MARKETPLACE_ABORTED", "Marketplace search was cancelled.");
  }
  if (request.query.trim().length < 2) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_QUERY",
      "Marketplace search queries must contain at least two characters."
    );
  }
  const limit = request.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new MarketplaceSourceError(
      "INVALID_MARKETPLACE_LIMIT",
      "Marketplace search limit must be an integer from 1 to 200."
    );
  }
}

function entryIdentity(entry: MarketplaceEntry): string {
  return `${entry.repository.owner.toLocaleLowerCase()}/${entry.repository.name.toLocaleLowerCase()}/${entry.install.skill.toLocaleLowerCase()}`;
}

function mergeEntry(left: MarketplaceEntry, right: MarketplaceEntry): MarketplaceEntry {
  const primary = left.source === "skills-sh" ? left : right.source === "skills-sh" ? right : left;
  const secondary = primary === left ? right : left;
  return {
    ...primary,
    catalogs: uniqueCatalogs([...left.catalogs, ...right.catalogs]),
    description: primary.description ?? secondary.description,
    publisher: primary.publisher ?? secondary.publisher,
    author: primary.author ?? secondary.author,
    repository: {
      ...primary.repository,
      path: primary.repository.path ?? secondary.repository.path
    },
    install: {
      ...primary.install,
      path: primary.install.path ?? secondary.install.path
    },
    metrics: {
      installs: primary.metrics.installs ?? secondary.metrics.installs,
      stars: primary.metrics.stars ?? secondary.metrics.stars,
      downloads: primary.metrics.downloads ?? secondary.metrics.downloads
    }
  };
}

function uniqueCatalogs(values: readonly MarketplaceSourceKind[]): MarketplaceSourceKind[] {
  return [...new Set(values)].sort((left, right) => catalogOrder(left) - catalogOrder(right));
}

function catalogOrder(value: MarketplaceSourceKind): number {
  if (value === "skills-sh") return 0;
  if (value === "github") return 1;
  return 2;
}

function compareEntries(left: MarketplaceEntry, right: MarketplaceEntry): number {
  const leftInstalls = left.metrics.installs?.value ?? -1;
  const rightInstalls = right.metrics.installs?.value ?? -1;
  return rightInstalls - leftInstalls || left.name.localeCompare(right.name);
}
