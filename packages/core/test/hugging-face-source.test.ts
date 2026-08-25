import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createHuggingFaceMarketplaceSource,
  type MarketplaceSourceError
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Hugging Face marketplace source", () => {
  it("parses the official curated manifest and searches name and description", async () => {
    const fetch = vi.fn(async () => manifestResponse([
      plugin("audio-craft", "Create and analyze audio with Hugging Face models."),
      plugin("dataset-viewer", "Inspect datasets and schema metadata.")
    ]));
    const source = createHuggingFaceMarketplaceSource({ fetch, timeoutMs: 500 });

    const result = await source.search({ query: "  audio model  ", limit: 5 });

    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.github.com/repos/huggingface/skills/contents/.claude-plugin/marketplace-internal.json?ref=main"
    );
    expect(result).toEqual({
      source: "hugging-face",
      query: "audio model",
      returnedCount: 1,
      entries: [{
        id: "huggingface/skills/skills/audio-craft",
        source: "hugging-face",
        catalogs: ["hugging-face"],
        name: "audio-craft",
        description: "Create and analyze audio with Hugging Face models.",
        publisher: { name: "Hugging Face", url: "https://huggingface.co" },
        author: null,
        repository: {
          host: "github",
          owner: "huggingface",
          name: "skills",
          path: "skills/audio-craft",
          url: "https://github.com/huggingface/skills"
        },
        skillUrl: "https://github.com/huggingface/skills/tree/main/skills/audio-craft",
        install: {
          kind: "github",
          repository: "huggingface/skills",
          skill: "audio-craft",
          path: "skills/audio-craft"
        },
        metrics: { installs: null, stars: null, downloads: null },
        cover: { kind: "generated", seed: "huggingface/skills/skills/audio-craft" }
      }],
      sources: [{
        source: "hugging-face",
        status: "available",
        returnedCount: 1,
        error: null
      }]
    });
  });

  it("rejects invalid requests before network access", async () => {
    const fetch = vi.fn();
    const source = createHuggingFaceMarketplaceSource({ fetch });

    await expect(source.search({ query: "x" })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_QUERY"
    });
    for (const limit of [0, 201, 1.5]) {
      await expect(source.search({ query: "audio", limit })).rejects.toMatchObject({
        code: "INVALID_MARKETPLACE_LIMIT"
      });
    }
    expect(() => createHuggingFaceMarketplaceSource({ fetch, timeoutMs: 0 })).toThrowError(
      expect.objectContaining({ code: "INVALID_MARKETPLACE_TIMEOUT" })
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported content response", { encoding: "utf-8", content: "{}" }],
    ["damaged base64", { encoding: "base64", content: "%%%" }],
    ["malformed manifest", contentsPayload("{")],
    ["wrong manifest identity", contentsPayload(JSON.stringify(manifest([], { name: "other" })))],
    ["unsafe plugin path", contentsPayload(JSON.stringify(manifest([
      { ...plugin("audio-craft", "Audio tools."), source: "../skills/audio-craft" }
    ])))],
    ["duplicate plugin", contentsPayload(JSON.stringify(manifest([
      plugin("audio-craft", "Audio tools."),
      plugin("audio-craft", "Duplicate audio tools.")
    ])))]
  ])("rejects %s", async (_label, payload) => {
    const source = createHuggingFaceMarketplaceSource({
      fetch: vi.fn(async () => jsonResponse(payload))
    });

    await expect(source.search({ query: "audio" })).rejects.toMatchObject({
      name: "MarketplaceSourceError",
      code: "INVALID_MARKETPLACE_RESPONSE"
    } satisfies Partial<MarketplaceSourceError>);
  });

  it("reports HTTP failures with a stable public error", async () => {
    const source = createHuggingFaceMarketplaceSource({
      fetch: vi.fn(async () => new Response(null, { status: 503 }))
    });

    await expect(source.search({ query: "audio" })).rejects.toMatchObject({
      code: "MARKETPLACE_HTTP_ERROR",
      message: "Hugging Face marketplace manifest failed with HTTP 503."
    });
  });

  it("honors caller cancellation even when transport ignores abort", async () => {
    const controller = new AbortController();
    const source = createHuggingFaceMarketplaceSource({
      fetch: vi.fn(() => new Promise<Response>(() => undefined)),
      timeoutMs: 500
    });
    const assertion = expect(source.search({
      query: "audio",
      signal: controller.signal
    })).rejects.toMatchObject({ code: "MARKETPLACE_ABORTED" });

    controller.abort("cancelled");

    await assertion;
  });

  it("applies the deadline while reading a response body", async () => {
    vi.useFakeTimers();
    const source = createHuggingFaceMarketplaceSource({
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => new Promise<unknown>(() => undefined)
      } as Response)),
      timeoutMs: 50
    });
    const assertion = expect(source.search({ query: "audio" })).rejects.toMatchObject({
      code: "MARKETPLACE_TIMEOUT",
      message: "Hugging Face marketplace search exceeded 50 ms."
    });

    await vi.advanceTimersByTimeAsync(50);

    await assertion;
  });
});

function plugin(name: string, description: string) {
  return { name, description, source: `./skills/${name}`, skills: "./" };
}

function manifest(plugins: unknown[], override: Record<string, unknown> = {}) {
  return {
    name: "huggingface-skills",
    owner: { name: "Hugging Face" },
    plugins,
    ...override
  };
}

function manifestResponse(plugins: unknown[]): Response {
  return jsonResponse(contentsPayload(JSON.stringify(manifest(plugins))));
}

function contentsPayload(content: string) {
  return { encoding: "base64", content: Buffer.from(content, "utf8").toString("base64") };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
