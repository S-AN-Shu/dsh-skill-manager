import { describe, expect, it, vi } from "vitest";

import { createGitHubTrendingDiscovery, parseGitHubTrendingHtml } from "../src/index.js";

const WEEKLY_HTML = `
<article class="Box-row">
  <h2><a href="/acme/skill-tool">acme / skill-tool</a></h2>
  <p>Portable agent skills for teams.</p>
  <a href="/acme/skill-tool/stargazers">8,000 stars</a>
  <span>1,234 stars this week</span>
</article>
<article class="Box-row">
  <h2><a href="/acme/plain-repo">acme / plain-repo</a></h2>
  <p>A regular library.</p>
  <span>999 stars this week</span>
</article>`;

const MONTHLY_HTML = `
<article class="Box-row">
  <h2><a href="/acme/skill-tool">acme / skill-tool</a></h2>
  <p>Portable agent skills for teams.</p>
  <span>5,678 stars this month</span>
</article>`;

const WEEKLY_ONLY_HTML = `${WEEKLY_HTML}
<article class="Box-row">
  <h2><a href="/acme/prompt-kit">acme / prompt-kit</a></h2>
  <p>Prompt and agent utilities.</p>
  <span>4,321 stars this week</span>
</article>`;

function repositoryPayload() {
  return {
    id: 42,
    node_id: "R_skill",
    name: "skill-tool",
    full_name: "acme/skill-tool",
    description: "Portable agent skills for teams.",
    html_url: "https://github.com/acme/skill-tool",
    default_branch: "main",
    stargazers_count: 8000,
    forks_count: 100,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-17T00:00:00.000Z",
    pushed_at: "2026-08-17T00:00:00.000Z",
    topics: ["agent-skills", "coding"],
    archived: false,
    license: { spdx_id: "MIT" },
    owner: { id: 1, login: "acme", type: "Organization" }
  };
}

describe("GitHub Trending discovery", () => {
  it("keeps the default request alive beyond 12 seconds and times out at 25 seconds", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const discovery = createGitHubTrendingDiscovery({ fetch });
      let settled = false;
      const pending = discovery.browseTrending({ period: "monthly" }).finally(() => { settled = true; });

      await vi.advanceTimersByTimeAsync(12_000);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(13_000);
      const result = await pending;
      expect(result.sourceState).toBe("unavailable");
      expect(result.sourceMessage).toContain("25000 ms");
    } finally {
      vi.useRealTimers();
    }
  });

  it("parses weekly/monthly metrics and ignores non-Skill trending entries", () => {
    expect(parseGitHubTrendingHtml(WEEKLY_HTML, "weekly")).toEqual([{
      owner: "acme",
      name: "skill-tool",
      description: "Portable agent skills for teams.",
      stars: 8000,
      weeklyStars: 1234,
      monthlyStars: null
    }]);
    expect(parseGitHubTrendingHtml(MONTHLY_HTML, "monthly")[0]).toEqual(expect.objectContaining({
      owner: "acme", name: "skill-tool", monthlyStars: 5678
    }));
    expect(parseGitHubTrendingHtml("<article class=\"Box-row\"><a href=\"/x/y\">x</a></article>", "weekly")).toEqual([]);
    expect(parseGitHubTrendingHtml("x".repeat(2 * 1024 * 1024 + 1), "weekly")).toEqual([]);
  });

  it("keeps independent fresh/stale caches and never requests REST metadata, README, or Tree", async () => {
    let current = new Date("2026-08-18T00:00:00.000Z");
    let fail = false;
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (fail) throw new Error("network unavailable");
      if (url.endsWith("/trending?since=weekly")) return new Response(WEEKLY_HTML);
      if (url.endsWith("/trending?since=monthly")) return new Response(MONTHLY_HTML);
      throw new Error(`Unexpected URL: ${url}`);
    });
    const discovery = createGitHubTrendingDiscovery({
      fetch,
      now: () => current,
      timeoutMs: 500,
      cacheTtlMs: 30 * 60 * 1000,
      staleTtlMs: 24 * 60 * 60 * 1000
    });

    const live = await discovery.browseTrending({ period: "monthly" });
    expect(live.sourceState).toBe("live");
    expect(live.repositories[0]?.trend).toMatchObject({ weeklyStars: 1234, monthlyStars: 5678, stale: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([input]) => String(input)).join("\n")).not.toMatch(/api\.github\.com|readme|tree|blob/iu);

    current = new Date("2026-08-18T00:20:00.000Z");
    await discovery.browseTrending({ period: "monthly" });
    expect(fetch).toHaveBeenCalledTimes(2);

    fail = true;
    current = new Date("2026-08-18T01:00:00.000Z");
    const cached = await discovery.browseTrending({ period: "monthly" });
    expect(cached.sourceState).toBe("cached");
    expect(cached.repositories[0]?.trend?.stale).toBe(true);

    current = new Date("2026-08-19T02:00:00.000Z");
    const unavailable = await discovery.browseTrending({ period: "monthly" });
    expect(unavailable.sourceState).toBe("unavailable");
    expect(unavailable.repositories).toEqual([]);
    expect(unavailable.sourceMessage).toBeTruthy();
  });

  it("ranks monthly candidates first and appends weekly-only Skill candidates", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/trending?since=weekly")) return new Response(WEEKLY_ONLY_HTML);
      if (url.endsWith("/trending?since=monthly")) return new Response(MONTHLY_HTML);
      throw new Error(`Unexpected URL: ${url}`);
    });
    const discovery = createGitHubTrendingDiscovery({
      fetch,
      now: () => new Date("2026-08-18T00:00:00.000Z"),
      timeoutMs: 500
    });

    const result = await discovery.browseTrending({ period: "monthly" });

    expect(result.repositories.map((repository) => repository.fullName)).toEqual([
      "acme/skill-tool",
      "acme/prompt-kit"
    ]);
    expect(result.repositories[0]?.trend).toMatchObject({ weeklyStars: 1234, monthlyStars: 5678 });
    expect(result.repositories[1]?.trend).toMatchObject({ weeklyStars: 4321, monthlyStars: null });
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
      "https://github.com/trending?since=weekly",
      "https://github.com/trending?since=monthly"
    ]);
  });
});
