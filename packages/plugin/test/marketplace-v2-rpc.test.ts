import { describe, expect, it, vi } from "vitest";

import { skillManagerDescriptors } from "../src/typert.host.js";
import { createSkillManagerRpcHandlers, type SkillManagerRpcDependencies } from "../src/rpc.js";

describe("Marketplace V2 RPC", () => {
  it("reports capabilities before the client calls V2 methods", async () => {
    const dependencies = ports();
    const handlers = createSkillManagerRpcHandlers({ ...dependencies, buildId: "test+v2" });

    await expect(handlers.getCapabilities({ schemaVersion: 1 })).resolves.toEqual({
      schemaVersion: 1,
      ok: true,
      data: {
        capabilities: {
          protocolVersion: 5,
          buildId: "test+v2",
          features: {
            marketplaceV2: true,
            repositoryInspection: true,
            mediaProxy: false,
            indexCatalog: false,
            riskAssessment: true,
            githubTrending: true,
            skillClassification: true,
            provenanceV2: false,
            updateRiskGate: true,
            repositoryBatchAnalysis: false,
            repositoryBatchInstall: false,
            batchProvenance: false,
            skillsShDiscoveryHints: false
          }
        }
      }
    });
  });

  it("accepts only repository identity and Skill path for installation", async () => {
    const dependencies = ports();
    const handlers = createSkillManagerRpcHandlers(dependencies);

    await expect(handlers.installSkill({
      schemaVersion: 1,
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review"
    })).resolves.toMatchObject({ ok: true, data: { skill: { name: "code-review" } } });
    expect(dependencies.snapshotResolver?.resolveSkillSnapshot).toHaveBeenCalledWith({
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review"
    }, { refreshCommit: false });
    expect(dependencies.riskAssessor?.assessResolvedSkillRisk).toHaveBeenCalledOnce();
    expect(dependencies.manager.installSkillSnapshot).toHaveBeenCalledOnce();

    const descriptor = skillManagerDescriptors.find((item) => item.method === "installSkill")!;
    expect(() => descriptor.parameters[0]!.codec.schema.parse({
      schemaVersion: 1,
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review",
      commit: "a".repeat(40),
      bundleHash: "b".repeat(64),
      localPath: "C:/users/private"
    })).toThrow();
  });

  it("scans the final resolved snapshot before writing and requires explicit high-risk acknowledgement", async () => {
    const dependencies = ports();
    dependencies.riskAssessor!.assessResolvedSkillRisk = vi.fn().mockReturnValue({
      risk: "high",
      findings: [{ code: "SCRIPT_PRESENT", severity: "high", title: "High risk", detail: "Review", file: "scripts/run.ps1" }],
      scannerVersion: "1.0.0"
    });
    const handlers = createSkillManagerRpcHandlers(dependencies);
    const intent = {
      schemaVersion: 1 as const,
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review"
    };

    await expect(handlers.installSkill(intent)).resolves.toMatchObject({
      ok: false,
      error: { code: "SKILL_RISK_CONFIRMATION_REQUIRED" }
    });
    expect(dependencies.manager.installSkillSnapshot).not.toHaveBeenCalled();

    await expect(handlers.installSkill({ ...intent, acknowledgeHighRisk: true })).resolves.toMatchObject({ ok: true });
    expect(dependencies.manager.installSkillSnapshot).toHaveBeenCalledOnce();
  });

  it("installs one prepared repository once while isolating an existing Skill and descriptor failures", async () => {
    const dependencies = ports();
    const resolved = await dependencies.snapshotResolver!.resolveSkillSnapshot({
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review"
    });
    vi.mocked(dependencies.snapshotResolver!.resolveSkillSnapshot).mockClear();
    dependencies.snapshotResolver!.resolveRepositorySnapshots = vi.fn().mockResolvedValue({
      inspection: {},
      snapshots: [resolved],
      failures: [{ skillPath: "skills/broken", code: "GITHUB_SKILL_NOT_INSTALLABLE", message: "Unsafe bundle." }]
    });
    const installed = {
      name: "code-review",
      description: "Review code safely.",
      origin: "github" as const,
      enabledTargets: [],
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
      contentHash: "d".repeat(64),
      source: {
        kind: "github" as const,
        repository: "openai/agent-skills",
        path: "skills/code-review",
        commitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        bundleHash: "c".repeat(64),
        catalog: "github" as const,
        url: "https://github.com/openai/agent-skills",
        repositoryId: 42
      }
    };
    dependencies.manager.listSkills = vi.fn().mockResolvedValue([installed]);
    const handlers = createSkillManagerRpcHandlers(dependencies);

    await expect(handlers.installRepository({
      schemaVersion: 1,
      repository: { owner: "openai", name: "agent-skills" },
      selection: { mode: "all" }
    })).resolves.toMatchObject({
      ok: true,
      data: {
        results: [
          { skillPath: "skills/broken", status: "failed", error: { code: "GITHUB_SKILL_NOT_INSTALLABLE" } },
          { skillPath: "skills/code-review", status: "already-installed", skill: { name: "code-review" } }
        ]
      }
    });
    expect(dependencies.snapshotResolver!.resolveRepositorySnapshots).toHaveBeenCalledWith({
      repository: { owner: "openai", name: "agent-skills" }
    }, { signal: expect.any(AbortSignal), refreshCommit: false });
    expect(dependencies.manager.installSkillSnapshot).not.toHaveBeenCalled();
  });

  it("keeps unknown-risk repository Skills blocked and requires acknowledgement only for high risk", async () => {
    const dependencies = ports();
    const resolved = await dependencies.snapshotResolver!.resolveSkillSnapshot({
      repository: { owner: "openai", name: "agent-skills" },
      skillPath: "skills/code-review"
    });
    vi.mocked(dependencies.snapshotResolver!.resolveSkillSnapshot).mockClear();
    dependencies.snapshotResolver!.resolveRepositorySnapshots = vi.fn().mockResolvedValue({
      inspection: {}, snapshots: [resolved], failures: []
    });
    dependencies.riskAssessor!.assessResolvedSkillRisk = vi.fn().mockReturnValue({
      risk: "unknown", findings: [], scannerVersion: "1.0.0"
    });
    const handlers = createSkillManagerRpcHandlers(dependencies);

    await expect(handlers.installRepository({
      schemaVersion: 1,
      repository: { owner: "openai", name: "agent-skills" },
      selection: { mode: "paths", paths: ["skills/code-review"] }
    })).resolves.toMatchObject({
      ok: true,
      data: { results: [{ status: "failed", error: { code: "SKILL_RISK_UNKNOWN" } }] }
    });
    expect(dependencies.manager.installSkillSnapshot).not.toHaveBeenCalled();
  });

  it("keeps provenance compatibility RPCs disabled without discovery traffic", async () => {
    const dependencies = ports();
    const handlers = createSkillManagerRpcHandlers(dependencies);

    await expect(handlers.verifyProvenance({ schemaVersion: 1, name: "local-skill" })).resolves.toMatchObject({
      ok: false,
      error: { code: "PROVENANCE_MATCHING_DISABLED" }
    });
    await expect(handlers.verifyProvenanceBatch({ schemaVersion: 1, names: ["local-skill"] })).resolves.toMatchObject({
      ok: false,
      error: { code: "PROVENANCE_MATCHING_DISABLED" }
    });
    expect(dependencies.marketplace.search).not.toHaveBeenCalled();
  });

  it("accepts the protocol 3 repository sorts", () => {
    const browse = skillManagerDescriptors.find((item) => item.method === "browseRepositories")!;
    const search = skillManagerDescriptors.find((item) => item.method === "searchRepositories")!;

    expect(browse.parameters[0]!.codec.schema.parse({ schemaVersion: 1, sort: "popular" }))
      .toEqual({ schemaVersion: 1, sort: "popular" });
    expect(search.parameters[0]!.codec.schema.parse({ schemaVersion: 1, query: "agent skills", sort: "relevance" }))
      .toEqual({ schemaVersion: 1, query: "agent skills", sort: "relevance" });
    for (const sort of ["latest", "trend-weekly", "trend-monthly"] as const) {
      expect(browse.parameters[0]!.codec.schema.parse({ schemaVersion: 1, sort }))
        .toEqual({ schemaVersion: 1, sort });
    }
    expect(() => browse.parameters[0]!.codec.schema.parse({ schemaVersion: 1, sort: "recently-updated" })).toThrow();
    expect(() => search.parameters[0]!.codec.schema.parse({ schemaVersion: 1, query: "agent skills", sort: "recently-updated" })).toThrow();
  });

  it("accepts HTML-only Trending candidates before GitHub owner metadata is inspected", () => {
    const browse = skillManagerDescriptors.find((item) => item.method === "browseRepositories")!;
    const candidate = {
      repositoryId: 0,
      nodeId: "trending:openai/agent-skills",
      repoKey: "github:openai/agent-skills",
      host: "github",
      owner: "openai",
      ownerId: 0,
      ownerType: "User",
      ownerAvatar: { type: "generated", seed: "owner:openai" },
      name: "agent-skills",
      fullName: "openai/agent-skills",
      description: "Portable agent skills.",
      url: "https://github.com/openai/agent-skills",
      defaultBranch: "HEAD",
      stars: 4_200,
      forks: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: "2026-08-19T00:00:00.000Z",
      pushedAt: "2026-08-19T00:00:00.000Z",
      topics: [],
      formatTopics: [],
      categoryTopics: [],
      archived: false,
      license: null,
      knownSkillCount: null,
      classification: {
        primaryCategory: "agent",
        tags: ["Agent"],
        evidence: [{ source: "description", value: "agent" }],
        confidence: "keyword"
      },
      trend: {
        weeklyStars: 100,
        monthlyStars: 400,
        observedAt: "2026-08-19T00:00:00.000Z",
        source: "github-trending-html",
        stale: false
      },
      cover: { type: "generated", seed: "github:openai/agent-skills" },
      discovery: {
        signals: [{ source: "github", kind: "metadata", label: "GitHub Trending HTML 候选" }],
        discoveredAt: "2026-08-19T00:00:00.000Z"
      }
    };

    expect(() => browse.result.schema.parse({
      schemaVersion: 1,
      ok: true,
      data: {
        result: {
          source: "github",
          query: null,
          sort: "trend-monthly",
          page: 1,
          returnedCount: 1,
          total: 1,
          hasMore: false,
          incomplete: false,
          dataUpdatedAt: "2026-08-19T00:00:00.000Z",
          sourceState: "live",
          sourceMessage: null,
          repositories: [candidate]
        }
      }
    })).not.toThrow();
  });

  it("exposes the replacement V2 method set", () => {
    expect(skillManagerDescriptors.map((descriptor) => descriptor.method)).toEqual([
      "list", "create", "setEnabled",
      "getCapabilities", "searchRepositories", "browseRepositories", "inspectRepository",
      "installSkill", "installRepository", "assessSkillRisk", "resolveMedia", "verifyProvenance", "verifyProvenanceBatch",
      "checkUpdates", "update", "listBackups", "rollback", "delete", "listTrash", "restoreTrash",
      "discoverExternal", "importExternal", "listTargetStates", "setTargetEnabled"
    ]);
  });
});

function ports(): SkillManagerRpcDependencies {
  const commit = "a".repeat(40);
  const blobSha = "b".repeat(40);
  const repository = {
    repositoryId: 42, nodeId: "R_example", repoKey: "github:openai/agent-skills", host: "github" as const,
    owner: "openai", ownerId: 1, ownerType: "Organization" as const, ownerAvatar: { type: "github-avatar" as const, owner: "openai", accountId: 1 },
    name: "agent-skills", fullName: "openai/agent-skills", description: "Portable skills.",
    url: "https://github.com/openai/agent-skills", defaultBranch: "main", stars: 42, forks: 4,
    createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-17T00:00:00.000Z", pushedAt: "2026-08-17T00:00:00.000Z", topics: ["agent-skills"],
    formatTopics: ["agent-skills"], categoryTopics: [], archived: false, license: "MIT", knownSkillCount: 1,
    classification: { primaryCategory: "agent", tags: ["Agent"], evidence: [{ source: "github-topic", value: "agent-skills" }], confidence: "topic" }, trend: null,
    cover: { type: "generated" as const, seed: "agent-skills" }, discovery: { signals: [], discoveredAt: "2026-08-17T00:00:00.000Z" }
  };
  const descriptor = {
    skillKey: "github:openai/agent-skills#skills/code-review", repositoryId: 42,
    path: "skills/code-review", name: "code-review", description: "Review code safely.", author: null,
    structureStatus: "structure-verified" as const, validatedAtCommit: commit,
    classification: { primaryCategory: "development", tags: ["代码"], evidence: [{ source: "name", value: "code" }], confidence: "keyword" },
    skillDocumentBlobSha: blobSha, manifestFiles: [], installable: true, warnings: []
  };
  const resolved = {
    repository,
    skill: descriptor,
    snapshot: {
      snapshotKey: `${descriptor.skillKey}@${commit}`, repository: { owner: "openai", name: "agent-skills" },
      skillPath: descriptor.path, commitSha: commit, skillDocumentBlobSha: blobSha, files: [], bundleHash: "c".repeat(64),
      integrity: { commitPinned: true as const, pathsSafe: true as const, frontmatterValid: true as const, symlinksRejected: true as const, submodulesRejected: true as const }
    },
    files: []
  };
  const skill = {
    name: "code-review", description: "Review code safely.", origin: "github" as const,
    enabledTargets: [], createdAt: "2026-08-17T00:00:00.000Z", updatedAt: "2026-08-17T00:00:00.000Z",
    contentHash: "c".repeat(64)
  };
  return {
    manager: {
      listSkills: vi.fn().mockResolvedValue([]), createSkill: vi.fn(), setTargetEnabled: vi.fn(),
      installMarketplaceSkill: vi.fn().mockResolvedValue(skill), verifyMarketplaceProvenance: vi.fn(),
      installSkillSnapshot: vi.fn().mockResolvedValue(skill),
      checkUpdates: vi.fn(), updateSkill: vi.fn(), listBackups: vi.fn(), rollbackSkill: vi.fn(),
      discoverExternalSkills: vi.fn(), importSkill: vi.fn(), listTargetStates: vi.fn()
    },
    marketplace: { search: vi.fn() },
    resolver: { resolve: vi.fn() },
    repositoryDiscovery: { searchRepositories: vi.fn(), browseRepositories: vi.fn() },
    repositoryInspector: { inspectRepository: vi.fn() },
    snapshotResolver: { resolveSkillSnapshot: vi.fn().mockResolvedValue(resolved) },
    riskAssessor: {
      assessSkillRisk: vi.fn(),
      assessResolvedSkillRisk: vi.fn().mockReturnValue({ risk: "low", findings: [], scannerVersion: "1.0.0" })
    }
  };
}

function managedSkill(name: string) {
  return {
    name,
    description: `Description for ${name}.`,
    origin: "self" as const,
    enabledTargets: [],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    contentHash: "c".repeat(64)
  };
}
