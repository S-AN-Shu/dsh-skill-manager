import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createSkillManager,
  SkillManagerError,
  type MarketplaceSource
} from "@dsh-skill-manager/core";
import { Context } from "@deepseek-ai/cordis";
import { remoteMethods } from "@deepseek-ai/dsh-typert-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Config, DshSkillManagerService, resolveDshRoot } from "../src/index.js";
import {
  createSkillManagerRpcHandlers,
  type ListSkillsRpcRequest
} from "../src/rpc.js";
import { skillManagerDescriptors } from "../src/typert.host.js";

const temporaryRoots: string[] = [];
const unusedMarketplace: MarketplaceSource = {
  search: vi.fn(async () => ({
    source: "skills-sh",
    query: "unused",
    returnedCount: 0,
    entries: [],
    sources: [{ source: "skills-sh", status: "available", returnedCount: 0, error: null }]
  }))
};
const unusedResolver = {
  resolve: vi.fn(async () => {
    throw new Error("unused resolver");
  })
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("Skill Manager host RPC", () => {
  it("exports one Schemastery config contract through the service class", () => {
    expect(DshSkillManagerService.Config).toBe(Config);
    expect(Config({ root: "C:/isolated/manager", dshRoot: "C:/isolated/skills" })).toEqual({
      root: "C:/isolated/manager",
      dshRoot: "C:/isolated/skills"
    });
    expect(() => Config({ root: 42 } as never)).toThrow();
  });

  it("resolves DSH enablement to the native user Skill root", () => {
    const isolatedDshHome = join(tmpdir(), "isolated-dsh-home");
    const customDshRoot = join(tmpdir(), "custom-dsh-skills");
    expect(resolveDshRoot({}, { DSH_HOME: isolatedDshHome })).toBe(
      join(isolatedDshHome, "skills")
    );
    expect(resolveDshRoot({ dshRoot: customDshRoot }, {})).toBe(
      customDshRoot
    );
  });

  it("lists, creates, and enables a Skill through an injected manager", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const handlers = createSkillManagerRpcHandlers({
      manager: createSkillManager({ root }),
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });

    await expect(handlers.list({ schemaVersion: 1 })).resolves.toEqual({
      schemaVersion: 1,
      ok: true,
      data: { skills: [] }
    });

    const created = await handlers.create({
      schemaVersion: 1,
      name: "release-notes",
      description: "Prepare release notes from verified changes."
    });
    expect(created).toMatchObject({
      schemaVersion: 1,
      ok: true,
      data: {
        skill: {
          name: "release-notes",
          enabledTargets: []
        }
      }
    });

    const enabled = await handlers.setEnabled({
      schemaVersion: 1,
      name: "release-notes",
      enabled: true
    });
    expect(enabled).toMatchObject({
      schemaVersion: 1,
      ok: true,
      data: {
        skill: {
          name: "release-notes",
          enabledTargets: ["dsh"]
        }
      }
    });
    await expect(realpath(join(root, "active", "release-notes"))).resolves.toBe(
      await realpath(join(root, "library", "release-notes"))
    );

    const deleted = await handlers.delete({ schemaVersion: 1, name: "release-notes" });
    expect(deleted).toMatchObject({ ok: true, data: { deleted: { name: "release-notes" } } });
    const trashId = deleted.ok ? deleted.data.deleted.trashId : "";
    await expect(handlers.listTrash({ schemaVersion: 1 })).resolves.toMatchObject({
      ok: true,
      data: { trashed: [{ name: "release-notes", trashId }] }
    });
    await expect(handlers.restoreTrash({ schemaVersion: 1, name: "release-notes", trashId }))
      .resolves.toMatchObject({ ok: true, data: { skill: { name: "release-notes" } } });
    await expect(handlers.list({ schemaVersion: 1 })).resolves.toEqual({
      schemaVersion: 1,
      ok: true,
      data: { skills: [expect.objectContaining({ name: "release-notes" })] }
    });
  });

  it("preserves core errors and rejects unsupported protocol versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const handlers = createSkillManagerRpcHandlers({
      manager: createSkillManager({ root }),
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });
    const request = {
      schemaVersion: 1 as const,
      name: "release-notes",
      description: "Prepare release notes."
    };

    await handlers.create(request);
    await expect(handlers.create(request)).resolves.toEqual({
      schemaVersion: 1,
      ok: false,
      error: {
        code: "SKILL_ALREADY_EXISTS",
        message: "Skill \"release-notes\" already exists."
      }
    });

    const unsupported = { schemaVersion: 2 } as unknown as ListSkillsRpcRequest;
    await expect(handlers.list(unsupported)).resolves.toEqual({
      schemaVersion: 1,
      ok: false,
      error: {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: "Unsupported RPC schema version \"2\"."
      }
    });
  });

  it("discovers, imports, and links external Skills without browser paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    const codexRoot = await mkdtemp(join(tmpdir(), "codex-skills-rpc-"));
    const agentsRoot = await mkdtemp(join(tmpdir(), "agents-skills-rpc-"));
    temporaryRoots.push(root, codexRoot, agentsRoot);
    const source = join(codexRoot, "review-helper");
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(source);
      await writeFile(join(source, "SKILL.md"), "---\nname: review-helper\ndescription: Review safely.\n---\n\n# Review\n", "utf8");
    });
    const handlers = createSkillManagerRpcHandlers({
      manager: createSkillManager({ root, targetRoots: { codex: codexRoot, agents: agentsRoot } }),
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });

    const discovered = await handlers.discoverExternal({ schemaVersion: 1, targets: ["codex"] });
    expect(discovered).toMatchObject({
      ok: true,
      data: { candidates: [{ name: "review-helper", target: "codex" }] }
    });
    expect(JSON.stringify(discovered)).not.toContain(codexRoot);
    await expect(handlers.importExternal({ schemaVersion: 1, target: "codex", name: "review-helper" }))
      .resolves.toMatchObject({ ok: true, data: { skill: { name: "review-helper" } } });
    await expect(handlers.listTargetStates({ schemaVersion: 1, names: ["review-helper"], targets: ["codex", "agents"] }))
      .resolves.toMatchObject({ data: { states: [{ status: "not-linked" }, { status: "conflict" }] } });
    await expect(handlers.setTargetEnabled({ schemaVersion: 1, name: "review-helper", target: "agents", enabled: true }))
      .resolves.toMatchObject({ data: { skill: { enabledTargets: ["agents"] } } });
    const conflict = await handlers.setTargetEnabled({
      schemaVersion: 1,
      name: "review-helper",
      target: "codex",
      enabled: true
    });
    expect(conflict).toMatchObject({ ok: false, error: { code: "ACTIVE_PATH_CONFLICT" } });
    expect(JSON.stringify(conflict)).not.toContain(codexRoot);
  });

  it("strictly rejects filesystem paths in external synchronization requests", () => {
    const discover = skillManagerDescriptors.find((candidate) => candidate.method === "discoverExternal")!;
    const imported = skillManagerDescriptors.find((candidate) => candidate.method === "importExternal")!;
    expect(() => discover.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      roots: [{ target: "codex", path: "C:/arbitrary" }]
    })).toThrow();
    expect(() => imported.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      target: "codex",
      name: "review-helper",
      sourcePath: "C:/arbitrary/review-helper"
    })).toThrow();
  });

  it("keeps provenance RPC compatibility without discovery or browser repository authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const coreManager = createSkillManager({ root });
    const managed = await coreManager.createSkill({
      name: "react-guidance",
      description: "Production React architecture guidance."
    });
    const entry = { ...marketEntry(), name: "react-guidance", description: managed.description, catalogs: ["github" as const] };
    const resolvedEntry = resolvedMarketEntry(entry);
    const manager = {
      ...coreManager,
      verifyMarketplaceProvenance: vi.fn().mockResolvedValue({
        name: managed.name,
        status: "matched",
        skill: { ...managed, origin: "github" as const }
      })
    };
    const marketplace = { search: vi.fn().mockResolvedValue({
      source: "github" as const,
      query: managed.name,
      returnedCount: 1,
      entries: [entry],
      sources: [{ source: "github" as const, status: "available" as const, returnedCount: 1, error: null }]
    }) };
    const resolver = { resolve: vi.fn().mockResolvedValue(resolvedEntry) };
    const handlers = createSkillManagerRpcHandlers({ manager, marketplace, resolver });

    await expect(handlers.verifyProvenance({ schemaVersion: 1, name: managed.name }))
      .resolves.toMatchObject({ ok: false, error: { code: "PROVENANCE_MATCHING_DISABLED" } });
    expect(marketplace.search).not.toHaveBeenCalled();
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(manager.verifyMarketplaceProvenance).not.toHaveBeenCalled();

    const descriptor = skillManagerDescriptors.find((candidate) => candidate.method === "verifyProvenance")!;
    expect(() => descriptor.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      name: managed.name,
      repository: "attacker/repository"
    })).toThrow();
  });

  it("checks updates and exposes persistent backups through the Host", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const coreManager = createSkillManager({ root });
    const checks = [{
      name: "react-guidance",
      status: "update-available" as const,
      installed: {
        commitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        bundleHash: "c".repeat(64)
      },
      latest: {
        commitSha: "d".repeat(40),
        blobSha: "e".repeat(40),
        bundleHash: "f".repeat(64)
      },
      checkedAt: "2026-08-17T05:00:00.000Z"
    }];
    const backups = [{
      id: "11111111-1111-4111-8111-111111111111",
      name: "react-guidance",
      createdAt: "2026-08-17T05:01:00.000Z",
      reason: "update" as const,
      contentHash: "9".repeat(64),
      snapshot: checks[0]!.installed
    }];
    const manager = {
      ...coreManager,
      checkUpdates: vi.fn().mockResolvedValue(checks),
      listBackups: vi.fn().mockResolvedValue(backups)
    };
    const handlers = createSkillManagerRpcHandlers({
      manager,
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });

    await expect(handlers.checkUpdates({
      schemaVersion: 1,
      names: ["react-guidance"]
    })).resolves.toEqual({ schemaVersion: 1, ok: true, data: { checks } });
    await expect(handlers.listBackups({
      schemaVersion: 1,
      name: "react-guidance"
    })).resolves.toEqual({ schemaVersion: 1, ok: true, data: { backups } });
    expect(manager.checkUpdates).toHaveBeenCalledWith({ names: ["react-guidance"] });
    expect(manager.listBackups).toHaveBeenCalledWith({ name: "react-guidance" });
  });

  it("updates and rolls back only by managed name and opaque backup id", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const coreManager = createSkillManager({ root });
    const skill = {
      name: "react-guidance",
      description: "Updated guidance.",
      origin: "github" as const,
      enabledTargets: ["dsh" as const],
      createdAt: "2026-08-17T05:00:00.000Z",
      updatedAt: "2026-08-17T05:01:00.000Z",
      contentHash: "8".repeat(64),
      source: {
        kind: "github" as const,
        repository: "vercel-labs/agent-skills",
        path: "skills/react-guidance",
        commitSha: "d".repeat(40),
        blobSha: "e".repeat(40),
        bundleHash: "f".repeat(64),
        catalog: "skills-sh" as const,
        url: "https://github.com/vercel-labs/agent-skills"
      }
    };
    const backup = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "react-guidance",
      createdAt: "2026-08-17T05:01:00.000Z",
      reason: "update" as const,
      contentHash: "9".repeat(64),
      snapshot: {
        commitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        bundleHash: "c".repeat(64)
      }
    };
    const manager = {
      ...coreManager,
      updateSkill: vi.fn().mockResolvedValue({ skill, backup }),
      rollbackSkill: vi.fn().mockResolvedValue({ skill, backup })
    };
    const handlers = createSkillManagerRpcHandlers({
      manager,
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });

    await expect(handlers.update({ schemaVersion: 1, name: "react-guidance" }))
      .resolves.toEqual({ schemaVersion: 1, ok: true, data: { skill, backup } });
    await expect(handlers.rollback({
      schemaVersion: 1,
      name: "react-guidance",
      backupId: backup.id
    })).resolves.toEqual({ schemaVersion: 1, ok: true, data: { skill, backup } });
    expect(manager.updateSkill).toHaveBeenCalledWith({ name: "react-guidance" });
    expect(manager.rollbackSkill).toHaveBeenCalledWith({
      name: "react-guidance",
      backupId: backup.id
    });
  });

  it("strictly validates update and rollback Host requests", () => {
    const update = skillManagerDescriptors.find((candidate) => candidate.method === "update")!;
    const rollback = skillManagerDescriptors.find((candidate) => candidate.method === "rollback")!;

    expect(() => update.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      name: "react-guidance",
      commitSha: "a".repeat(40)
    })).toThrow();
    expect(() => rollback.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      name: "react-guidance",
      backupId: "11111111-1111-4111-8111-111111111111",
      path: "../../library"
    })).toThrow();
  });

  it("preserves stable core update and rollback errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-rpc-"));
    temporaryRoots.push(root);
    const coreManager = createSkillManager({ root });
    const manager = {
      ...coreManager,
      updateSkill: vi.fn().mockRejectedValue(new SkillManagerError(
        "SKILL_LOCAL_MODIFIED",
        "Skill \"react-guidance\" has local modifications."
      )),
      rollbackSkill: vi.fn().mockRejectedValue(new SkillManagerError(
        "SKILL_BACKUP_NOT_FOUND",
        "Skill backup was not found."
      ))
    };
    const handlers = createSkillManagerRpcHandlers({
      manager,
      marketplace: unusedMarketplace,
      resolver: unusedResolver
    });

    await expect(handlers.update({ schemaVersion: 1, name: "react-guidance" }))
      .resolves.toEqual({
        schemaVersion: 1,
        ok: false,
        error: {
          code: "SKILL_LOCAL_MODIFIED",
          message: "Skill \"react-guidance\" has local modifications."
        }
      });
    await expect(handlers.rollback({
      schemaVersion: 1,
      name: "react-guidance",
      backupId: "11111111-1111-4111-8111-111111111111"
    })).resolves.toEqual({
      schemaVersion: 1,
      ok: false,
      error: {
        code: "SKILL_BACKUP_NOT_FOUND",
        message: "Skill backup was not found."
      }
    });
  });

  it("strictly validates read-only update and backup Host requests", () => {
    const checkUpdates = skillManagerDescriptors.find(
      (candidate) => candidate.method === "checkUpdates"
    )!;
    const listBackups = skillManagerDescriptors.find(
      (candidate) => candidate.method === "listBackups"
    )!;

    expect(() => checkUpdates.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      names: ["react-guidance"],
      signal: { aborted: false }
    })).toThrow();
    expect(() => listBackups.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      name: "react-guidance",
      backupPath: "../../backups"
    })).toThrow();
  });

  it("rejects malformed update and backup results at the Typert boundary", () => {
    const checkUpdates = skillManagerDescriptors.find(
      (candidate) => candidate.method === "checkUpdates"
    )!;
    const listBackups = skillManagerDescriptors.find(
      (candidate) => candidate.method === "listBackups"
    )!;

    expect(() => checkUpdates.result.schema.parse({
      schemaVersion: 1,
      ok: true,
      data: {
        checks: [{
          name: "react-guidance",
          status: "update-available",
          installed: {
            commitSha: "not-a-commit",
            blobSha: "b".repeat(40),
            bundleHash: "c".repeat(64)
          },
          latest: null,
          checkedAt: "2026-08-17T05:00:00.000Z"
        }]
      }
    })).toThrow();
    expect(() => listBackups.result.schema.parse({
      schemaVersion: 1,
      ok: true,
      data: {
        backups: [{
          id: "not-a-backup-id",
          name: "react-guidance",
          createdAt: "2026-08-17T05:01:00.000Z",
          reason: "update",
          contentHash: "9".repeat(64),
          snapshot: null
        }]
      }
    })).toThrow();
  });

  it("exposes the verified DSH Typert service contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-service-"));
    temporaryRoots.push(root);
    const service = new DshSkillManagerService(new Context(), { root });

    expect(service.typertRemote).toMatchObject({
      serviceKey: "skillManager",
      namespace: "skillManager"
    });
    expect(remoteMethods(service)).toEqual([
      { method: "list", invocation: { kind: "direct" } },
      { method: "create", invocation: { kind: "direct" } },
      { method: "setEnabled", invocation: { kind: "direct" } },
      { method: "getCapabilities", invocation: { kind: "direct" } },
      { method: "searchRepositories", invocation: { kind: "direct" } },
      { method: "browseRepositories", invocation: { kind: "direct" } },
      { method: "inspectRepository", invocation: { kind: "direct" } },
      { method: "installSkill", invocation: { kind: "direct" } },
      { method: "installRepository", invocation: { kind: "direct" } },
      { method: "assessSkillRisk", invocation: { kind: "direct" } },
      { method: "resolveMedia", invocation: { kind: "direct" } },
      { method: "verifyProvenance", invocation: { kind: "direct" } },
      { method: "verifyProvenanceBatch", invocation: { kind: "direct" } },
      { method: "checkUpdates", invocation: { kind: "direct" } },
      { method: "update", invocation: { kind: "direct" } },
      { method: "listBackups", invocation: { kind: "direct" } },
      { method: "rollback", invocation: { kind: "direct" } },
      { method: "delete", invocation: { kind: "direct" } },
      { method: "listTrash", invocation: { kind: "direct" } },
      { method: "restoreTrash", invocation: { kind: "direct" } },
      { method: "discoverExternal", invocation: { kind: "direct" } },
      { method: "importExternal", invocation: { kind: "direct" } },
      { method: "listTargetStates", invocation: { kind: "direct" } },
      { method: "setTargetEnabled", invocation: { kind: "direct" } }
    ]);
    expect(skillManagerDescriptors.map((descriptor) => descriptor.method)).toEqual([
      "list",
      "create",
      "setEnabled",
      "getCapabilities",
      "searchRepositories",
      "browseRepositories",
      "inspectRepository",
      "installSkill",
      "installRepository",
      "assessSkillRisk",
      "resolveMedia",
      "verifyProvenance",
      "verifyProvenanceBatch",
      "checkUpdates",
      "update",
      "listBackups",
      "rollback",
      "delete",
      "listTrash",
      "restoreTrash",
      "discoverExternal",
      "importExternal",
      "listTargetStates",
      "setTargetEnabled"
    ]);
  });
});

function marketEntry() {
  return {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh" as const,
    catalogs: ["skills-sh" as const],
    name: "React guidance",
    description: null,
    publisher: { name: "vercel-labs", url: "https://github.com/vercel-labs" },
    author: null,
    repository: {
      host: "github" as const,
      owner: "vercel-labs",
      name: "agent-skills",
      path: null,
      url: "https://github.com/vercel-labs/agent-skills"
    },
    skillUrl: "https://skills.sh/vercel-labs/agent-skills/react-guidance",
    install: {
      kind: "github" as const,
      repository: "vercel-labs/agent-skills",
      skill: "react-guidance",
      path: null
    },
    metrics: {
      installs: { value: 123, source: "skills.sh" as const },
      stars: null,
      downloads: null
    },
    cover: {
      kind: "generated" as const,
      seed: "vercel-labs/agent-skills/react-guidance"
    }
  };
}

function resolvedMarketEntry(entry = marketEntry()) {
  return {
    ...entry,
    description: "Production React architecture guidance.",
    author: { name: "Jane Maintainer", url: null },
    repository: {
      ...entry.repository,
      id: 42,
      nodeId: "R_example",
      path: "skills/react-guidance"
    },
    install: { ...entry.install, path: "skills/react-guidance" },
    metrics: {
      ...entry.metrics,
      stars: { value: 900, source: "github" as const, scope: "repository" as const }
    },
    snapshot: {
      commitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      fetchedAt: "2026-08-17T00:00:00.000Z"
    }
  };
}
