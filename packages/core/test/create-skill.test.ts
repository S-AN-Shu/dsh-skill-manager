import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createSkillManager } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("managed Skill creation", () => {
  test("creates a valid bundle that can be read through the manager", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-"));
    roots.push(root);
    const manager = createSkillManager({ root });

    const created = await manager.createSkill({
      name: "example-skill",
      description: "Explain one focused example."
    });

    expect(created).toMatchObject({
      name: "example-skill",
      description: "Explain one focused example.",
      origin: "self",
      enabledTargets: []
    });

    const stored = await manager.getSkill("example-skill");
    expect(stored).toMatchObject({
      name: "example-skill",
      description: "Explain one focused example.",
      content: "# example-skill\n\nDescribe how this Skill should guide the agent.\n"
    });
  });

  test("does not require a marketplace fetch implementation for local operations", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-"));
    roots.push(root);
    const originalFetch = globalThis.fetch;
    Reflect.deleteProperty(globalThis, "fetch");
    try {
      const manager = createSkillManager({ root });

      await expect(manager.createSkill({
        name: "offline-skill",
        description: "Create a Skill without network capabilities."
      })).resolves.toMatchObject({ name: "offline-skill" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
