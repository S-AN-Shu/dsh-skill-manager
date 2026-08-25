import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGitHubSkillIndex,
  createSkillManager,
  fingerprintSkillDirectory,
  fingerprintSkillFiles,
  type ResolvedMarketplaceEntry
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("automatic marketplace provenance", () => {
  it("revalidates a unique historical index match with newline normalization and a different path basename", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-provenance-index-"));
    const agentsRoot = await mkdtemp(join(tmpdir(), "agents-provenance-index-"));
    roots.push(root, agentsRoot);
    const localDocument = remoteDocument().replaceAll("\n", "\r\n");
    const localReference = "# Guide\r\nUse it.\r\n";
    await mkdir(join(agentsRoot, "demo", "references"), { recursive: true });
    await writeFile(join(agentsRoot, "demo", "SKILL.md"), localDocument, "utf8");
    await writeFile(join(agentsRoot, "demo", "references", "guide.md"), localReference, "utf8");
    const index = createGitHubSkillIndex({ path: join(root, "cache", "github-skill-index", "v1.json") });
    const remoteFiles = [
      { path: "SKILL.md", content: Buffer.from(remoteDocument()) },
      { path: "references/guide.md", content: Buffer.from("# Guide\nUse it.\n") }
    ];
    const skillBlob = gitBlobSha(remoteFiles[0]!.content);
    const referenceBlob = gitBlobSha(remoteFiles[1]!.content);
    await index.record({
      repositoryId: 77,
      nodeId: "R_history",
      repository: { owner: "owner", name: "skill-pack" },
      skillPath: "packages/frontend",
      skillName: "demo",
      fingerprint: fingerprintSkillFiles(remoteFiles),
      commitSha: "7".repeat(40),
      skillDocumentBlobSha: skillBlob,
      bundleHash: "8".repeat(64),
      manifestFiles: [],
      observedAt: "2026-08-01T00:00:00.000Z",
      verifiedAt: "2026-08-01T00:00:00.000Z"
    });
    const initial = createSkillManager({ root, targetRoots: { agents: agentsRoot } });
    await initial.importSkill({ target: "agents", name: "demo" });
    expect(await fingerprintSkillDirectory(join(root, "library", "demo")))
      .toEqual(fingerprintSkillFiles(remoteFiles));
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [
          { path: "packages/frontend/SKILL.md", type: "blob", mode: "100644", sha: skillBlob, size: remoteFiles[0]!.content.byteLength },
          { path: "packages/frontend/references/guide.md", type: "blob", mode: "100644", sha: referenceBlob, size: remoteFiles[1]!.content.byteLength }
        ]
      }))
      .mockResolvedValueOnce(blobResponse(skillBlob, remoteFiles[0]!.content))
      .mockResolvedValueOnce(blobResponse(referenceBlob, remoteFiles[1]!.content));
    const manager = createSkillManager({ root, fetch, githubSkillIndex: index, marketplaceTimeoutMs: 500 });

    const result = await manager.verifyMarketplaceProvenance({ name: "demo", entries: [] });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      status: "matched",
      skill: {
        source: {
          repositoryId: 77,
          repository: "owner/skill-pack",
          path: "packages/frontend",
          matchMethod: "exact-content",
          identityFingerprint: { version: "dsm-skill-fingerprint-v1" }
        }
      }
    });
    await expect(createSkillManager({ root }).listSkills()).resolves.toEqual([
      expect.objectContaining({ source: expect.objectContaining({ repositoryId: 77 }) })
    ]);
  });

  it("persists an updateable catalog source only for an exact complete bundle match", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-provenance-"));
    roots.push(root);
    const manager = createSkillManager({ root });
    await manager.createSkill({
      name: "story-writer",
      description: "Write structured stories."
    });
    const document = await readFile(join(root, "library", "story-writer", "SKILL.md"));
    const blobSha = gitBlobSha(document);
    const entry = resolvedEntry(blobSha, ["hugging-face"]);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "skills/story-writer/SKILL.md",
          type: "blob",
          mode: "100644",
          sha: blobSha,
          size: document.byteLength
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        encoding: "base64",
        sha: blobSha,
        size: document.byteLength,
        content: document.toString("base64")
      }));
    const verifiedManager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    const result = await verifiedManager.verifyMarketplaceProvenance({
      name: "story-writer",
      entries: [entry]
    });

    expect(result).toMatchObject({
      status: "matched",
      skill: {
        name: "story-writer",
        origin: "github",
        source: {
          kind: "github",
          repository: "huggingface/skills",
          path: "skills/story-writer",
          catalog: "hugging-face",
          discoverySources: ["hugging-face"]
        }
      }
    });
    await expect(verifiedManager.listSkills()).resolves.toEqual([
      expect.objectContaining({
        name: "story-writer",
        source: expect.objectContaining({
          catalog: "hugging-face",
          discoverySources: ["hugging-face"]
        })
      })
    ]);
  });

  it("keeps a same-name and same-description impostor self-authored when bytes differ", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-provenance-"));
    roots.push(root);
    const remoteDocument = Buffer.from([
      "---",
      "name: story-writer",
      "description: Write structured stories.",
      "---",
      "",
      "Unrelated remote instructions."
    ].join("\n"));
    const blobSha = gitBlobSha(remoteDocument);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "skills/story-writer/SKILL.md",
          type: "blob",
          mode: "100644",
          sha: blobSha,
          size: remoteDocument.byteLength
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        encoding: "base64",
        sha: blobSha,
        size: remoteDocument.byteLength,
        content: remoteDocument.toString("base64")
      }));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });
    await manager.createSkill({ name: "story-writer", description: "Write structured stories." });

    const result = await manager.verifyMarketplaceProvenance({
      name: "story-writer",
      entries: [resolvedEntry(blobSha, ["github"])]
    });

    expect(result.status).toBe("custom");
    expect(result.skill).toMatchObject({ origin: "self" });
    expect(result.skill.source).toBeUndefined();
    await expect(createSkillManager({ root }).listSkills()).resolves.toEqual([
      expect.objectContaining({
        name: "story-writer",
        provenanceCheck: expect.objectContaining({ status: "custom" })
      })
    ]);
  });
});

function remoteDocument(): string {
  return [
    "---",
    "name: demo",
    "description: Demonstrate exact provenance.",
    "---",
    "",
    "Use the demo."
  ].join("\n") + "\n";
}

function resolvedEntry(
  blobSha: string,
  catalogs: Array<"github" | "hugging-face">
): ResolvedMarketplaceEntry {
  return {
    id: "huggingface/skills/story-writer",
    source: catalogs[0]!,
    catalogs,
    name: "story-writer",
    description: "Write structured stories.",
    publisher: { name: "huggingface", url: "https://github.com/huggingface" },
    author: null,
    repository: {
      host: "github",
      id: 42,
      nodeId: "R_example",
      owner: "huggingface",
      name: "skills",
      path: "skills/story-writer",
      url: "https://github.com/huggingface/skills"
    },
    skillUrl: "https://github.com/huggingface/skills/tree/main/skills/story-writer",
    install: {
      kind: "github",
      repository: "huggingface/skills",
      skill: "story-writer",
      path: "skills/story-writer"
    },
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: "story-writer" },
    snapshot: {
      commitSha: "a".repeat(40),
      blobSha,
      fetchedAt: "2026-08-17T00:00:00.000Z"
    }
  };
}

function gitBlobSha(content: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest("hex");
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function blobResponse(sha: string, content: Uint8Array): Response {
  return jsonResponse({
    encoding: "base64",
    sha,
    size: content.byteLength,
    content: Buffer.from(content).toString("base64")
  });
}
