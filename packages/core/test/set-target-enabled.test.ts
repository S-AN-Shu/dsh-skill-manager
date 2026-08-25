import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createSkillManager } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("DSH target enablement", () => {
  test("exposes only enabled managed Skills through the active root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-"));
    roots.push(root);
    const manager = createSkillManager({ root });
    await manager.createSkill({
      name: "example-skill",
      description: "Explain one focused example."
    });

    const enabled = await manager.setTargetEnabled({
      name: "example-skill",
      target: "dsh",
      enabled: true
    });

    expect(enabled.enabledTargets).toEqual(["dsh"]);
    await expect(readFile(join(root, "active", "example-skill", "SKILL.md"), "utf8"))
      .resolves.toContain("name: example-skill");

    const disabled = await manager.setTargetEnabled({
      name: "example-skill",
      target: "dsh",
      enabled: false
    });

    expect(disabled.enabledTargets).toEqual([]);
    await expect(readFile(join(root, "active", "example-skill", "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("links enabled Skills into an explicitly configured native DSH root", async () => {
    const root = await temporaryRoot("dsh-skill-manager-");
    const dshRoot = await temporaryRoot("dsh-native-skills-");
    const manager = createSkillManager({ root, dshRoot });
    await manager.createSkill({
      name: "native-skill",
      description: "Appear in the native DSH catalog."
    });

    await manager.setTargetEnabled({ name: "native-skill", target: "dsh", enabled: true });

    await expect(realpath(join(dshRoot, "native-skill"))).resolves.toBe(
      await realpath(join(root, "library", "native-skill"))
    );
    await expect(readFile(join(root, "active", "native-skill", "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("cross-agent target synchronization", () => {
  test.each(["codex", "claude", "agents"] as const)(
    "links one managed Skill into the configured %s root and persists its state",
    async (target) => {
      const root = await temporaryRoot("dsh-skill-manager-");
      const targetRoot = await temporaryRoot(`${target}-skills-`);
      const options = { root, targetRoots: { [target]: targetRoot } };
      const manager = createSkillManager(options);
      await manager.createSkill({ name: "example-skill", description: "One example." });

      await expect(manager.listTargetStates({ names: ["example-skill"], targets: [target] }))
        .resolves.toEqual([{ name: "example-skill", target, status: "not-linked" }]);
      const enabled = await manager.setTargetEnabled({
        name: "example-skill",
        target,
        enabled: true
      });

      expect(enabled.enabledTargets).toEqual([target]);
      await expect(realpath(join(targetRoot, "example-skill")))
        .resolves.toBe(await realpath(join(root, "library", "example-skill")));
      await expect(manager.listTargetStates({ names: ["example-skill"], targets: [target] }))
        .resolves.toEqual([{ name: "example-skill", target, status: "linked" }]);

      await writeFile(
        join(root, "library", "example-skill", "SKILL.md"),
        "---\nname: example-skill\ndescription: Changed once.\n---\n\n# Changed\n",
        "utf8"
      );
      await expect(readFile(join(targetRoot, "example-skill", "SKILL.md"), "utf8"))
        .resolves.toContain("# Changed");

      const restarted = createSkillManager(options);
      await expect(restarted.listSkills()).resolves.toEqual([
        expect.objectContaining({ name: "example-skill", enabledTargets: [target] })
      ]);
      const disabled = await restarted.setTargetEnabled({
        name: "example-skill",
        target,
        enabled: false
      });
      expect(disabled.enabledTargets).toEqual([]);
      await expect(readFile(join(targetRoot, "example-skill", "SKILL.md"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
    }
  );

  test("reports unconfigured targets without exposing their paths", async () => {
    const root = await temporaryRoot("dsh-skill-manager-");
    const manager = createSkillManager({ root });
    await manager.createSkill({ name: "example-skill", description: "One example." });

    await expect(manager.listTargetStates({ names: ["example-skill"], targets: ["codex"] }))
      .resolves.toEqual([{ name: "example-skill", target: "codex", status: "not-configured" }]);
    await expect(manager.setTargetEnabled({
      name: "example-skill",
      target: "codex",
      enabled: true
    })).rejects.toMatchObject({ code: "TARGET_NOT_CONFIGURED" });
  });

  test("never replaces a same-name directory or link owned by someone else", async () => {
    const root = await temporaryRoot("dsh-skill-manager-");
    const targetRoot = await temporaryRoot("codex-skills-");
    const otherRoot = await temporaryRoot("other-skill-");
    const manager = createSkillManager({ root, targetRoots: { codex: targetRoot } });
    await manager.createSkill({ name: "example-skill", description: "One example." });
    const destination = join(targetRoot, "example-skill");
    await mkdir(destination);
    await writeFile(join(destination, "keep.txt"), "keep", "utf8");

    await expect(manager.listTargetStates({ names: ["example-skill"], targets: ["codex"] }))
      .resolves.toEqual([{ name: "example-skill", target: "codex", status: "conflict" }]);
    await expect(manager.setTargetEnabled({
      name: "example-skill",
      target: "codex",
      enabled: true
    })).rejects.toMatchObject({ code: "ACTIVE_PATH_CONFLICT" });
    await expect(readFile(join(destination, "keep.txt"), "utf8")).resolves.toBe("keep");

    await rm(destination, { recursive: true });
    await symlink(otherRoot, destination, process.platform === "win32" ? "junction" : "dir");
    await expect(manager.setTargetEnabled({
      name: "example-skill",
      target: "codex",
      enabled: false
    })).rejects.toMatchObject({ code: "ACTIVE_PATH_CONFLICT" });
    await expect(realpath(destination)).resolves.toBe(await realpath(otherRoot));

    await rm(destination);
    await symlink(
      join(root, "library", "example-skill"),
      destination,
      process.platform === "win32" ? "junction" : "dir"
    );
    await expect(manager.listTargetStates({ names: ["example-skill"], targets: ["codex"] }))
      .resolves.toEqual([{ name: "example-skill", target: "codex", status: "conflict" }]);
    await expect(manager.setTargetEnabled({
      name: "example-skill",
      target: "codex",
      enabled: false
    })).rejects.toMatchObject({ code: "ACTIVE_PATH_CONFLICT" });
    await expect(realpath(destination)).resolves.toBe(
      await realpath(join(root, "library", "example-skill"))
    );
  });
});

describe("recoverable managed Skill deletion", () => {
  test("archives the bundle and removes only manager-owned links", async () => {
    const root = await temporaryRoot("dsh-delete-");
    const codexRoot = await temporaryRoot("codex-delete-");
    const manager = createSkillManager({ root, targetRoots: { codex: codexRoot } });
    await manager.createSkill({ name: "example-skill", description: "One example." });
    await manager.setTargetEnabled({ name: "example-skill", target: "dsh", enabled: true });
    await manager.setTargetEnabled({ name: "example-skill", target: "codex", enabled: true });

    const deleted = await manager.deleteSkill({ name: "example-skill" });

    expect(deleted.trashId).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(manager.listSkills()).resolves.toEqual([]);
    await expect(readFile(join(root, "active", "example-skill", "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(codexRoot, "example-skill", "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
    const archived = join(root, "trash", "example-skill", deleted.trashId);
    await expect(readFile(join(archived, "bundle", "SKILL.md"), "utf8"))
      .resolves.toContain("name: example-skill");
    await expect(readFile(join(archived, "metadata.json"), "utf8"))
      .resolves.toContain(deleted.trashId);
  });

  test("refuses deletion when a recorded target no longer points to the managed bundle", async () => {
    const root = await temporaryRoot("dsh-delete-conflict-");
    const codexRoot = await temporaryRoot("codex-delete-conflict-");
    const otherRoot = await temporaryRoot("other-delete-conflict-");
    const manager = createSkillManager({ root, targetRoots: { codex: codexRoot } });
    await manager.createSkill({ name: "example-skill", description: "One example." });
    await manager.setTargetEnabled({ name: "example-skill", target: "codex", enabled: true });
    await rm(join(codexRoot, "example-skill"));
    await symlink(otherRoot, join(codexRoot, "example-skill"), process.platform === "win32" ? "junction" : "dir");

    await expect(manager.deleteSkill({ name: "example-skill" }))
      .rejects.toMatchObject({ code: "ACTIVE_PATH_CONFLICT" });
    await expect(manager.listSkills()).resolves.toEqual([expect.objectContaining({ name: "example-skill" })]);
    await expect(realpath(join(codexRoot, "example-skill"))).resolves.toBe(await realpath(otherRoot));
    await expect(readdir(join(root, "trash", "example-skill"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("lists and restores a deleted Skill with its original enabled targets after restart", async () => {
    const root = await temporaryRoot("dsh-restore-");
    const codexRoot = await temporaryRoot("codex-restore-");
    const now = new Date("2026-08-18T00:00:00.000Z");
    const manager = createSkillManager({ root, targetRoots: { codex: codexRoot }, now: () => now });
    await manager.createSkill({ name: "example-skill", description: "One example." });
    await manager.setTargetEnabled({ name: "example-skill", target: "dsh", enabled: true });
    await manager.setTargetEnabled({ name: "example-skill", target: "codex", enabled: true });
    const deleted = await manager.deleteSkill({ name: "example-skill" });

    const restarted = createSkillManager({ root, targetRoots: { codex: codexRoot }, now: () => now });
    await expect(restarted.listTrash()).resolves.toEqual([{
      name: "example-skill",
      trashId: deleted.trashId,
      description: "One example.",
      origin: "self",
      enabledTargets: ["dsh", "codex"],
      deletedAt: "2026-08-18T00:00:00.000Z",
      expiresAt: "2026-09-17T00:00:00.000Z"
    }]);
    await expect(restarted.restoreTrash({ name: "example-skill", trashId: deleted.trashId }))
      .resolves.toMatchObject({ name: "example-skill", enabledTargets: ["dsh", "codex"] });
    await expect(restarted.listTrash()).resolves.toEqual([]);
    await expect(readFile(join(root, "active", "example-skill", "SKILL.md"), "utf8"))
      .resolves.toContain("name: example-skill");
    await expect(readFile(join(codexRoot, "example-skill", "SKILL.md"), "utf8"))
      .resolves.toContain("name: example-skill");
  });

  test("refuses restore when the managed library name or an original target is occupied", async () => {
    const root = await temporaryRoot("dsh-restore-conflict-");
    const codexRoot = await temporaryRoot("codex-restore-conflict-");
    const manager = createSkillManager({ root, targetRoots: { codex: codexRoot } });
    await manager.createSkill({ name: "example-skill", description: "One example." });
    await manager.setTargetEnabled({ name: "example-skill", target: "codex", enabled: true });
    const deleted = await manager.deleteSkill({ name: "example-skill" });
    await mkdir(join(codexRoot, "example-skill"));

    await expect(manager.restoreTrash({ name: "example-skill", trashId: deleted.trashId }))
      .rejects.toMatchObject({ code: "ACTIVE_PATH_CONFLICT" });
    await rm(join(codexRoot, "example-skill"), { recursive: true });
    await mkdir(join(root, "library", "example-skill"));
    await expect(manager.restoreTrash({ name: "example-skill", trashId: deleted.trashId }))
      .rejects.toMatchObject({ code: "SKILL_ALREADY_EXISTS" });
    await expect(manager.listTrash()).resolves.toHaveLength(1);
  });

  test("lists and restores a legacy local-import archive after restart", async () => {
    const root = await temporaryRoot("dsh-legacy-trash-");
    const now = new Date("2026-08-18T00:00:00.000Z");
    const manager = createSkillManager({ root, now: () => now });
    await manager.createSkill({ name: "imported-skill", description: "Imported once." });
    const deleted = await manager.deleteSkill({ name: "imported-skill" });
    const metadataPath = join(root, "trash", "imported-skill", deleted.trashId, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.skill.origin = "local-import";
    metadata.skill.source = { kind: "local-import", name: "imported-skill", target: "agents" };
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    const restarted = createSkillManager({ root, now: () => now });
    await expect(restarted.listTrash()).resolves.toEqual([
      expect.objectContaining({ name: "imported-skill", origin: "local-import" })
    ]);
    await expect(restarted.restoreTrash({ name: "imported-skill", trashId: deleted.trashId }))
      .resolves.toMatchObject({ name: "imported-skill", origin: "local-import" });
  });

  test("refuses a damaged archive and purges only a valid archive after 30 days", async () => {
    const root = await temporaryRoot("dsh-trash-expiry-");
    let now = new Date("2026-08-18T00:00:00.000Z");
    let manager = createSkillManager({ root, now: () => now });
    await manager.createSkill({ name: "keep-skill", description: "Keep." });
    const keep = await manager.deleteSkill({ name: "keep-skill" });
    now = new Date("2026-09-16T23:59:59.999Z");
    manager = createSkillManager({ root, now: () => now });
    await expect(manager.listTrash()).resolves.toHaveLength(1);

    await writeFile(join(root, "trash", "keep-skill", keep.trashId, "bundle", "SKILL.md"), "damaged", "utf8");
    await expect(manager.restoreTrash({ name: "keep-skill", trashId: keep.trashId }))
      .rejects.toMatchObject({ code: "SKILL_TRASH_INVALID" });
    now = new Date("2026-09-17T00:00:00.000Z");
    manager = createSkillManager({ root, now: () => now });
    await expect(manager.listTrash()).resolves.toHaveLength(1);
    await expect(readFile(join(root, "trash", "keep-skill", keep.trashId, "bundle", "SKILL.md"), "utf8"))
      .resolves.toBe("damaged");

    const cleanRoot = await temporaryRoot("dsh-trash-clean-");
    now = new Date("2026-08-18T00:00:00.000Z");
    manager = createSkillManager({ root: cleanRoot, now: () => now });
    await manager.createSkill({ name: "clean-skill", description: "Clean." });
    const clean = await manager.deleteSkill({ name: "clean-skill" });
    now = new Date("2026-09-17T00:00:00.000Z");
    manager = createSkillManager({ root: cleanRoot, now: () => now });
    await expect(manager.listTrash()).resolves.toEqual([]);
    await expect(readdir(join(cleanRoot, "trash", "clean-skill", clean.trashId)))
      .rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
