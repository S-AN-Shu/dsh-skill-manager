import { describe, expect, it, vi } from "vitest";

import { createGitHubMediaResolver } from "../src/index.js";

describe("GitHub media resolver", () => {
  it("loads a pinned same-repository raster image", async () => {
    const png = minimalPng(32, 18);
    const fetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(`https://raw.githubusercontent.com/openai/agent-skills/${"a".repeat(40)}/assets/preview.png`);
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    });
    const resolver = createGitHubMediaResolver({ fetch });

    const result = await resolver.resolveMedia({
      type: "repo-blob", repo: "github:openai/agent-skills", commit: "a".repeat(40), path: "assets/preview.png"
    });

    expect(result).toMatchObject({ mimeType: "image/png", width: 32, height: 18 });
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/u);
  });

  it("reuses the verified fixed-commit snapshot for repository images", async () => {
    const png = minimalPng(32, 18);
    const fetch = vi.fn();
    const snapshotCache = {
      withSnapshot: vi.fn(async (_repository, _signal, operation) => operation({
        repositoryPayload: {},
        commit: "a".repeat(40),
        tree: [],
        source: "codeload-cache" as const,
        readFile: vi.fn(async () => Buffer.from(png))
      }))
    };
    const resolver = createGitHubMediaResolver({ fetch, snapshotCache });

    const result = await resolver.resolveMedia({
      type: "repo-blob", repo: "github:openai/agent-skills", commit: "a".repeat(40), path: "assets/preview.png"
    });

    expect(result).toMatchObject({ mimeType: "image/png", width: 32, height: 18 });
    expect(snapshotCache.withSnapshot).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects arbitrary URLs, SVG, redirects, non-images, and oversized dimensions", async () => {
    const resolver = createGitHubMediaResolver({ fetch: vi.fn(async () => new Response("text", {
      status: 200, headers: { "content-type": "text/plain" }
    })) });
    await expect(resolver.resolveMedia({
      type: "repo-blob", repo: "https://evil.example/repo", commit: "a".repeat(40), path: "preview.png"
    } as never)).rejects.toMatchObject({ code: "INVALID_MARKETPLACE_ENTRY" });
    await expect(resolver.resolveMedia({
      type: "repo-blob", repo: "github:openai/agent-skills", commit: "a".repeat(40), path: "preview.svg"
    })).rejects.toMatchObject({ code: "INVALID_MARKETPLACE_ENTRY" });

    const huge = createGitHubMediaResolver({ fetch: vi.fn(async () => new Response(minimalPng(5_000, 5_000), {
      status: 200, headers: { "content-type": "image/png" }
    })) });
    await expect(huge.resolveMedia({
      type: "repo-blob", repo: "github:openai/agent-skills", commit: "a".repeat(40), path: "preview.png"
    })).rejects.toMatchObject({ code: "INVALID_GITHUB_RESPONSE" });
  });
});

function minimalPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes[16] = (width >>> 24) & 0xff; bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff; bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff; bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff; bytes[23] = height & 0xff;
  return bytes;
}
