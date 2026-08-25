import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSkillsShMarketplaceSource,
  MarketplaceSourceError
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("skills.sh marketplace source", () => {
  it("normalizes official search results without inventing unavailable metadata", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      query: "react",
      searchType: "fuzzy",
      searchVersion: "legacy",
      skills: [{
        id: "vercel-labs/agent-skills/vercel-react-best-practices",
        skillId: "vercel-react-best-practices",
        name: "vercel-react-best-practices",
        installs: 635803,
        source: "vercel-labs/agent-skills"
      }],
      count: 1,
      duration_ms: 42
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const source = createSkillsShMarketplaceSource({ fetch, timeoutMs: 500 });

    const result = await source.search({ query: "  react  ", limit: 5 });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://skills.sh/api/search?q=react&limit=5");
    expect(init).toMatchObject({ method: "GET" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({
      source: "skills-sh",
      query: "react",
      returnedCount: 1,
      entries: [{
        id: "vercel-labs/agent-skills/vercel-react-best-practices",
        source: "skills-sh",
        catalogs: ["skills-sh"],
        name: "vercel-react-best-practices",
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
        skillUrl: "https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices",
        install: {
          kind: "github",
          repository: "vercel-labs/agent-skills",
          skill: "vercel-react-best-practices",
          path: null
        },
        metrics: {
          installs: {
            value: 635803,
            source: "skills.sh"
          },
          stars: null,
          downloads: null
        },
        cover: {
          kind: "generated",
          seed: "vercel-labs/agent-skills/vercel-react-best-practices"
        }
      }],
      sources: [{
        source: "skills-sh",
        status: "available",
        returnedCount: 1,
        error: null
      }]
    });
  });

  it("rejects unsupported queries, limits, and timeout settings before network access", async () => {
    const fetch = vi.fn();
    const source = createSkillsShMarketplaceSource({ fetch });

    await expect(source.search({ query: " x " })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_QUERY"
    });
    for (const limit of [0, 201, 1.5]) {
      await expect(source.search({ query: "react", limit })).rejects.toMatchObject({
        code: "INVALID_MARKETPLACE_LIMIT"
      });
    }
    expect(() => createSkillsShMarketplaceSource({ fetch, timeoutMs: 0 })).toThrowError(
      expect.objectContaining({ code: "INVALID_MARKETPLACE_TIMEOUT" })
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports non-success responses and malformed JSON with stable errors", async () => {
    const unavailable = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response(null, { status: 503 }))
    });
    await expect(unavailable.search({ query: "react" })).rejects.toMatchObject({
      code: "MARKETPLACE_HTTP_ERROR",
      message: "skills.sh search failed with HTTP 503."
    });

    const malformed = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response("{", { status: 200 }))
    });
    await expect(malformed.search({ query: "react" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_RESPONSE",
      message: "skills.sh returned malformed JSON."
    });
  });

  it("drops malformed and duplicate source entries", async () => {
    const valid = {
      id: "vercel-labs/agent-skills/react-guidance",
      skillId: "react-guidance",
      name: "React guidance",
      installs: 123,
      source: "vercel-labs/agent-skills"
    };
    const source = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        skills: [
          valid,
          { ...valid, id: "untrusted-id", name: "Duplicate" },
          { ...valid, source: "not-a-repository" },
          { ...valid, skillId: "../escape" },
          { ...valid, installs: -1 },
          null
        ]
      }), { status: 200 }))
    });

    const result = await source.search({ query: "react" });

    expect(result.returnedCount).toBe(1);
    expect(result.entries.map((entry) => entry.id)).toEqual([
      "vercel-labs/agent-skills/react-guidance"
    ]);
  });

  it("keeps the first leaderboard rank when upstream repeats a valid Skill", async () => {
    const first = {
      skillId: "react-guidance",
      name: "React guidance",
      installs: 500,
      source: "vercel-labs/agent-skills"
    };
    const second = {
      skillId: "story-writer",
      name: "Story writer",
      installs: 400,
      source: "huggingface/skills"
    };
    const source = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        page: 0,
        total: 3,
        hasMore: false,
        skills: [first, { ...first, installs: 450 }, second]
      }), { status: 200 }))
    });

    const result = await source.browse({ offset: 0, limit: 20 });

    expect(result.entries.map((entry) => entry.id)).toEqual([
      "vercel-labs/agent-skills/react-guidance",
      "huggingface/skills/story-writer"
    ]);
    expect(result.entries[0]?.metrics.installs?.value).toBe(500);
  });

  it("still rejects malformed leaderboard entries", async () => {
    const source = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        page: 0,
        total: 1,
        hasMore: false,
        skills: [{ skillId: "../escape", name: "Unsafe", installs: 1, source: "owner/repository" }]
      }), { status: 200 }))
    });

    await expect(source.browse()).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_RESPONSE",
      message: "skills.sh leaderboard contains an invalid Skill."
    });
  });

  it("skips well-formed leaderboard entries that are not GitHub-installable", async () => {
    const source = createSkillsShMarketplaceSource({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        page: 0,
        total: 2,
        hasMore: false,
        skills: [
          { skillId: "lark-doc", name: "Lark doc", installs: 500, source: "open.feishu.cn" },
          { skillId: "react-guidance", name: "React", installs: 400, source: "owner/repository" }
        ]
      }), { status: 200 }))
    });

    const result = await source.browse();

    expect(result.entries.map((entry) => entry.id)).toEqual(["owner/repository/react-guidance"]);
  });

  it("honors caller cancellation", async () => {
    const fetch = abortablePendingFetch();
    const source = createSkillsShMarketplaceSource({ fetch, timeoutMs: 500 });
    const controller = new AbortController();

    const pending = source.search({ query: "react", signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toEqual(expect.objectContaining({
      name: "MarketplaceSourceError",
      code: "MARKETPLACE_ABORTED"
    }));
  });

  it("aborts requests after the default ten-second deadline", async () => {
    vi.useFakeTimers();
    const fetch = abortablePendingFetch();
    const source = createSkillsShMarketplaceSource({ fetch });

    const pending = source.search({ query: "react" });
    const assertion = expect(pending).rejects.toEqual(expect.objectContaining({
      name: "MarketplaceSourceError",
      code: "MARKETPLACE_TIMEOUT",
      message: "skills.sh search exceeded 10000 ms."
    }));
    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
    const [, init] = fetch.mock.calls[0] ?? [];
    expect(init?.signal?.aborted).toBe(true);
  });
});

function abortablePendingFetch() {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })
  );
}
