import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createSkillManager } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("external Skill discovery", () => {
  test("discovers metadata from configured roots without exposing paths or body content", async () => {
    const managerRoot = await temporaryRoot("dsh-skill-manager-");
    const codexRoot = await temporaryRoot("codex-skills-");
    const claudeRoot = await temporaryRoot("claude-skills-");
    const agentsRoot = await temporaryRoot("agents-skills-");
    await writeSkill(codexRoot, "zebra-helper", "Review a zebra change.", "SECRET_CODEX_BODY");
    await writeSkill(claudeRoot, "alpha-helper", "Review an alpha change.", "SECRET_CLAUDE_BODY");
    await writeSkill(agentsRoot, "middle-helper", "Review a middle change.", "SECRET_AGENTS_BODY");
    await writeFile(join(codexRoot, "AGENTS.md"), "Do not read this instruction.\n", "utf8");
    await writeFile(join(claudeRoot, "CLAUDE.md"), "Do not read this instruction.\n", "utf8");

    const manager = createSkillManager({
      root: managerRoot,
      targetRoots: { codex: codexRoot, claude: claudeRoot, agents: agentsRoot }
    });
    const candidates = await manager.discoverExternalSkills();

    expect(candidates.map(({ name, description, target }) => ({ name, description, target })))
      .toEqual([
        { name: "middle-helper", description: "Review a middle change.", target: "agents" },
        { name: "alpha-helper", description: "Review an alpha change.", target: "claude" },
        { name: "zebra-helper", description: "Review a zebra change.", target: "codex" }
      ]);
    expect(candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.contentHash))).toBe(true);
    expect(JSON.stringify(candidates)).not.toContain(managerRoot);
    expect(JSON.stringify(candidates)).not.toContain("SECRET_");
    expect(JSON.stringify(candidates)).not.toContain("Do not read");
  });

  test("discovers OpenCode independently from other trusted runtime roots", async () => {
    const managerRoot = await temporaryRoot("skill-manager-");
    const opencodeRoot = await temporaryRoot("opencode-skills-");
    await writeSkill(opencodeRoot, "game-writer", "Write branching game stories.", "PRIVATE_BODY");
    const manager = createSkillManager({
      root: managerRoot,
      targetRoots: { opencode: opencodeRoot }
    });

    await expect(manager.discoverExternalSkills({ targets: ["opencode"] })).resolves.toEqual([{
      name: "game-writer",
      description: "Write branching game stories.",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      target: "opencode"
    }]);
  });

  test("ignores top-level links and malformed external metadata", async () => {
    const managerRoot = await temporaryRoot("dsh-skill-manager-");
    const codexRoot = await temporaryRoot("codex-skills-");
    const outsideRoot = await temporaryRoot("outside-skill-");
    await writeSkill(outsideRoot, "outside-helper", "Outside root.", "# Outside\n");
    await symlink(
      join(outsideRoot, "outside-helper"),
      join(codexRoot, "outside-helper"),
      process.platform === "win32" ? "junction" : "dir"
    );
    await mkdir(join(codexRoot, "broken-helper"));
    await writeFile(join(codexRoot, "broken-helper", "SKILL.md"), "---\nname: [\n---\n", "utf8");
    const manager = createSkillManager({ root: managerRoot, targetRoots: { codex: codexRoot } });

    await expect(manager.discoverExternalSkills()).resolves.toEqual([]);
    await expect(manager.importSkill({ target: "codex", name: "outside-helper" }))
      .rejects.toMatchObject({ code: "SKILL_SOURCE_INVALID" });
    await expect(manager.importSkill({ target: "codex", name: "broken-helper" }))
      .rejects.toMatchObject({ code: "SKILL_SOURCE_INVALID" });
  });
});

describe("external Skill import", () => {
  test("imports one configured direct child bundle without adjacent Agent instructions", async () => {
    const managerRoot = await temporaryRoot("dsh-skill-manager-");
    const codexRoot = await temporaryRoot("codex-skills-");
    const source = await writeSkill(
      codexRoot,
      "review-helper",
      "Review one focused change.",
      "# Review helper\n"
    );
    await mkdir(join(source, "references"), { recursive: true });
    await writeFile(join(source, "references", "checklist.md"), "# Checklist\n", "utf8");
    await writeFile(join(codexRoot, "AGENTS.md"), "Do not import this file.\n", "utf8");

    const manager = createSkillManager({
      root: managerRoot,
      targetRoots: { codex: codexRoot }
    });
    const [candidate] = await manager.discoverExternalSkills({ targets: ["codex"] });
    const imported = await manager.importSkill({ target: "codex", name: "review-helper" });

    expect(imported).toMatchObject({
      name: "review-helper",
      origin: "self",
      enabledTargets: [],
      contentHash: candidate?.contentHash,
      source: { kind: "local-import", name: "review-helper", target: "codex" }
    });
    expect(JSON.stringify(imported)).not.toContain(codexRoot);
    await expect(readFile(
      join(managerRoot, "library", "review-helper", "references", "checklist.md"),
      "utf8"
    )).resolves.toBe("# Checklist\n");
    await expect(access(join(managerRoot, "library", "review-helper", "AGENTS.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects missing configuration and non-direct-child names", async () => {
    const managerRoot = await temporaryRoot("dsh-skill-manager-");
    const codexRoot = await temporaryRoot("codex-skills-");
    const manager = createSkillManager({ root: managerRoot, targetRoots: { codex: codexRoot } });

    await expect(manager.importSkill({ target: "claude", name: "review-helper" }))
      .rejects.toMatchObject({ code: "TARGET_NOT_CONFIGURED" });
    await expect(manager.importSkill({ target: "codex", name: "../review-helper" }))
      .rejects.toMatchObject({ code: "INVALID_SKILL_NAME" });
  });
});

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function writeSkill(
  root: string,
  name: string,
  description: string,
  body: string
): Promise<string> {
  const source = join(root, name);
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "SKILL.md"), [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    body
  ].join("\n"), "utf8");
  return source;
}
