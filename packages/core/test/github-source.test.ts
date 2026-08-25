import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGitHubMarketplaceSource,
  type MarketplaceSourceError
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("GitHub marketplace discovery source", () => {
  it("discovers exact Skill paths from bounded repository candidates", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.github.com/search/repositories?")) {
        return jsonResponse(searchPayload([repository("openai", "skills", 4200)]));
      }
      if (url === "https://api.github.com/repos/openai/skills/git/trees/main?recursive=1") {
        return jsonResponse(treePayload([
          { path: "skills/react-guidance/SKILL.md", type: "blob" },
          { path: "skills/react-guidance/examples/example.md", type: "blob" },
          { path: "AGENTS.md", type: "blob" }
        ]));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const source = createGitHubMarketplaceSource({ fetch, timeoutMs: 500 });

    const result = await source.search({ query: "react guidance", limit: 5 });

    const searchUrl = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(searchUrl.pathname).toBe("/search/repositories");
    expect(searchUrl.searchParams.get("q")).toBe("react guidance SKILL.md in:name,description,readme");
    expect(searchUrl.searchParams.get("per_page")).toBe("3");
    expect(result).toEqual({
      source: "github",
      query: "react guidance",
      returnedCount: 1,
      entries: [{
        id: "openai/skills/skills/react-guidance",
        source: "github",
        catalogs: ["github"],
        name: "react-guidance",
        description: null,
        publisher: { name: "openai", url: "https://github.com/openai" },
        author: null,
        repository: {
          host: "github",
          owner: "openai",
          name: "skills",
          path: "skills/react-guidance",
          url: "https://github.com/openai/skills"
        },
        skillUrl: "https://github.com/openai/skills/tree/main/skills/react-guidance",
        install: {
          kind: "github",
          repository: "openai/skills",
          skill: "react-guidance",
          path: "skills/react-guidance"
        },
        metrics: {
          installs: null,
          stars: { value: 4200, source: "github", scope: "repository" },
          downloads: null
        },
        cover: { kind: "generated", seed: "openai/skills/skills/react-guidance" }
      }],
      sources: [{ source: "github", status: "available", returnedCount: 1, error: null }]
    });
  });

  it("drops ambiguous same-name paths and truncated trees", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.github.com/search/repositories?")) {
        return jsonResponse(searchPayload([
          repository("one", "react-skills", 20),
          repository("two", "react-skill", 10)
        ]));
      }
      if (url.includes("/repos/one/react-skills/")) {
        return jsonResponse(treePayload([
          { path: "skills/react/SKILL.md", type: "blob" },
          { path: "legacy/react/SKILL.md", type: "blob" }
        ]));
      }
      return jsonResponse(treePayload([
        { path: "react/SKILL.md", type: "blob" }
      ], true));
    });
    const source = createGitHubMarketplaceSource({ fetch });

    const result = await source.search({ query: "react skill" });

    expect(result.entries).toEqual([]);
    expect(result.sources[0]).toMatchObject({ status: "available", returnedCount: 0 });
  });

  it("preserves entries while reporting incomplete GitHub search", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => String(input).includes("/search/")
      ? jsonResponse(searchPayload([repository("openai", "react-skill", 100)], true))
      : jsonResponse(treePayload([{ path: "skills/react-skill/SKILL.md", type: "blob" }])));
    const source = createGitHubMarketplaceSource({ fetch });

    const result = await source.search({ query: "react skill" });

    expect(result.entries).toHaveLength(1);
    expect(result.sources).toEqual([{
      source: "github",
      status: "unavailable",
      returnedCount: 1,
      error: {
        code: "GITHUB_SEARCH_INCOMPLETE",
        message: "GitHub returned incomplete repository search results."
      }
    }]);
  });

  it("rejects invalid configuration and requests before network access", async () => {
    const fetch = vi.fn();
    expect(() => createGitHubMarketplaceSource({ fetch, timeoutMs: 0 })).toThrowError(
      expect.objectContaining({ code: "INVALID_MARKETPLACE_TIMEOUT" })
    );
    expect(() => createGitHubMarketplaceSource({ fetch, repositoryLimit: 6 })).toThrowError(
      expect.objectContaining({ code: "INVALID_MARKETPLACE_LIMIT" })
    );
    const source = createGitHubMarketplaceSource({ fetch });
    await expect(source.search({ query: "x" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_QUERY"
    });
    await expect(source.search({ query: "react", limit: 201 })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_LIMIT"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [403, "GITHUB_RATE_LIMITED"],
    [429, "GITHUB_RATE_LIMITED"],
    [503, "MARKETPLACE_HTTP_ERROR"]
  ])("classifies GitHub HTTP %i", async (status, code) => {
    const source = createGitHubMarketplaceSource({
      fetch: vi.fn(async () => new Response(null, {
        status,
        headers: status === 403 ? { "x-ratelimit-remaining": "0" } : undefined
      }))
    });

    await expect(source.search({ query: "react" })).rejects.toMatchObject({ code });
  });

  it("rejects malformed repository and tree responses", async () => {
    const malformedSearch = createGitHubMarketplaceSource({
      fetch: vi.fn(async () => jsonResponse({ items: [] }))
    });
    await expect(malformedSearch.search({ query: "react" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_RESPONSE"
    } satisfies Partial<MarketplaceSourceError>);

    const malformedTree = createGitHubMarketplaceSource({
      fetch: vi.fn(async (input: string | URL | Request) => String(input).includes("/search/")
        ? jsonResponse(searchPayload([repository("openai", "skills", 1)]))
        : jsonResponse({ tree: [] }))
    });
    await expect(malformedTree.search({ query: "openai skill" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_RESPONSE"
    });
  });

  it("honors cancellation and deadline when transport ignores abort", async () => {
    const controller = new AbortController();
    const cancelled = createGitHubMarketplaceSource({
      fetch: vi.fn(() => new Promise<Response>(() => undefined)),
      timeoutMs: 500
    });
    const cancellation = expect(cancelled.search({ query: "react", signal: controller.signal }))
      .rejects.toMatchObject({ code: "MARKETPLACE_ABORTED" });
    controller.abort("cancelled");
    await cancellation;

    vi.useFakeTimers();
    const timed = createGitHubMarketplaceSource({
      fetch: vi.fn(() => new Promise<Response>(() => undefined)),
      timeoutMs: 50
    });
    const timeout = expect(timed.search({ query: "react" })).rejects.toMatchObject({
      code: "MARKETPLACE_TIMEOUT",
      message: "GitHub marketplace discovery exceeded 50 ms."
    });
    await vi.advanceTimersByTimeAsync(50);
    await timeout;
  });
});

function repository(owner: string, name: string, stars: number) {
  return {
    owner: { login: owner },
    name,
    full_name: `${owner}/${name}`,
    html_url: `https://github.com/${owner}/${name}`,
    description: `${name} agent skill collection`,
    default_branch: "main",
    stargazers_count: stars
  };
}

function searchPayload(items: unknown[], incomplete = false) {
  return { incomplete_results: incomplete, items };
}

function treePayload(tree: unknown[], truncated = false) {
  return { tree, truncated };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
