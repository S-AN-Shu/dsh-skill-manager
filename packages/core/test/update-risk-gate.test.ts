import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSkillManager,
  type ResolvedSkillSnapshot,
  type SkillRiskAssessor,
  type SnapshotResolver
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("fixed-snapshot update risk gate", () => {
  it("blocks automatic high-risk updates, refreshes the final commit, and preserves backup and links", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-update-risk-"));
    roots.push(root);
    const initial = resolvedSnapshot("1".repeat(40), "Initial guidance.\n");
    const checked = resolvedSnapshot("2".repeat(40), "Updated guidance with password access.\n");
    const final = resolvedSnapshot("3".repeat(40), "Final guidance with password access.\n");
    const resolveSkillSnapshot = vi.fn().mockResolvedValue(checked);
    const snapshotResolver: SnapshotResolver = { resolveSkillSnapshot };
    const assessment = {
      risk: "high" as const,
      findings: [{
        code: "SENSITIVE_REFERENCE",
        severity: "high" as const,
        title: "Sensitive",
        detail: "Mentions password access.",
        file: "SKILL.md"
      }],
      scannerVersion: "test"
    };
    const riskAssessor: SkillRiskAssessor = {
      assessSkillRisk: vi.fn().mockResolvedValue(assessment),
      assessResolvedSkillRisk: vi.fn().mockReturnValue(assessment)
    };
    const manager = createSkillManager({ root, snapshotResolver, riskAssessor });
    const installed = await manager.installSkillSnapshot({ resolved: initial });
    await manager.setTargetEnabled({ name: "demo", target: "dsh", enabled: true });

    await expect(manager.checkUpdates({ names: ["demo"] })).resolves.toEqual([
      expect.objectContaining({
        status: "update-available",
        latestRisk: expect.objectContaining({ risk: "high" })
      })
    ]);
    await expect(manager.updateSkill({ name: "demo" })).rejects.toMatchObject({
      code: "SKILL_UPDATE_RISK_CONFIRMATION_REQUIRED"
    });
    await expect(manager.listBackups()).resolves.toEqual([]);

    resolveSkillSnapshot.mockResolvedValue(final);
    const result = await manager.updateSkill({ name: "demo", acknowledgeHighRisk: true });

    expect(result).toMatchObject({
      skill: {
        enabledTargets: ["dsh"],
        source: { commitSha: "3".repeat(40), repositoryId: 42 }
      },
      backup: { contentHash: installed.contentHash, reason: "update" }
    });
    await expect(readFile(join(root, "active", "demo", "SKILL.md"), "utf8"))
      .resolves.toContain("Final guidance");
    expect(resolveSkillSnapshot).toHaveBeenCalledTimes(5);
  });
});

function resolvedSnapshot(commit: string, body: string): ResolvedSkillSnapshot {
  const content = Buffer.from([
    "---",
    "name: demo",
    "description: Demonstrate verified updates.",
    "---",
    "",
    body.trimEnd(),
    ""
  ].join("\n"));
  const blobSha = gitBlobSha(content);
  const bundleHash = createHash("sha256")
    .update("SKILL.md").update("\0")
    .update("100644").update("\0")
    .update(blobSha).update("\0")
    .update(String(content.byteLength)).update("\0")
    .digest("hex");
  return {
    repository: {
      repositoryId: 42,
      nodeId: "R_demo",
      repoKey: "github:owner/repository",
      host: "github",
      owner: "owner",
      ownerId: 1,
      ownerType: "User",
      ownerAvatar: { type: "github-avatar", owner: "owner", accountId: 1 },
      name: "repository",
      fullName: "owner/repository",
      description: "Demo repository",
      url: "https://github.com/owner/repository",
      defaultBranch: "main",
      stars: 1,
      forks: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
      pushedAt: "2026-08-18T00:00:00.000Z",
      topics: ["agent-skills"],
      formatTopics: ["agent-skills"],
      categoryTopics: [],
      archived: false,
      license: "MIT",
      knownSkillCount: 1,
      classification: { primaryCategory: "general", tags: [], evidence: [], confidence: "none" },
      trend: null,
      cover: { type: "generated", seed: "owner/repository" },
      discovery: { signals: [], discoveredAt: "2026-08-18T00:00:00.000Z" }
    },
    skill: {
      skillKey: "github:owner/repository#skills/not-the-frontmatter-name",
      repositoryId: 42,
      path: "skills/not-the-frontmatter-name",
      name: "demo",
      description: "Demonstrate verified updates.",
      classification: { primaryCategory: "general", tags: [], evidence: [], confidence: "none" },
      author: null,
      structureStatus: "structure-verified",
      validatedAtCommit: commit,
      skillDocumentBlobSha: blobSha,
      manifestFiles: [],
      installable: true,
      warnings: []
    },
    snapshot: {
      snapshotKey: `github:owner/repository#skills/not-the-frontmatter-name@${commit}`,
      repository: { owner: "owner", name: "repository" },
      skillPath: "skills/not-the-frontmatter-name",
      commitSha: commit,
      skillDocumentBlobSha: blobSha,
      files: [{ path: "SKILL.md", blobSha, size: content.byteLength, mode: "100644" }],
      bundleHash,
      integrity: {
        commitPinned: true,
        pathsSafe: true,
        frontmatterValid: true,
        symlinksRejected: true,
        submodulesRejected: true
      }
    },
    files: [{ path: "SKILL.md", content }]
  };
}

function gitBlobSha(content: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest("hex");
}
