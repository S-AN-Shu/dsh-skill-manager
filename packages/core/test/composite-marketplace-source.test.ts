import { describe, expect, it } from "vitest";

import {
  createCompositeMarketplaceSource,
  MarketplaceSourceError,
  type MarketplaceEntry,
  type MarketplaceSource,
  type MarketplaceSourceKind
} from "../src/index.js";

describe("composite marketplace source", () => {
  it("merges duplicate GitHub Skills deterministically and preserves all catalogs", async () => {
    const skillsShEntry = entry("skills-sh", {
      description: null,
      installPath: null,
      installs: 321
    });
    const githubEntry = entry("github", {
      description: null,
      installPath: "skills/react-guidance",
      installs: null,
      stars: 900
    });
    const huggingFaceEntry = entry("hugging-face", {
      description: "Official Hugging Face guidance.",
      installPath: "skills/react-guidance",
      installs: null
    });
    const source = createCompositeMarketplaceSource({
      sources: [
        child("skills-sh", [skillsShEntry]),
        child("github", [githubEntry]),
        child("hugging-face", [huggingFaceEntry])
      ]
    });

    const result = await source.search({ query: " react ", limit: 10 });

    expect(result).toMatchObject({
      source: "composite",
      query: "react",
      returnedCount: 1,
      sources: [
        { source: "skills-sh", status: "available", returnedCount: 1, error: null },
        { source: "github", status: "available", returnedCount: 1, error: null },
        { source: "hugging-face", status: "available", returnedCount: 1, error: null }
      ]
    });
    expect(result.entries[0]).toMatchObject({
      source: "skills-sh",
      catalogs: ["skills-sh", "github", "hugging-face"],
      description: "Official Hugging Face guidance.",
      repository: { path: "skills/react-guidance" },
      install: { path: "skills/react-guidance" },
      metrics: {
        installs: { value: 321, source: "skills.sh" },
        stars: { value: 900, source: "github", scope: "repository" }
      }
    });
  });

  it("keeps successful entries when one source fails", async () => {
    const unavailable: MarketplaceSource = {
      search: async () => {
        throw new MarketplaceSourceError("MARKETPLACE_TIMEOUT", "Hugging Face timed out.");
      }
    };
    const source = createCompositeMarketplaceSource({
      sources: [child("skills-sh", [entry("skills-sh")]), {
        kind: "hugging-face",
        source: unavailable
      }]
    });

    const result = await source.search({ query: "react" });

    expect(result.returnedCount).toBe(1);
    expect(result.sources[1]).toEqual({
      source: "hugging-face",
      status: "unavailable",
      returnedCount: 0,
      error: { code: "MARKETPLACE_TIMEOUT", message: "Hugging Face timed out." }
    });
  });

  it("returns explicit unavailable states when every source fails", async () => {
    const failed = (message: string): MarketplaceSource => ({
      search: async () => {
        throw new Error(message);
      }
    });
    const source = createCompositeMarketplaceSource({
      sources: [
        { kind: "skills-sh", source: failed("one") },
        { kind: "hugging-face", source: failed("two") }
      ]
    });

    const result = await source.search({ query: "react" });

    expect(result.entries).toEqual([]);
    expect(result.sources).toEqual([
      {
        source: "skills-sh",
        status: "unavailable",
        returnedCount: 0,
        error: {
          code: "MARKETPLACE_FETCH_FAILED",
          message: "Marketplace source failed unexpectedly."
        }
      },
      {
        source: "hugging-face",
        status: "unavailable",
        returnedCount: 0,
        error: {
          code: "MARKETPLACE_FETCH_FAILED",
          message: "Marketplace source failed unexpectedly."
        }
      }
    ]);
  });

  it("validates requests before invoking child sources", async () => {
    const source = createCompositeMarketplaceSource({
      sources: [child("skills-sh", [])]
    });

    await expect(source.search({ query: "x" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_QUERY"
    });
    await expect(source.search({ query: "react", limit: 201 })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_LIMIT"
    });
  });
});

function child(kind: MarketplaceSourceKind, entries: MarketplaceEntry[]) {
  return {
    kind,
    source: {
      search: async ({ query }: { query: string }) => ({
        source: kind,
        query: query.trim(),
        returnedCount: entries.length,
        entries,
        sources: [{
          source: kind,
          status: "available" as const,
          returnedCount: entries.length,
          error: null
        }]
      })
    }
  };
}

function entry(
  source: "skills-sh" | "github" | "hugging-face",
  options: {
    description?: string | null;
    installPath?: string | null;
    installs?: number | null;
    stars?: number | null;
  } = {}
): MarketplaceEntry {
  const path = options.installPath ?? null;
  return {
    id: `huggingface/skills/react-guidance-${source}`,
    source,
    catalogs: [source],
    name: "react-guidance",
    description: options.description ?? null,
    publisher: source === "hugging-face"
      ? { name: "Hugging Face", url: "https://huggingface.co" }
      : null,
    author: null,
    repository: {
      host: "github",
      owner: "huggingface",
      name: "skills",
      path,
      url: "https://github.com/huggingface/skills"
    },
    skillUrl: source === "skills-sh"
      ? "https://skills.sh/huggingface/skills/react-guidance"
      : "https://github.com/huggingface/skills/tree/main/skills/react-guidance",
    install: {
      kind: "github",
      repository: "huggingface/skills",
      skill: "react-guidance",
      path
    },
    metrics: {
      installs: options.installs === null || options.installs === undefined
        ? null
        : { value: options.installs, source: "skills.sh" },
      stars: options.stars === null || options.stars === undefined
        ? null
        : { value: options.stars, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: `huggingface/skills/react-guidance-${source}` }
  };
}
