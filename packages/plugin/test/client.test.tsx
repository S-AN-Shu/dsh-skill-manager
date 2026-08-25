// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@deepseek-ai/dsh-client-ui-primitives", () => ({
  IconCloseOutline16: () => null,
  IconPlusOutline16: () => null,
  IconRefreshOutline16: () => null,
  IconRightUpOutline14: () => null,
  IconSearchOutline16: () => null
}));

import {
  adaptTypertRemote,
  apply,
  ensureSkillManagerStyles,
  SkillManagerPanel,
  type SkillManagerRemote
} from "../src/client.js";
import { skillManagerClientDescriptors } from "../src/client-descriptors.js";
import type {
  ManagedSkillWire,
  MarketplaceEntryWire,
  RepositoryCandidateWire,
  RepositoryInspectionWire,
  RpcResponse,
  SkillBackupWire,
  SkillTargetStateWire,
  SkillUpdateCheckWire
} from "../src/rpc.js";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

it("injects the client stylesheet idempotently", () => {
  const disposeFirst = ensureSkillManagerStyles();
  const disposeSecond = ensureSkillManagerStyles();
  expect(document.querySelectorAll('style[data-plugin-css="dsh-skill-manager/client"]')).toHaveLength(1);
  disposeFirst();
  expect(document.querySelectorAll('style[data-plugin-css="dsh-skill-manager/client"]')).toHaveLength(1);
  disposeSecond();
  expect(document.querySelectorAll('style[data-plugin-css="dsh-skill-manager/client"]')).toHaveLength(0);
});

it("unwraps the Typert transport envelope before the settings component uses RPC data", async () => {
  const transport = {
    list: vi.fn().mockResolvedValue({
      ok: true,
      value: { schemaVersion: 1, ok: true, data: { skills: [] } }
    }),
    create: vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "TRANSPORT_ERROR", message: "Connection failed." }
    })
  };
  const remote = adaptTypertRemote(transport as never);

  await expect(remote.list({ schemaVersion: 1 })).resolves.toEqual({
    schemaVersion: 1,
    ok: true,
    data: { skills: [] }
  });
  await expect(remote.create({
    schemaVersion: 1,
    name: "release-notes",
    description: "Prepare release notes."
  })).rejects.toThrow("Connection failed. (TRANSPORT_ERROR)");
});

function skill(overrides: Partial<ManagedSkillWire> = {}): ManagedSkillWire {
  return {
    name: "release-notes",
    description: "Prepare release notes from verified changes.",
    origin: "self",
    enabledTargets: [],
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    contentHash: "abc123",
    ...overrides
  };
}

function marketSkill(overrides: Partial<MarketplaceEntryWire> = {}): MarketplaceEntryWire {
  return {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh",
    catalogs: ["skills-sh"],
    name: "React guidance",
    description: null,
    publisher: {
      name: "vercel-labs",
      url: "https://github.com/vercel-labs"
    },
    author: null,
    repository: {
      host: "github",
      owner: "vercel-labs",
      name: "agent-skills",
      path: null,
      url: "https://github.com/vercel-labs/agent-skills"
    },
    skillUrl: "https://skills.sh/vercel-labs/agent-skills/react-guidance",
    install: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      skill: "react-guidance",
      path: null
    },
    metrics: {
      installs: { value: 123, source: "skills.sh" },
      stars: null,
      downloads: null
    },
    cover: {
      kind: "generated",
      seed: "vercel-labs/agent-skills/react-guidance"
    },
    ...overrides
  };
}

function repositoryCandidate(
  overrides: Partial<RepositoryCandidateWire> = {}
): RepositoryCandidateWire {
  return {
    repositoryId: 42,
    nodeId: "R_example",
    repoKey: "github:openai/agent-skills",
    host: "github",
    owner: "openai",
    ownerId: 1,
    ownerType: "Organization",
    ownerAvatar: { type: "github-avatar", owner: "openai", accountId: 1 },
    name: "agent-skills",
    fullName: "openai/agent-skills",
    description: "Portable agent skills.",
    url: "https://github.com/openai/agent-skills",
    defaultBranch: "main",
    stars: 4200,
    forks: 180,
    updatedAt: "2026-08-17T00:00:00.000Z",
    pushedAt: "2026-08-17T00:00:00.000Z",
    topics: ["agent-skills", "coding"],
    formatTopics: ["agent-skills"],
    categoryTopics: ["coding"],
    archived: false,
    license: "MIT",
    knownSkillCount: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    classification: {
      primaryCategory: "development",
      tags: ["代码"],
      evidence: [{ source: "github-topic", value: "coding" }],
      confidence: "topic"
    },
    trend: {
      weeklyStars: 120,
      monthlyStars: 480,
      observedAt: "2026-08-17T00:00:00.000Z",
      source: "github-trending-html",
      stale: false
    },
    cover: { type: "generated", seed: "github:openai/agent-skills" },
    discovery: {
      signals: [{ source: "github", kind: "format-topic", label: "Topic: agent-skills" }],
      discoveredAt: "2026-08-17T00:00:00.000Z"
    },
    ...overrides
  };
}

function repositoryInspection(repository = repositoryCandidate()): RepositoryInspectionWire {
  const commit = "a".repeat(40);
  return {
    repository: { ...repository, knownSkillCount: 2 },
    inspectionCommit: commit,
    inspectedAt: "2026-08-17T00:00:00.000Z",
    status: "structure-verified",
    readme: { path: "README.md", title: "Agent Skills", content: "# Agent Skills", blobSha: "b".repeat(40) },
    manifestPaths: ["skills.json"],
    declaredSkillPaths: ["skills/code-review", "skills/design-audit"],
    skills: [
      { skillKey: "github:openai/agent-skills#skills/code-review", repositoryId: 42, path: "skills/code-review", name: "code-review", description: "Review code safely.", classification: { primaryCategory: "development", tags: ["代码"], evidence: [{ source: "name", value: "code" }], confidence: "keyword" }, author: null, structureStatus: "structure-verified", validatedAtCommit: commit, skillDocumentBlobSha: "c".repeat(40), installable: true, warnings: [] },
      { skillKey: "github:openai/agent-skills#skills/design-audit", repositoryId: 42, path: "skills/design-audit", name: "design-audit", description: "Audit product interfaces.", classification: { primaryCategory: "design", tags: ["设计"], evidence: [{ source: "name", value: "design" }], confidence: "keyword" }, author: null, structureStatus: "structure-verified", validatedAtCommit: commit, skillDocumentBlobSha: "d".repeat(40), installable: true, warnings: [] }
    ],
    media: [{ type: "github-social-preview", repo: repository.repoKey }],
    warnings: []
  };
}

function v2Remote(options: {
  repositories?: RepositoryCandidateWire[];
  inspection?: RepositoryInspectionWire;
  skills?: ManagedSkillWire[];
  mediaProxy?: boolean;
} = {}): SkillManagerRemote & Record<string, ReturnType<typeof vi.fn>> {
  const repositories = options.repositories ?? [];
  const inspection = options.inspection ?? repositoryInspection();
  return {
    list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: options.skills ?? [] } }),
    create: vi.fn(), setEnabled: vi.fn(),
    getCapabilities: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { capabilities: {
      protocolVersion: 5, buildId: "test+v5", features: {
        marketplaceV2: true, repositoryInspection: true, mediaProxy: options.mediaProxy ?? false,
        indexCatalog: false, riskAssessment: true, githubTrending: true, skillClassification: true,
        provenanceV2: true, updateRiskGate: true, repositoryBatchAnalysis: true,
        repositoryBatchInstall: true, batchProvenance: true, skillsShDiscoveryHints: true
      }
    } } }),
    browseRepositories: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { result: {
      source: "github", query: null, sort: "trend-monthly", page: 1, returnedCount: repositories.length,
      total: repositories.length, hasMore: false, incomplete: false,
      dataUpdatedAt: "2026-08-17T00:00:00.000Z", sourceState: "live", sourceMessage: null, repositories
    } } }),
    searchRepositories: vi.fn(),
    inspectRepository: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: {
      inspection,
      assessments: inspection.skills.filter((skill) => skill.installable).map((skill) => ({
        skillPath: skill.path,
        assessment: { risk: "low" as const, findings: [], scannerVersion: "1.0.0" }
      }))
    } }),
    installSkill: vi.fn(),
    installRepository: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { results: [] } }),
    assessSkillRisk: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: {
      assessment: { risk: "low", findings: [], scannerVersion: "1.0.0" }
    } }),
    resolveMedia: vi.fn(),
    verifyProvenance: vi.fn(), checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn(),
    discoverExternal: vi.fn(), importExternal: vi.fn(), listTargetStates: vi.fn(), setTargetEnabled: vi.fn()
  } as SkillManagerRemote & Record<string, ReturnType<typeof vi.fn>>;
}

function githubSkill(overrides: Partial<ManagedSkillWire> = {}): ManagedSkillWire {
  return skill({
    name: "react-guidance",
    description: "Production React architecture guidance.",
    origin: "github",
    source: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      path: "skills/react-guidance",
      commitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      bundleHash: "c".repeat(64),
      catalog: "skills-sh",
      url: "https://github.com/vercel-labs/agent-skills"
    },
    ...overrides
  });
}

function updateCheck(overrides: Partial<SkillUpdateCheckWire> = {}): SkillUpdateCheckWire {
  return {
    name: "react-guidance",
    status: "update-available",
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
    checkedAt: "2026-08-17T05:00:00.000Z",
    ...overrides
  };
}

function backup(overrides: Partial<SkillBackupWire> = {}): SkillBackupWire {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "react-guidance",
    createdAt: "2026-08-17T05:01:00.000Z",
    reason: "update",
    contentHash: "9".repeat(64),
    snapshot: {
      commitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      bundleHash: "c".repeat(64)
    },
    ...overrides
  };
}

describe("Skill Manager settings panel", () => {
  it("loads repository candidates only after V2 capability negotiation", async () => {
    const repository = repositoryCandidate();
    const remote = v2Remote({ repositories: [repository] });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));

    await waitFor(() => expect(remote.getCapabilities).toHaveBeenCalledWith({ schemaVersion: 1 }));
    await waitFor(() => expect(remote.browseRepositories).toHaveBeenCalledWith({
      schemaVersion: 1, sort: "trend-monthly", page: 1, limit: 20
    }));
    expect(await screen.findByText("openai/agent-skills")).toBeTruthy();
    expect(screen.getByText("列表阶段不读取 README 或 Tree", { exact: false })).toBeTruthy();
    const sortGroup = screen.getByRole("group", { name: "市场排序" });
    expect(Array.from(sortGroup.querySelectorAll("button"), (button) => button.textContent)).toEqual([
      "近期热度榜", "历史热门", "最新", "相关度"
    ]);
    expect(screen.queryByRole("button", { name: "最近更新" })).toBeNull();
    expect(screen.queryByRole("button", { name: "最新创建" })).toBeNull();
  });

  it("labels GitHub repository search and performs a new remote category search", async () => {
    const coding = repositoryCandidate();
    const security = repositoryCandidate({
      repositoryId: 43,
      nodeId: "R_security",
      repoKey: "github:secure-labs/security-skills",
      owner: "secure-labs",
      name: "security-skills",
      fullName: "secure-labs/security-skills",
      description: "Security audit skills.",
      url: "https://github.com/secure-labs/security-skills",
      topics: ["agent-skills", "security"],
      categoryTopics: ["security"],
      classification: {
        primaryCategory: "security",
        tags: ["安全"],
        evidence: [{ source: "github-topic", value: "security" }],
        confidence: "topic"
      }
    });
    const remote = v2Remote({ repositories: [coding, security] });
    remote.searchRepositories.mockResolvedValue({ schemaVersion: 1, ok: true, data: { result: {
      source: "github", query: "security skill", sort: "relevance", page: 1,
      returnedCount: 1, total: 1, hasMore: false, incomplete: false,
      dataUpdatedAt: "2026-08-17T00:00:00.000Z", sourceState: "live", sourceMessage: null, repositories: [security]
    } } });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    expect(await screen.findByRole("searchbox", { name: "搜索 GitHub Skill 仓库" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "GitHub Skill 分类" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "历史热门" }));
    await waitFor(() => expect(remote.browseRepositories).toHaveBeenLastCalledWith({
      schemaVersion: 1, sort: "popular", page: 1, limit: 20
    }));
    await user.click(screen.getByRole("button", { name: "安全与合规" }));
    await waitFor(() => expect(remote.searchRepositories).toHaveBeenCalledWith({
      schemaVersion: 1, query: "security compliance skill", sort: "relevance", page: 1, limit: 20
    }));
    expect(screen.queryByText("openai/agent-skills")).toBeNull();
    expect(screen.getByText("secure-labs/security-skills")).toBeTruthy();
    expect(screen.getByText("选择分类会重新搜索 GitHub 候选", { exact: false })).toBeTruthy();
  });

  it("defaults keyword search to relevance and honors an explicit historical popularity sort", async () => {
    const repository = repositoryCandidate();
    const remote = v2Remote({ repositories: [repository] });
    remote.searchRepositories.mockImplementation(async (request) => ({
      schemaVersion: 1, ok: true, data: { result: {
        source: "github", query: request.query, sort: request.sort ?? "relevance", page: 1,
        returnedCount: 1, total: 1, hasMore: false, incomplete: false,
        dataUpdatedAt: "2026-08-17T00:00:00.000Z", sourceState: "live", sourceMessage: null, repositories: [repository]
      } }
    }));
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await user.click(await screen.findByRole("tab", { name: "Skill 市场" }));
    const input = await screen.findByRole("searchbox", { name: "搜索 GitHub Skill 仓库" });
    await user.type(input, "writing");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(remote.searchRepositories).toHaveBeenLastCalledWith({
      schemaVersion: 1, query: "writing", sort: "relevance", page: 1, limit: 20
    }));
    expect(screen.getByRole("button", { name: "相关度" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "历史热门" }));
    await waitFor(() => expect(remote.searchRepositories).toHaveBeenLastCalledWith({
      schemaVersion: 1, query: "writing", sort: "popular", page: 1, limit: 20
    }));
    expect(screen.getByRole("button", { name: "历史热门" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("explains when a remote category search returns no repositories", async () => {
    const remote = v2Remote({ repositories: [repositoryCandidate()] });
    remote.searchRepositories.mockResolvedValue({ schemaVersion: 1, ok: true, data: { result: {
      source: "github", query: "security skill", sort: "relevance", page: 1,
      returnedCount: 0, total: 0, hasMore: false, incomplete: false,
      dataUpdatedAt: "2026-08-17T00:00:00.000Z", sourceState: "live", sourceMessage: null, repositories: []
    } } });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "安全与合规" }));

    expect(await screen.findByText("当前趋势榜没有该分类候选")).toBeTruthy();
    expect(screen.getByText("GitHub Trending 只展示全站榜单中出现的 Skill 候选", { exact: false })).toBeTruthy();
  });

  it("shows a restart action message when Marketplace V2 capabilities are missing", async () => {
    const remote = v2Remote();
    remote.getCapabilities = vi.fn().mockResolvedValue({
      schemaVersion: 1, ok: true, data: { capabilities: {
        protocolVersion: 1, buildId: "old", features: {
          marketplaceV2: false, repositoryInspection: false, mediaProxy: false,
          indexCatalog: false, riskAssessment: false
        }
      } }
    });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));

    expect(await screen.findByText("Skill Manager Host 版本较旧", { exact: true })).toBeTruthy();
    expect(screen.getByText("请重启 DSH Desktop，让 Host 和客户端加载同一版 Marketplace V2。")).toBeTruthy();
    expect(remote.browseRepositories).not.toHaveBeenCalled();
  });

  it("inspects multiple Skills and isolates batch installation failures", async () => {
    const repository = repositoryCandidate();
    const inspection = repositoryInspection(repository);
    const remote = v2Remote({ repositories: [repository], inspection });
    remote.installRepository = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { results: [
      { skillPath: "skills/code-review", status: "installed", skill: githubSkill({ name: "code-review" }) },
      { skillPath: "skills/design-audit", status: "failed", error: { code: "INVALID_MARKETPLACE_INSTALL", message: "Bundle failed validation." } }
    ] } });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));

    expect(await screen.findByRole("dialog", { name: "openai/agent-skills" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "GitHub Skill 仓库列表" })).toBeTruthy();
    expect(screen.queryByText("查看详情")).toBeNull();
    expect(await screen.findByText("code-review")).toBeTruthy();
    expect(screen.getByText("design-audit")).toBeTruthy();
    expect(screen.getAllByText("结构证据：固定检查 commit · SKILL.md 已解析").length).toBe(2);
    expect(screen.getAllByText("安装完整性：Host 安装时重新解析并验证完整 bundle").length).toBe(2);
    await user.click(screen.getByRole("button", { name: "安装所选 (2)" }));

    await waitFor(() => expect(remote.installRepository).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("安装成功")).toBeTruthy();
    expect(screen.getByText("Bundle failed validation.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "关闭安装确认" }));
    await user.click(screen.getByRole("tab", { name: "Skill 管理" }));
    expect(await screen.findByText("code-review")).toBeTruthy();
  });

  it("portals a visible loading dialog before repository Inspection finishes", async () => {
    const repository = repositoryCandidate();
    const inspection = repositoryInspection(repository);
    const remote = v2Remote({ repositories: [repository], inspection });
    let finishInspection: ((result: RpcResponse<import("../src/rpc.js").RepositoryInspectionResultWire>) => void) | undefined;
    remote.inspectRepository = vi.fn().mockImplementation(() => new Promise((resolve) => {
      finishInspection = resolve;
    }));
    const user = userEvent.setup();
    const rendered = render(<SkillManagerPanel remote={remote} />);
    await user.click(await screen.findByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));

    const dialog = await screen.findByRole("dialog", { name: "openai/agent-skills" });
    expect(screen.getByRole("status").textContent).toContain("正在准备仓库内容");
    expect(dialog.textContent).toContain("Portable agent skills.");
    expect(dialog.textContent).toContain("openai");
    expect(dialog.parentElement?.classList.contains("dsm-modal-backdrop")).toBe(true);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(rendered.container.contains(dialog)).toBe(false);

    finishInspection?.({ schemaVersion: 1, ok: true, data: { inspection, assessments: [] } });
    expect(await screen.findByText("code-review")).toBeTruthy();
  });

  it("keeps up to eight resolved repository images when one media item fails and switches the primary preview", async () => {
    const repository = repositoryCandidate();
    const inspection = repositoryInspection(repository);
    const repositoryImages = Array.from({ length: 9 }, (_, index) => ({
      type: "repo-blob" as const,
      repo: repository.repoKey,
      commit: inspection.inspectionCommit,
      path: `docs/screenshot-${index + 1}.png`
    }));
    inspection.media = [
      ...repositoryImages,
      { type: "github-social-preview", repo: repository.repoKey }
    ];
    const remote = v2Remote({ repositories: [repository], inspection, mediaProxy: true });
    remote.resolveMedia = vi.fn().mockImplementation(async ({ source }: { source: import("../src/rpc.js").MediaSourceWire }) => {
      if (source.type === "repo-blob" && source.path.endsWith("screenshot-2.png")) {
        throw new Error("Preview image is unavailable.");
      }
      const identity = source.type === "repo-blob"
        ? source.path
        : source.type === "github-avatar"
          ? `avatar-${source.accountId}`
          : source.type;
      return {
        schemaVersion: 1,
        ok: true,
        data: {
          asset: {
            source,
            dataUrl: `data:image/png;base64,${btoa(identity)}`,
            mimeType: "image/png",
            width: 640,
            height: 360
          }
        }
      };
    });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(await screen.findByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));
    await screen.findByText("code-review");

    const thumbnails = await screen.findAllByRole("button", { name: /查看仓库图片/u });
    expect(thumbnails).toHaveLength(8);
    expect(remote.resolveMedia).toHaveBeenCalledTimes(10);
    expect(remote.resolveMedia).not.toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ path: "docs/screenshot-9.png" })
    }));
    const primary = screen.getByRole("img", { name: "openai/agent-skills 仓库预览" }) as HTMLImageElement;
    expect(primary.src).toContain(btoa("docs/screenshot-1.png"));
    const secondThumbnail = thumbnails[1]!;
    const secondSource = secondThumbnail.querySelector("img")?.getAttribute("src");
    await user.click(secondThumbnail);
    expect(primary.getAttribute("src")).toBe(secondSource);
  });

  it("marks only persisted exact GitHub repository paths as installed", async () => {
    const repository = repositoryCandidate();
    const exact = githubSkill({
      name: "code-review",
      source: {
        kind: "github",
        repository: "openai/agent-skills",
        path: "skills/code-review",
        commitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        bundleHash: "c".repeat(64),
        catalog: "github",
        url: "https://github.com/openai/agent-skills"
      }
    });
    const sameNameUnknownSource = skill({ name: "design-audit", description: "A local Skill with the same name." });
    const remote = v2Remote({ repositories: [repository], skills: [exact, sameNameUnknownSource] });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(await screen.findByRole("tab", { name: "Skill 市场" }));
    expect(await screen.findByText("已安装 1")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));

    expect(await screen.findByText("code-review")).toBeTruthy();
    const codeReview = screen.getByText("code-review").closest("li");
    const designAudit = screen.getByText("design-audit").closest("li");
    expect(codeReview?.textContent).toContain("已安装");
    expect(designAudit?.textContent).toContain("结构已验证");
    expect(screen.getByRole("button", { name: "安装所选 (1)" })).toBeTruthy();
  });

  it("requires a second confirmation before installing a high-risk Skill", async () => {
    const repository = repositoryCandidate();
    const inspection = repositoryInspection(repository);
    const remote = v2Remote({ repositories: [repository], inspection });
    remote.inspectRepository = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { inspection, assessments: inspection.skills.map((skill) => ({ skillPath: skill.path, assessment: {
        risk: "high",
        findings: [{ code: "DESTRUCTIVE_EXECUTION", severity: "high", title: "包含高风险执行模式", detail: "需要人工检查。", file: "scripts/install.ps1" }],
        scannerVersion: "1.0.0"
      } })) } });
    remote.installRepository = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { results: inspection.skills.map((skill) => ({ skillPath: skill.path, status: "installed", skill: githubSkill({ name: skill.name }) })) } });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));
    await screen.findAllByText("内容风险：高，需要二次确认");

    await user.click(screen.getByRole("button", { name: "安装所选 (2)" }));
    expect(remote.installRepository).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认安装 (2)" }));
    await waitFor(() => expect(remote.installRepository).toHaveBeenCalled());
    expect(remote.installRepository).toHaveBeenCalledWith(expect.objectContaining({ acknowledgeHighRiskPaths: ["skills/code-review", "skills/design-audit"] }));
  });

  it("keeps repository inspection failures inside the install dialog and retries", async () => {
    const repository = repositoryCandidate();
    const remote = v2Remote({ repositories: [repository] });
    remote.inspectRepository = vi.fn()
      .mockResolvedValueOnce({ schemaVersion: 1, ok: false, error: { code: "MARKETPLACE_RESOLUTION_FETCH_FAILED", message: "Unable to inspect the GitHub repository." } })
      .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { inspection: repositoryInspection(repository), assessments: [] } });
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await user.click(await screen.findByRole("tab", { name: "Skill 市场" }));
    await user.click(await screen.findByRole("button", { name: "查看 openai/agent-skills 安装详情" }));

    const dialog = await screen.findByRole("dialog", { name: "openai/agent-skills" });
    expect(dialog.textContent).toContain("Unable to inspect the GitHub repository.");
    expect(document.querySelector(".dsm-status .dsm-error")).toBeNull();
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("code-review")).toBeTruthy();
    expect(remote.inspectRepository).toHaveBeenCalledTimes(2);
  });

  it.skip("V1: automatically loads the install-ranked market home twenty Skills at a time", async () => {
    const first = Array.from({ length: 20 }, (_, index) => marketSkill({
      id: `owner/repository/skill-${index}`,
      name: `Skill ${index}`,
      install: { kind: "github", repository: "owner/repository", skill: `skill-${index}`, path: null }
    }));
    const second = marketSkill({
      id: "owner/repository/skill-20",
      name: "Skill 20",
      install: { kind: "github", repository: "owner/repository", skill: "skill-20", path: null }
    });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      browseMarketplace: vi.fn()
        .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { result: {
          source: "skills-sh", ranking: "all-time-installs", offset: 0,
          returnedCount: 20, total: 21, hasMore: true, entries: first
        } } })
        .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { result: {
          source: "skills-sh", ranking: "all-time-installs", offset: 20,
          returnedCount: 1, total: 21, hasMore: false, entries: [second]
        } } }),
      installMarketplace: vi.fn(),
      checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));

    expect(await screen.findByText("热门 Skill · 按安装量")).toBeTruthy();
    expect(screen.getByText("Skill 0")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "加载更多 20 个" }));
    expect(await screen.findByText("Skill 20")).toBeTruthy();
    expect(remote.browseMarketplace).toHaveBeenNthCalledWith(2, {
      schemaVersion: 1, offset: 20, limit: 20
    });
  });

  it("keeps local provenance matching hidden and ignores a persisted automatic-match preference", async () => {
    const local = skill({
      name: "story-writer",
      description: "Write a creative novel story.",
      provenanceCheck: { status: "no-match", checkedAt: "2026-08-18T00:00:00.000Z" }
    });
    const verifyProvenance = vi.fn();
    const verifyProvenanceBatch = vi.fn();
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [local] } }),
      create: vi.fn(), setEnabled: vi.fn(), verifyProvenance, verifyProvenanceBatch,
      checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    window.localStorage.setItem("dsh-skill-manager:maintenance:v1", JSON.stringify({
      autoMatch: { enabled: true, lastRunAt: null },
      autoCheck: { enabled: false, lastRunAt: null },
      autoUpdate: { enabled: false, lastRunAt: null }
    }));

    render(<SkillManagerPanel remote={remote} />);

    expect(await screen.findByText("小说")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /自动匹配来源/u })).toBeNull();
    expect(screen.queryByRole("button", { name: "一键全部重匹配" })).toBeNull();
    expect(screen.queryByText("未找到相同的 GitHub Skill")).toBeNull();
    expect(verifyProvenance).not.toHaveBeenCalled();
    expect(verifyProvenanceBatch).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting and removes the archived Skill from the list", async () => {
    const local = skill({ name: "story-writer" });
    const deleteRemote = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: {
      deleted: {
        name: local.name,
        trashId: "11111111-1111-4111-8111-111111111111",
        deletedAt: "2026-08-18T00:00:00.000Z"
      }
    } });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [local] } }),
      create: vi.fn(), setEnabled: vi.fn(), delete: deleteRemote,
      checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(await screen.findByRole("button", { name: "删除 story-writer" }));
    expect(deleteRemote).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认删除 story-writer" }));

    await waitFor(() => expect(deleteRemote).toHaveBeenCalledWith({ schemaVersion: 1, name: "story-writer" }));
    expect(await screen.findByText("已删除 story-writer，完整内容已移入可恢复归档。")).toBeTruthy();
    expect(screen.queryByText("story-writer")).toBeNull();
  });

  it("shows the 30-day recent deletion archive and restores a Skill", async () => {
    const restored = skill({ name: "story-writer", enabledTargets: ["dsh"] });
    const listTrash = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { trashed: [{
      name: "story-writer",
      trashId: "11111111-1111-4111-8111-111111111111",
      description: "Write stories.",
      origin: "self",
      enabledTargets: ["dsh"],
      deletedAt: "2026-08-18T00:00:00.000Z",
      expiresAt: "2026-09-17T00:00:00.000Z"
    }] } });
    const restoreTrash = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skill: restored } });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(), setEnabled: vi.fn(), listTrash, restoreTrash,
      checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(await screen.findByRole("button", { name: /最近删除.*1 项/u }));
    expect(await screen.findByText("完整归档保留 30 天，到期后自动清理")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "恢复" }));
    await waitFor(() => expect(restoreTrash).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "story-writer",
      trashId: "11111111-1111-4111-8111-111111111111"
    }));
    expect(await screen.findByText("已恢复 story-writer，并恢复原先启用的工具链接。")).toBeTruthy();
    expect(screen.getByText("story-writer")).toBeTruthy();
  });

  it("persists automatic update checks and does not repeat them within 24 hours", async () => {
    const managed = githubSkill();
    const checkUpdates = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: {
      checks: [updateCheck({ status: "up-to-date", latest: updateCheck().installed })]
    } });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [managed] } }),
      create: vi.fn(), setEnabled: vi.fn(), checkUpdates,
      update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    const user = userEvent.setup();
    const first = render(<SkillManagerPanel remote={remote} />);
    await user.click(await screen.findByRole("checkbox", { name: /自动检查更新/u }));
    await waitFor(() => expect(checkUpdates).toHaveBeenCalledTimes(1));
    first.unmount();

    render(<SkillManagerPanel remote={remote} />);
    expect((await screen.findByRole("checkbox", { name: /自动检查更新/u }) as HTMLInputElement).checked).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(checkUpdates).toHaveBeenCalledTimes(1);
  });

  it("synchronizes all missing links for configured targets from the main toolbar", async () => {
    const local = skill({ name: "story-writer" });
    const listTargetStates = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { states: [
      { name: local.name, target: "codex" as const, status: "not-linked" as const },
      { name: local.name, target: "claude" as const, status: "not-configured" as const }
    ] } });
    const setTargetEnabled = vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: {
      skill: { ...local, enabledTargets: ["codex" as const] }
    } });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [local] } }),
      create: vi.fn(), setEnabled: vi.fn(), listTargetStates, setTargetEnabled,
      checkUpdates: vi.fn(), update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await user.click(await screen.findByRole("button", { name: "同步到其他工具" }));

    await waitFor(() => expect(setTargetEnabled).toHaveBeenCalledWith({
      schemaVersion: 1, name: "story-writer", target: "codex", enabled: true
    }));
    expect(await screen.findByText("同步完成：新增 1 个链接，跳过 0 个冲突。")).toBeTruthy();
  });

  it("filters discovery by runtime and bulk imports only the selected Skills", async () => {
    const candidates = [
      { name: "story-writer", description: "Write stories.", contentHash: "a".repeat(64), target: "codex" as const },
      { name: "game-writer", description: "Write games.", contentHash: "b".repeat(64), target: "codex" as const },
      { name: "shop-helper", description: "Write listings.", contentHash: "c".repeat(64), target: "opencode" as const }
    ];
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      discoverExternal: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { candidates } }),
      importExternal: vi.fn(async ({ name, target }) => ({
        schemaVersion: 1 as const,
        ok: true as const,
        data: { skill: skill({ name, origin: "self", source: { kind: "local-import", name, target } }) }
      })),
      listTargetStates: vi.fn()
        .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { states: [] } })
        .mockResolvedValue({ schemaVersion: 1, ok: true, data: { states: [] } }),
      setTargetEnabled: vi.fn()
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "同步" }));
    await user.click(screen.getByRole("button", { name: "扫描本机 Skill" }));

    await user.click(await screen.findByRole("button", { name: "Codex" }));
    expect(screen.getByText("story-writer")).toBeTruthy();
    expect(screen.queryByText("shop-helper")).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "选择 Codex 的 game-writer" }));
    await user.click(screen.getByRole("button", { name: "导入所选 (1)" }));

    await waitFor(() => expect(remote.importExternal).toHaveBeenCalledTimes(1));
    expect(remote.importExternal).toHaveBeenCalledWith({
      schemaVersion: 1,
      target: "codex",
      name: "story-writer"
    });
    await user.click(screen.getByRole("tab", { name: "自设" }));
    expect(screen.getByText("自设 · 来自 Codex")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "同步" }));

    await user.click(screen.getByRole("button", { name: "OpenCode" }));
    await user.click(screen.getByRole("button", { name: "一键导入当前来源全部" }));
    await waitFor(() => expect(remote.importExternal).toHaveBeenCalledWith({
      schemaVersion: 1,
      target: "opencode",
      name: "shop-helper"
    }));
  });

  it("explicitly scans, imports, and links Skills from the synchronization view", async () => {
    const states: SkillTargetStateWire[] = [
      { name: "release-notes", target: "agents", status: "not-linked" },
      { name: "release-notes", target: "claude", status: "not-configured" },
      { name: "release-notes", target: "codex", status: "conflict" }
    ];
    const importedStates: SkillTargetStateWire[] = [
      { name: "review-helper", target: "agents", status: "not-linked" },
      { name: "review-helper", target: "claude", status: "not-linked" },
      { name: "review-helper", target: "codex", status: "conflict" }
    ];
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [skill()] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      discoverExternal: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { candidates: [{
          name: "review-helper",
          description: "Review safely.",
          contentHash: "a".repeat(64),
          target: "codex"
        }] }
      }),
      importExternal: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: skill({ name: "review-helper", origin: "local-import" }) }
      }),
      listTargetStates: vi.fn()
        .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { states } })
        .mockResolvedValueOnce({ schemaVersion: 1, ok: true, data: { states: importedStates } }),
      setTargetEnabled: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: skill({ enabledTargets: ["agents"] }) }
      })
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("release-notes");

    await user.click(screen.getByRole("tab", { name: "同步" }));
    expect(remote.discoverExternal).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "扫描本机 Skill" }));
    expect(await screen.findByText("review-helper")).toBeTruthy();
    expect(screen.getByText("Codex 已存在同名目录")).toBeTruthy();
    expect((screen.getByRole("checkbox", {
      name: "同步 release-notes 到 Codex"
    }) as HTMLInputElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "导入 review-helper" }));
    await waitFor(() => expect(remote.importExternal).toHaveBeenCalledWith({
      schemaVersion: 1,
      target: "codex",
      name: "review-helper"
    }));
    await waitFor(() => expect(remote.listTargetStates).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      names: ["review-helper"]
    }));
    expect(screen.getByRole("checkbox", { name: "同步 review-helper 到 Claude Code" })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "同步 release-notes 到 Agents" }));
    await waitFor(() => expect(remote.setTargetEnabled).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "release-notes",
      target: "agents",
      enabled: true
    }));
  });
  it("loads, creates, and enables Skills through the remote service", async () => {
    const created = skill({
      name: "code-review",
      description: "Review changes for correctness and regressions."
    });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [skill()] }
      }),
      create: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: created }
      }),
      setEnabled: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: skill({ enabledTargets: ["dsh"] }) }
      }),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn()
    };
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);

    expect(await screen.findByRole("heading", { name: "Skill 管理" })).toBeTruthy();
    expect(await screen.findByText("release-notes")).toBeTruthy();
    expect(screen.getByText("Prepare release notes from verified changes.").getAttribute("title"))
      .toBe("Prepare release notes from verified changes.");

    await user.click(screen.getByRole("button", { name: "新建 Skill" }));
    await user.type(screen.getByLabelText("Skill 名称"), "code-review");
    await user.type(screen.getByLabelText("简要说明"), "Review changes for correctness and regressions.");
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(remote.create).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "code-review",
      description: "Review changes for correctness and regressions."
    }));
    expect(await screen.findByText("code-review")).toBeTruthy();

    const toggle = screen.getByRole("checkbox", { name: "在 DSH 中启用 release-notes" });
    await user.click(toggle);
    await waitFor(() => expect(remote.setEnabled).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "release-notes",
      enabled: true
    }));
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it("enables every currently disabled managed Skill and reports partial failures", async () => {
    const first = skill({ name: "first-skill" });
    const second = skill({ name: "second-skill" });
    const alreadyEnabled = skill({ name: "already-enabled", enabledTargets: ["dsh"] });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [first, second, alreadyEnabled] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn()
        .mockResolvedValueOnce({
          schemaVersion: 1,
          ok: true,
          data: { skill: { ...first, enabledTargets: ["dsh"] } }
        })
        .mockResolvedValueOnce({
          schemaVersion: 1,
          ok: false,
          error: { code: "ACTIVE_PATH_CONFLICT", message: "DSH target is occupied." }
        })
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("first-skill");

    await user.click(screen.getByRole("button", { name: "一键开启全部 Skill" }));

    await waitFor(() => expect(remote.setEnabled).toHaveBeenCalledTimes(2));
    expect(remote.setEnabled).toHaveBeenNthCalledWith(1, {
      schemaVersion: 1,
      name: "first-skill",
      enabled: true
    });
    expect(remote.setEnabled).toHaveBeenNthCalledWith(2, {
      schemaVersion: 1,
      name: "second-skill",
      enabled: true
    });
    expect(screen.getByText("批量开启完成：成功 1 项，失败 1 项。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "关闭提示" }));
    expect(screen.queryByText("批量开启完成：成功 1 项，失败 1 项。")).toBeNull();
    expect(screen.getByText("部分开启失败：second-skill：DSH target is occupied.")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "在 DSH 中启用 first-skill" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "在 DSH 中启用 already-enabled" }) as HTMLInputElement).checked).toBe(true);
  });

  it("keeps a bulk-completion notice for five seconds and then dismisses it", async () => {
    const local = skill({ name: "timed-notice-skill" });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [local] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: { ...local, enabledTargets: ["dsh"] } }
      })
    };
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("timed-notice-skill");

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "一键开启全部 Skill" }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText("批量开启完成：成功 1 项，失败 0 项。")).toBeTruthy();

      act(() => vi.advanceTimersByTime(4_999));
      expect(screen.getByText("批量开启完成：成功 1 项，失败 0 项。")).toBeTruthy();

      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("批量开启完成：成功 1 项，失败 0 项。")).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.skip("V1: filters self-authored Skills and searches the marketplace on demand", async () => {
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          skills: [
            skill(),
            skill({
              name: "imported-skill",
              description: "Imported from another agent.",
              origin: "local-import"
            })
          ]
        }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      installMarketplace: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "skills-sh",
            query: "react",
            returnedCount: 1,
            entries: [marketSkill()],
            sources: [{ source: "skills-sh", status: "available", returnedCount: 1, error: null }]
          }
        }
      })
    };
    const user = userEvent.setup();

    const { container } = render(<SkillManagerPanel remote={remote} />);
    expect(await screen.findByText("imported-skill")).toBeTruthy();
    expect(container.querySelectorAll('[data-skill-file-icon="true"]')).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: "自设" }));
    expect(screen.getByText("release-notes")).toBeTruthy();
    expect(screen.getByText("imported-skill")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    expect(remote.searchMarketplace).not.toHaveBeenCalled();
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "react");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));

    await waitFor(() => expect(remote.searchMarketplace).toHaveBeenCalledWith({
      schemaVersion: 1,
      query: "react",
      limit: 20
    }));
    expect(await screen.findByText("React guidance")).toBeTruthy();
    expect(container.querySelectorAll('[data-skill-file-icon="true"]')).toHaveLength(1);
    expect(container.querySelector(".dsm-market-cover")).toBeNull();
    expect(screen.getByText("市场索引未提供简介，可从 Skill 文件加载。")).toBeTruthy();
    expect(screen.getByText("代码")).toBeTruthy();
    expect(screen.getByText("vercel-labs")).toBeTruthy();
    expect(screen.getByText("123 次安装")).toBeTruthy();
    expect(screen.getByRole("link", { name: "查看 React guidance 来源" }).getAttribute("href"))
      .toBe("https://github.com/vercel-labs/agent-skills");
  });

  it.skip("V1: loads a missing marketplace description from the verified Skill file", async () => {
    const entry = marketSkill({
      name: "story-crafter",
      install: {
        kind: "github",
        repository: "example/story-skills",
        skill: "story-crafter",
        path: "skills/story-crafter"
      }
    });
    const resolvedEntry = {
      ...entry,
      description: "Design characters and structure long-form fiction.",
      author: { name: "Story Team", url: null },
      repository: {
        ...entry.repository,
        id: 42,
        nodeId: "R_story",
        path: "skills/story-crafter"
      },
      install: {
        ...entry.install,
        path: "skills/story-crafter"
      },
      snapshot: {
        commitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        fetchedAt: "2026-08-17T08:00:00.000Z"
      }
    };
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      installMarketplace: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "skills-sh",
            query: "story",
            returnedCount: 1,
            entries: [entry],
            sources: [{ source: "skills-sh", status: "available", returnedCount: 1, error: null }]
          }
        }
      }),
      resolveMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { entry: resolvedEntry }
      })
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);

    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "story");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));
    await user.click(await screen.findByRole("button", { name: "加载 story-crafter 详情" }));

    await waitFor(() => expect(remote.resolveMarketplace).toHaveBeenCalledWith({
      schemaVersion: 1,
      entry
    }));
    expect(await screen.findByText("Design characters and structure long-form fiction.")).toBeTruthy();
    expect(screen.getByText("作者 Story Team")).toBeTruthy();
    expect(screen.getByText("创作")).toBeTruthy();
    expect(screen.getByText("小说")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "加载 story-crafter 详情" })).toBeNull();
  });

  it.skip("V1: filters merged catalogs locally", async () => {
    const skillsShEntry = marketSkill();
    const huggingFaceEntry = marketSkill({
      id: "huggingface/skills/audio-craft",
      source: "hugging-face",
      catalogs: ["hugging-face"],
      name: "audio-craft",
      description: "Official audio model guidance.",
      publisher: { name: "Hugging Face", url: "https://huggingface.co" },
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
      metrics: { installs: null, stars: null, downloads: null }
    });
    const githubEntry = marketSkill({
      id: "openai/skills/code-review",
      source: "github",
      catalogs: ["github"],
      name: "code-review",
      description: null,
      publisher: { name: "openai", url: "https://github.com/openai" },
      repository: {
        host: "github",
        owner: "openai",
        name: "skills",
        path: "skills/code-review",
        url: "https://github.com/openai/skills"
      },
      skillUrl: "https://github.com/openai/skills/tree/main/skills/code-review",
      install: {
        kind: "github",
        repository: "openai/skills",
        skill: "code-review",
        path: "skills/code-review"
      },
      metrics: {
        installs: null,
        stars: { value: 4200, source: "github", scope: "repository" },
        downloads: null
      }
    });
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      installMarketplace: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "composite",
            query: "skill",
            returnedCount: 3,
            entries: [skillsShEntry, githubEntry, huggingFaceEntry],
            sources: [
              { source: "skills-sh", status: "available", returnedCount: 1, error: null },
              { source: "github", status: "available", returnedCount: 1, error: null },
              { source: "hugging-face", status: "available", returnedCount: 1, error: null }
            ]
          }
        }
      })
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "skill");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));

    expect(await screen.findByText("audio-craft")).toBeTruthy();
    expect(screen.getAllByText("GitHub 托管安装")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "skills.sh" }));
    expect(screen.getByText("React guidance")).toBeTruthy();
    expect(screen.queryByText("audio-craft")).toBeNull();
    expect(screen.queryByText("code-review")).toBeNull();
    await user.click(screen.getByRole("button", { name: "GitHub" }));
    expect(screen.queryByText("React guidance")).toBeNull();
    expect(screen.getByText("code-review")).toBeTruthy();
    expect(screen.queryByText("audio-craft")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hugging Face" }));
    expect(screen.queryByText("React guidance")).toBeNull();
    expect(screen.queryByText("code-review")).toBeNull();
    expect(screen.getByText("audio-craft")).toBeTruthy();
  });

  it.skip("V1: shows a partial-source warning while preserving available results", async () => {
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [] } }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      installMarketplace: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "composite",
            query: "react",
            returnedCount: 1,
            entries: [marketSkill()],
            sources: [
              { source: "skills-sh", status: "available", returnedCount: 1, error: null },
              {
                source: "hugging-face",
                status: "unavailable",
                returnedCount: 0,
                error: { code: "MARKETPLACE_TIMEOUT", message: "Hugging Face timed out." }
              }
            ]
          }
        }
      })
    };
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");

    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "react");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));

    expect(await screen.findByText("React guidance")).toBeTruthy();
    expect(screen.getByText("Hugging Face：连接超时，请稍后重试。已保留其他来源结果。")).toBeTruthy();
  });

  it.skip("V1: installs a marketplace Skill and reflects it in the local library", async () => {
    let completeInstall: ((value: Awaited<ReturnType<SkillManagerRemote["installMarketplace"]>>) => void)
      | undefined;
    const installResult = new Promise<Awaited<ReturnType<SkillManagerRemote["installMarketplace"]>>>(
      (resolve) => { completeInstall = resolve; }
    );
    const installed = skill({
      name: "react-guidance",
      description: "Production React architecture guidance.",
      origin: "github"
    });
    const entry = marketSkill();
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "skills-sh",
            query: "react",
            returnedCount: 1,
            entries: [entry],
            sources: [{ source: "skills-sh", status: "available", returnedCount: 1, error: null }]
          }
        }
      }),
      installMarketplace: vi.fn().mockReturnValue(installResult)
    };
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "react");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));
    await screen.findByText("React guidance");

    await user.click(screen.getByRole("button", { name: "安装 React guidance" }));

    expect(remote.installMarketplace).toHaveBeenCalledWith({ schemaVersion: 1, entry });
    expect((screen.getByRole("button", {
      name: "正在安装 React guidance"
    }) as HTMLButtonElement).disabled).toBe(true);

    completeInstall?.({
      schemaVersion: 1,
      ok: true,
      data: { skill: installed }
    });
    expect((await screen.findByRole("button", {
      name: "React guidance 已安装"
    }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Skill 管理" }));
    expect(await screen.findByText("react-guidance")).toBeTruthy();
    expect((screen.getByRole("checkbox", {
      name: "在 DSH 中启用 react-guidance"
    }) as HTMLInputElement).checked).toBe(false);
  });

  it.skip("V1: restores the marketplace install action after a Host failure", async () => {
    const entry = marketSkill();
    const remote: SkillManagerRemote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          result: {
            source: "skills-sh",
            query: "react",
            returnedCount: 1,
            entries: [entry],
            sources: [{ source: "skills-sh", status: "available", returnedCount: 1, error: null }]
          }
        }
      }),
      installMarketplace: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: false,
        error: {
          code: "GITHUB_RATE_LIMITED",
          message: "GitHub API rate limit was exceeded."
        }
      })
    };
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("没有匹配的 Skill");
    await user.click(screen.getByRole("tab", { name: "Skill 市场" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索市场 Skill" }), "react");
    await user.click(screen.getByRole("button", { name: "搜索市场" }));
    await screen.findByText("React guidance");
    await user.click(screen.getByRole("button", { name: "安装 React guidance" }));

    expect(await screen.findByText("GitHub API rate limit was exceeded.")).toBeTruthy();
    expect((screen.getByRole("button", {
      name: "安装 React guidance"
    }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("React guidance")).toBeTruthy();
  });

  it("checks the library explicitly and updates only an available unchanged Skill", async () => {
    const available = githubSkill();
    const locallyModified = githubSkill({
      name: "local-guidance",
      description: "Locally edited guidance."
    });
    const unsupported = skill();
    const updated = githubSkill({
      enabledTargets: ["dsh"],
      source: {
        ...available.source as Extract<ManagedSkillWire["source"], { kind: "github" }>,
        commitSha: "d".repeat(40),
        blobSha: "e".repeat(40),
        bundleHash: "f".repeat(64)
      }
    });
    const remote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [available, locallyModified, unsupported] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      checkUpdates: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: {
          checks: [
            updateCheck(),
            updateCheck({ name: "local-guidance", status: "local-modified", latest: null }),
            updateCheck({
              name: "release-notes",
              status: "unsupported",
              installed: null,
              latest: null
            })
          ]
        }
      }),
      update: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: updated, backup: backup() }
      }),
      listBackups: vi.fn(),
      rollback: vi.fn()
    } satisfies SkillManagerRemote;
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("react-guidance");
    expect(remote.checkUpdates).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /自动检查更新/u }));

    await waitFor(() => expect(remote.checkUpdates).toHaveBeenCalledWith({ schemaVersion: 1 }));
    expect(await screen.findByText("可更新")).toBeTruthy();
    expect(screen.getByText("本地已修改")).toBeTruthy();
    expect(screen.getByText("不支持远程更新")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "更新 local-guidance" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "更新 react-guidance" }));

    await waitFor(() => expect(remote.update).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "react-guidance"
    }));
    expect(await screen.findByText("已是最新")).toBeTruthy();
    expect((screen.getByRole("checkbox", {
      name: "在 DSH 中启用 react-guidance"
    }) as HTMLInputElement).checked).toBe(true);
  });

  it("checks one GitHub Skill update inline and hides backup controls", async () => {
    const managed = githubSkill({ enabledTargets: ["dsh"] });
    const remote = {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, ok: true, data: { skills: [managed] } }),
      create: vi.fn(), setEnabled: vi.fn(),
      checkUpdates: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { checks: [updateCheck()] }
      }),
      update: vi.fn(), listBackups: vi.fn(), rollback: vi.fn()
    } satisfies SkillManagerRemote;
    const user = userEvent.setup();
    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("react-guidance");

    expect(screen.getByRole("button", { name: "检查 react-guidance 更新" })).toBeTruthy();
    expect(screen.queryByText("备份")).toBeNull();
    expect(screen.queryByLabelText("react-guidance 备份历史")).toBeNull();
    await user.click(screen.getByRole("button", { name: "检查 react-guidance 更新" }));

    await waitFor(() => expect(remote.checkUpdates).toHaveBeenCalledWith({
      schemaVersion: 1,
      names: ["react-guidance"]
    }));
    expect(await screen.findByRole("button", { name: "更新 react-guidance" })).toBeTruthy();
  });

  it.skip("backup recovery UI is deferred while backup APIs remain available", async () => {
    const current = githubSkill({ enabledTargets: ["dsh"] });
    const prior = backup();
    const displaced = backup({
      id: "22222222-2222-4222-8222-222222222222",
      reason: "rollback",
      snapshot: {
        commitSha: "d".repeat(40),
        blobSha: "e".repeat(40),
        bundleHash: "f".repeat(64)
      }
    });
    const restored = githubSkill({
      enabledTargets: ["dsh"],
      updatedAt: "2026-08-17T05:02:00.000Z"
    });
    const remote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [current] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      checkUpdates: vi.fn(),
      update: vi.fn(),
      listBackups: vi.fn()
        .mockResolvedValueOnce({
          schemaVersion: 1,
          ok: true,
          data: { backups: [prior] }
        })
        .mockResolvedValueOnce({
          schemaVersion: 1,
          ok: true,
          data: { backups: [displaced, prior] }
        }),
      rollback: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skill: restored, backup: displaced }
      })
    } satisfies SkillManagerRemote;
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("react-guidance");
    await user.click(screen.getByRole("button", { name: "查看 react-guidance 备份" }));

    await waitFor(() => expect(remote.listBackups).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "react-guidance"
    }));
    expect(await screen.findByText("版本 aaaaaaa")).toBeTruthy();

    await user.click(screen.getByRole("button", {
      name: "回滚 react-guidance 到版本 aaaaaaa"
    }));
    expect(remote.rollback).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {
      name: "确认回滚 react-guidance 到版本 aaaaaaa"
    }));

    await waitFor(() => expect(remote.rollback).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: "react-guidance",
      backupId: prior.id
    }));
    await waitFor(() => expect(remote.listBackups).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("版本 ddddddd")).toBeTruthy();
    expect((screen.getByRole("checkbox", {
      name: "在 DSH 中启用 react-guidance"
    }) as HTMLInputElement).checked).toBe(true);
  });

  it("restores the update action after a transient Host failure", async () => {
    const remote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [githubSkill()] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      checkUpdates: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { checks: [updateCheck()] }
      }),
      update: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: false,
        error: {
          code: "GITHUB_RATE_LIMITED",
          message: "GitHub API rate limit was exceeded."
        }
      }),
      listBackups: vi.fn(),
      rollback: vi.fn()
    } satisfies SkillManagerRemote;
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("react-guidance");
    await user.click(screen.getByRole("checkbox", { name: /自动检查更新/u }));
    await user.click(await screen.findByRole("button", { name: "更新 react-guidance" }));

    expect(await screen.findByText("GitHub API rate limit was exceeded.")).toBeTruthy();
    expect((screen.getByRole("button", {
      name: "更新 react-guidance"
    }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("turns a stale available result into a local conflict after Host revalidation", async () => {
    const remote = {
      list: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { skills: [githubSkill()] }
      }),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn(),
      checkUpdates: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        data: { checks: [updateCheck()] }
      }),
      update: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        ok: false,
        error: {
          code: "SKILL_LOCAL_MODIFIED",
          message: "Skill changed after the update check."
        }
      }),
      listBackups: vi.fn(),
      rollback: vi.fn()
    } satisfies SkillManagerRemote;
    const user = userEvent.setup();

    render(<SkillManagerPanel remote={remote} />);
    await screen.findByText("react-guidance");
    await user.click(screen.getByRole("checkbox", { name: /自动检查更新/u }));
    await user.click(await screen.findByRole("button", { name: "更新 react-guidance" }));

    expect(await screen.findByText("Skill changed after the update check.")).toBeTruthy();
    expect(screen.getByText("本地已修改")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "更新 react-guidance" })).toBeNull();
  });

  it("mounts the remote descriptors and registers an independent settings section", async () => {
    const disposeRemote = vi.fn();
    const mount = vi.fn().mockResolvedValue(disposeRemote);
    const register = vi.fn();
    const remote = {
      list: vi.fn(),
      create: vi.fn(),
      setEnabled: vi.fn(),
      searchMarketplace: vi.fn(),
      installMarketplace: vi.fn()
    };
    const context = {
      remote: { $mount: mount },
      get: vi.fn().mockReturnValue(remote),
      slots: {
        inject: vi.fn((_name: string, registration: () => unknown) => registration()),
        register
      }
    };

    const sidebar = document.createElement("button");
    sidebar.innerHTML = '<svg data-original-settings-icon="true"></svg><span>Skill 管理插件</span>';
    document.body.appendChild(sidebar);
    const dispose = await apply(context);
    expect(document.querySelectorAll('style[data-plugin-css="dsh-skill-manager/client"]')).toHaveLength(1);

    expect(mount).toHaveBeenCalledWith({
      package: "dsh-skill-manager",
      descriptors: skillManagerClientDescriptors
    });
    expect(context.get).toHaveBeenCalledWith("remote.skillManager");
    expect(skillManagerClientDescriptors.map((descriptor) => descriptor.method)).toEqual([
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
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      name: "settings.section",
      id: "skill-manager",
      order: 30,
      label: expect.any(Function)
    }), SkillManagerPanel);
    const registration = register.mock.calls[0]?.[0] as { label: () => string };
    expect(registration.label()).toBe("Skill 管理插件");
    expect(sidebar.querySelector("[data-dsh-skill-manager-sidebar-icon]")).toBeNull();
    expect(sidebar.querySelector("[data-original-settings-icon]")).toBeTruthy();

    await dispose();
    expect(document.querySelectorAll('style[data-plugin-css="dsh-skill-manager/client"]')).toHaveLength(0);
    expect(sidebar.querySelector("[data-original-settings-icon]")).toBeTruthy();
    expect(disposeRemote).toHaveBeenCalledOnce();
  });
});
