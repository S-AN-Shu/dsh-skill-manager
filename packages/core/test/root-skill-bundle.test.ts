import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createGitHubBundleFetcher } from "../src/marketplace/github-bundle.js";
import type { ResolvedMarketplaceEntry } from "../src/index.js";

describe("root Skill bundle policy", () => {
  it("includes only SKILL.md and the allowed root resource directories", async () => {
    const document = Buffer.from("---\nname: root-skill\ndescription: Root guidance.\n---\n");
    const script = Buffer.from("Write-Output 'stored but never executed'\n");
    const adjacent = Buffer.from("untrusted adjacent instructions");
    const files = new Map([
      [gitBlobSha(document), document], [gitBlobSha(script), script], [gitBlobSha(adjacent), adjacent]
    ]);
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/git/trees/")) return json({ truncated: false, tree: [
        tree("SKILL.md", document), tree("scripts/check.ps1", script), tree("AGENTS.md", adjacent),
        tree("scripts/CLAUDE.md", adjacent)
      ] });
      const content = files.get(url.split("/").at(-1) ?? "");
      if (content === undefined) throw new Error(`Unexpected request: ${url}`);
      return json({ sha: gitBlobSha(content), size: content.byteLength, encoding: "base64", content: content.toString("base64") });
    });
    const entry: ResolvedMarketplaceEntry = {
      id: "openai/root-skill/root-skill", source: "github", catalogs: ["github"], name: "root-skill",
      description: "Root guidance.", publisher: { name: "openai", url: "https://github.com/openai" }, author: null,
      repository: { host: "github", id: 42, nodeId: "R_example", owner: "openai", name: "root-skill", path: ".", url: "https://github.com/openai/root-skill" },
      skillUrl: "https://github.com/openai/root-skill/blob/main/SKILL.md",
      install: { kind: "github", repository: "openai/root-skill", skill: "root-skill", path: "." },
      metrics: { installs: null, stars: null, downloads: null }, cover: { kind: "generated", seed: "root" },
      snapshot: { commitSha: "a".repeat(40), blobSha: gitBlobSha(document), fetchedAt: "2026-08-18T00:00:00.000Z" }
    };

    const bundle = await createGitHubBundleFetcher({ fetch }).fetchBundle(entry);

    expect(bundle.files.map((file) => file.path)).toEqual(["SKILL.md", "scripts/check.ps1"]);
    expect(fetch.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain(gitBlobSha(adjacent));
  });

  it("includes only safe root files explicitly declared by the verified manifest", async () => {
    const document = Buffer.from("---\nname: root-skill\ndescription: Root guidance.\n---\n");
    const guide = Buffer.from("portable usage guide\n");
    const adjacent = Buffer.from("untrusted adjacent instructions\n");
    const files = new Map([
      [gitBlobSha(document), document], [gitBlobSha(guide), guide], [gitBlobSha(adjacent), adjacent]
    ]);
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/git/trees/")) return json({ truncated: false, tree: [
        tree("SKILL.md", document), tree("guide.md", guide), tree("AGENTS.md", adjacent)
      ] });
      const content = files.get(url.split("/").at(-1) ?? "");
      if (content === undefined) throw new Error(`Unexpected request: ${url}`);
      return json({ sha: gitBlobSha(content), size: content.byteLength, encoding: "base64", content: content.toString("base64") });
    });
    const entry = rootEntry(document, ["guide.md"]);

    const bundle = await createGitHubBundleFetcher({ fetch }).fetchBundle(entry);

    expect(bundle.files.map((file) => file.path)).toEqual(["SKILL.md", "guide.md"]);
    expect(fetch.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain(gitBlobSha(adjacent));
  });

  it("rejects an internal snapshot that tries to admit adjacent Agent instructions", async () => {
    const document = Buffer.from("---\nname: root-skill\ndescription: Root guidance.\n---\n");
    const entries = [
      rootEntry(document, ["AGENTS.md"]),
      rootEntry(document, ["references/CLAUDE.md"])
    ];

    for (const entry of entries) {
      await expect(createGitHubBundleFetcher({ fetch: vi.fn() }).fetchBundle(entry)).rejects.toMatchObject({
        code: "INVALID_MARKETPLACE_INSTALL"
      });
    }
  });
});

function rootEntry(document: Buffer, manifestFiles?: string[]): ResolvedMarketplaceEntry {
  return {
    id: "openai/root-skill/root-skill", source: "github", catalogs: ["github"], name: "root-skill",
    description: "Root guidance.", publisher: { name: "openai", url: "https://github.com/openai" }, author: null,
    repository: { host: "github", id: 42, nodeId: "R_example", owner: "openai", name: "root-skill", path: ".", url: "https://github.com/openai/root-skill" },
    skillUrl: "https://github.com/openai/root-skill/blob/main/SKILL.md",
    install: { kind: "github", repository: "openai/root-skill", skill: "root-skill", path: "." },
    metrics: { installs: null, stars: null, downloads: null }, cover: { kind: "generated", seed: "root" },
    snapshot: { commitSha: "a".repeat(40), blobSha: gitBlobSha(document), fetchedAt: "2026-08-18T00:00:00.000Z", ...(manifestFiles === undefined ? {} : { manifestFiles }) }
  };
}

function gitBlobSha(content: Buffer): string {
  return createHash("sha1").update(`blob ${content.byteLength}\0`).update(content).digest("hex");
}
function tree(path: string, content: Buffer) { return { path, type: "blob", mode: "100644", sha: gitBlobSha(content), size: content.byteLength }; }
function json(value: unknown): Response { return new Response(JSON.stringify(value), { status: 200 }); }
