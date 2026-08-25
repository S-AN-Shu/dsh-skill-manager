import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  createGitHubMarketplaceResolver,
  MarketplaceResolverError,
  type MarketplaceEntry
} from "../src/index.js";

describe("GitHub marketplace resolver", () => {
  it("rejects an invalid resolution timeout during construction", () => {
    expect(() => createGitHubMarketplaceResolver({
      fetch: vi.fn(),
      timeoutMs: 0
    })).toThrowError(expect.objectContaining({
      name: "MarketplaceResolverError",
      code: "INVALID_MARKETPLACE_RESOLUTION_TIMEOUT"
    }));
  });

  it("pins and enriches a Skill after proving its exact repository path", async () => {
    const commitSha = "a".repeat(40);
    const blobSha = "b".repeat(40);
    const skillDocument = [
      "---",
      "name: react-guidance",
      "description: Production React architecture and performance guidance.",
      "metadata:",
      "  author: Jane Maintainer",
      "---",
      "",
      "# React guidance",
      ""
    ].join("\n");
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: 42,
        node_id: "R_example",
        default_branch: "main",
        stargazers_count: 900,
        html_url: "https://github.com/vercel-labs/agent-skills",
        owner: {
          login: "vercel-labs",
          html_url: "https://github.com/vercel-labs"
        }
      }))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "skills/react-guidance/SKILL.md",
          type: "blob",
          sha: blobSha
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        encoding: "base64",
        content: Buffer.from(skillDocument, "utf8").toString("base64")
      }));
    const resolver = createGitHubMarketplaceResolver({
      fetch,
      timeoutMs: 500,
      now: () => new Date("2026-08-16T12:00:00.000Z")
    });

    const resolved = await resolver.resolve(marketEntry());

    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.github.com/repos/vercel-labs/agent-skills",
      "https://api.github.com/repos/vercel-labs/agent-skills/commits/main",
      `https://api.github.com/repos/vercel-labs/agent-skills/git/trees/${commitSha}?recursive=1`,
      `https://api.github.com/repos/vercel-labs/agent-skills/git/blobs/${blobSha}`
    ]);
    expect(resolved).toMatchObject({
      id: "vercel-labs/agent-skills/react-guidance",
      description: "Production React architecture and performance guidance.",
      publisher: {
        name: "vercel-labs",
        url: "https://github.com/vercel-labs"
      },
      author: {
        name: "Jane Maintainer",
        url: null
      },
      repository: {
        host: "github",
        id: 42,
        nodeId: "R_example",
        owner: "vercel-labs",
        name: "agent-skills",
        path: "skills/react-guidance",
        url: "https://github.com/vercel-labs/agent-skills"
      },
      install: {
        kind: "github",
        repository: "vercel-labs/agent-skills",
        skill: "react-guidance",
        path: "skills/react-guidance"
      },
      metrics: {
        installs: { value: 123, source: "skills.sh" },
        stars: { value: 900, source: "github", scope: "repository" },
        downloads: null
      },
      snapshot: {
        commitSha,
        blobSha,
        fetchedAt: "2026-08-16T12:00:00.000Z"
      }
    });
  });

  it("honors a source-provided exact path when another same-name Skill exists", async () => {
    const commitSha = "a".repeat(40);
    const exactBlobSha = "b".repeat(40);
    const entry = marketEntry();
    entry.repository.path = "official/react-guidance";
    entry.install.path = "official/react-guidance";
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [
          { path: "other/react-guidance/SKILL.md", type: "blob", sha: "c".repeat(40) },
          { path: "official/react-guidance/SKILL.md", type: "blob", sha: exactBlobSha }
        ]
      }))
      .mockResolvedValueOnce(jsonResponse({
        encoding: "base64",
        content: Buffer.from([
          "---",
          "name: react-guidance",
          "description: Official exact-path guidance.",
          "---"
        ].join("\n"), "utf8").toString("base64")
      }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    const resolved = await resolver.resolve(entry);

    expect(resolved.install.path).toBe("official/react-guidance");
    expect(String(fetch.mock.calls[3]?.[0])).toContain(`/git/blobs/${exactBlobSha}`);
  });

  it("rejects a damaged base64 Skill blob", async () => {
    const commitSha = "a".repeat(40);
    const blobSha = "b".repeat(40);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{ path: "skills/react-guidance/SKILL.md", type: "blob", sha: blobSha }]
      }))
      .mockResolvedValueOnce(jsonResponse({ encoding: "base64", content: "%%%not-base64%%%" }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      name: "MarketplaceResolverError",
      code: "INVALID_GITHUB_RESPONSE"
    } satisfies Partial<MarketplaceResolverError>);
  });

  it("reports GitHub rate limiting separately from ordinary HTTP failures", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      message: "API rate limit exceeded"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-remaining": "0"
      }
    }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      name: "MarketplaceResolverError",
      code: "GITHUB_RATE_LIMITED"
    } satisfies Partial<MarketplaceResolverError>);
  });

  it("rejects truncated repository trees", async () => {
    const commitSha = "a".repeat(40);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({ truncated: true, tree: [] }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      code: "GITHUB_TREE_TRUNCATED"
    } satisfies Partial<MarketplaceResolverError>);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["missing", [], "GITHUB_SKILL_NOT_FOUND"],
    ["ambiguous", [
      { path: "skills/react-guidance/SKILL.md", type: "blob", sha: "b".repeat(40) },
      { path: "other/react-guidance/SKILL.md", type: "blob", sha: "c".repeat(40) }
    ], "GITHUB_SKILL_AMBIGUOUS"]
  ])("rejects a %s exact Skill path", async (_label, tree, code) => {
    const commitSha = "a".repeat(40);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects an exact-looking Skill path that is not a safe repository-relative path", async () => {
    const commitSha = "a".repeat(40);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "../react-guidance/SKILL.md",
          type: "blob",
          sha: "b".repeat(40)
        }]
      }));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      code: "INVALID_GITHUB_RESPONSE"
    } satisfies Partial<MarketplaceResolverError>);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects frontmatter whose name does not match the requested Skill", async () => {
    const fetch = resolverFetchForDocument([
      "---",
      "name: different-skill",
      "description: This is not the requested Skill.",
      "---"
    ].join("\n"));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      code: "INVALID_SKILL_DOCUMENT"
    } satisfies Partial<MarketplaceResolverError>);
  });

  it("reports ordinary GitHub HTTP failures without treating them as rate limits", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
      code: "GITHUB_HTTP_ERROR"
    } satisfies Partial<MarketplaceResolverError>);
  });

  it.each([
    ["unsafe owner", { repository: { owner: "../escape" } }],
    ["unsafe repository", { repository: { name: "repo/name" } }],
    ["unsafe Skill", { install: { skill: "../react-guidance" } }],
    ["unsafe exact path", {
      repository: { path: "../react-guidance" },
      install: { path: "../react-guidance" }
    }],
    ["mismatched exact path", {
      repository: { path: "skills/react-guidance" },
      install: { path: "other/react-guidance" }
    }],
    ["mismatched install repository", {
      install: { repository: "different-owner/different-repository" }
    }]
  ])("rejects an entry with %s before making a request", async (_label, override) => {
    const entry = marketEntry();
    if (override.repository !== undefined) {
      entry.repository = { ...entry.repository, ...override.repository };
    }
    if (override.install !== undefined) {
      entry.install = { ...entry.install, ...override.install };
    }
    const fetch = vi.fn();
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });

    await expect(resolver.resolve(entry)).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_ENTRY"
    } satisfies Partial<MarketplaceResolverError>);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("applies one overall deadline to the complete resolution", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 50 });
      const assertion = expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
        code: "MARKETPLACE_RESOLUTION_TIMEOUT"
      } satisfies Partial<MarketplaceResolverError>);

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a ten-second overall deadline by default", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const resolver = createGitHubMarketplaceResolver({ fetch });
      const assertion = expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
        code: "MARKETPLACE_RESOLUTION_TIMEOUT",
        message: "Marketplace resolution exceeded 10000 ms."
      } satisfies Partial<MarketplaceResolverError>);

      await vi.advanceTimersByTimeAsync(9_999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a deadline while reading a response body as a timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => new Promise<unknown>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          }, { once: true });
        })
      } as Response));
      const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 50 });
      const assertion = expect(resolver.resolve(marketEntry())).rejects.toMatchObject({
        code: "MARKETPLACE_RESOLUTION_TIMEOUT"
      } satisfies Partial<MarketplaceResolverError>);

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates caller cancellation to the active GitHub request", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const resolver = createGitHubMarketplaceResolver({ fetch, timeoutMs: 500 });
    const assertion = expect(resolver.resolve(marketEntry(), {
      signal: controller.signal
    })).rejects.toMatchObject({
      code: "MARKETPLACE_RESOLUTION_ABORTED"
    } satisfies Partial<MarketplaceResolverError>);

    controller.abort("user cancelled");

    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

function marketEntry(): MarketplaceEntry {
  return {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh",
    catalogs: ["skills-sh"],
    name: "React guidance",
    description: null,
    publisher: {
      name: "vercel-labs",
      url: "https://github.com/vercel-labs"
    },
    author: null,
    repository: {
      host: "github",
      owner: "vercel-labs",
      name: "agent-skills",
      path: null,
      url: "https://github.com/vercel-labs/agent-skills"
    },
    skillUrl: "https://skills.sh/vercel-labs/agent-skills/react-guidance",
    install: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      skill: "react-guidance",
      path: null
    },
    metrics: {
      installs: { value: 123, source: "skills.sh" },
      stars: null,
      downloads: null
    },
    cover: {
      kind: "generated",
      seed: "vercel-labs/agent-skills/react-guidance"
    }
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function repositoryPayload(): Record<string, unknown> {
  return {
    id: 42,
    node_id: "R_example",
    default_branch: "main",
    stargazers_count: 900,
    html_url: "https://github.com/vercel-labs/agent-skills",
    owner: {
      login: "vercel-labs",
      html_url: "https://github.com/vercel-labs"
    }
  };
}

function resolverFetchForDocument(document: string) {
  const commitSha = "a".repeat(40);
  const blobSha = "b".repeat(40);
  return vi.fn()
    .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
    .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
    .mockResolvedValueOnce(jsonResponse({
      truncated: false,
      tree: [{ path: "skills/react-guidance/SKILL.md", type: "blob", sha: blobSha }]
    }))
    .mockResolvedValueOnce(jsonResponse({
      encoding: "base64",
      content: Buffer.from(document, "utf8").toString("base64")
    }));
}

function abortablePendingFetch() {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>(
    (_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      }, { once: true });
    }
  ));
}
