import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createGitHubSkillIndex,
  SKILL_IDENTITY_FINGERPRINT_VERSION,
  type GitHubSkillObservation
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("GitHub Skill observation index", () => {
  it("persists observations atomically and distinguishes unique from ambiguous exact matches", async () => {
    const root = await temporaryRoot();
    const path = join(root, "cache", "github-skill-index", "v1.json");
    const index = createGitHubSkillIndex({ path });
    const fingerprint = "a".repeat(64);
    await index.record(observation({ repositoryId: 1, fingerprint }));

    await expect(index.findByFingerprint({
      version: SKILL_IDENTITY_FINGERPRINT_VERSION,
      hash: fingerprint
    })).resolves.toEqual([expect.objectContaining({ repositoryId: 1 })]);
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ schemaVersion: 1 });
    expect((await readdir(join(root, "cache", "github-skill-index"))).filter((name) => name.endsWith(".tmp")))
      .toEqual([]);

    await index.record(observation({
      repositoryId: 2,
      repository: { owner: "mirror", name: "skills" },
      fingerprint
    }));
    await expect(index.findByFingerprint({
      version: SKILL_IDENTITY_FINGERPRINT_VERSION,
      hash: fingerprint
    })).resolves.toHaveLength(2);
  });

  it("recovers from corrupt cache data and enforces per-path and global history bounds", async () => {
    const root = await temporaryRoot();
    const path = join(root, "v1.json");
    await writeFile(path, "{broken", "utf8");
    const index = createGitHubSkillIndex({ path, versionsPerSkill: 2, maxObservations: 3 });
    await expect(index.list()).resolves.toEqual([]);

    for (let version = 0; version < 3; version += 1) {
      await index.record(observation({
        repositoryId: 1,
        commitSha: version.toString(16).repeat(40),
        fingerprint: version.toString(16).repeat(64),
        observedAt: `2026-08-18T00:0${version}:00.000Z`
      }));
    }
    await expect(index.list()).resolves.toHaveLength(2);
    expect((await index.list()).map((entry) => entry.commitSha)).not.toContain("0".repeat(40));
    await index.record(observation({ repositoryId: 2, fingerprint: "d".repeat(64) }));
    await index.record(observation({ repositoryId: 3, fingerprint: "e".repeat(64) }));

    const persisted = await index.list();
    expect(persisted).toHaveLength(3);
    expect(persisted.filter((entry) => entry.repositoryId === 1).length).toBeLessThanOrEqual(2);
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      schemaVersion: 1,
      observations: expect.any(Array)
    });
  });
});

function observation(
  overrides: Partial<Omit<GitHubSkillObservation, "fingerprint">> & { fingerprint?: string } = {}
): GitHubSkillObservation {
  const { fingerprint, ...rest } = overrides;
  const commitSha = rest.commitSha ?? "b".repeat(40);
  return {
    repositoryId: 1,
    nodeId: "R_example",
    repository: { owner: "owner", name: "skills" },
    skillPath: "skills/demo",
    skillName: "demo",
    commitSha,
    skillDocumentBlobSha: "c".repeat(40),
    bundleHash: "f".repeat(64),
    manifestFiles: [],
    observedAt: "2026-08-18T00:00:00.000Z",
    verifiedAt: "2026-08-18T00:00:00.000Z",
    ...rest,
    fingerprint: {
      version: SKILL_IDENTITY_FINGERPRINT_VERSION,
      hash: fingerprint ?? "a".repeat(64)
    }
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dsh-github-index-"));
  roots.push(root);
  return root;
}
