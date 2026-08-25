import { createRoot } from "react-dom/client";

import {
  ensureSkillManagerStyles,
  SkillManagerPanel,
  type SkillManagerRemote
} from "../src/client.js";
import type {
  ManagedSkillWire,
  MarketplaceEntryWire,
  MediaSourceWire,
  RepositoryCandidateWire,
  RepositoryInspectionWire,
  SkillBackupWire,
  SkillTargetStateWire,
  SkillUpdateCheckWire
} from "../src/rpc.js";

const createdAt = "2026-08-16T00:00:00.000Z";
const updatedAt = "2026-08-17T04:00:00.000Z";

let skills: ManagedSkillWire[] = [
  {
    name: "release-notes",
    description: "根据已验证的变更生成结构清晰、可审计的发布说明。",
    origin: "self",
    enabledTargets: ["dsh"],
    createdAt,
    updatedAt,
    contentHash: "1".repeat(64)
  },
  {
    name: "react-guidance",
    description: "面向生产环境的 React 架构、性能与可维护性指导。",
    origin: "github",
    enabledTargets: ["dsh", "codex"],
    createdAt,
    updatedAt,
    contentHash: "2".repeat(64),
    source: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      path: "skills/react-guidance",
      commitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      bundleHash: "c".repeat(64),
      catalog: "skills-sh",
      url: "https://github.com/vercel-labs/agent-skills"
    }
  },
  {
    name: "safe-review",
    description: "从本机 Agent 导入的代码审查流程，不读取相邻的 AGENTS.md 或 CLAUDE.md。",
    origin: "local-import",
    enabledTargets: [],
    createdAt,
    updatedAt,
    contentHash: "3".repeat(64),
    source: { kind: "local-import", name: "safe-review", target: "agents" }
  }
];

const marketEntries: MarketplaceEntryWire[] = [
  {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh",
    catalogs: ["skills-sh"],
    name: "React guidance",
    description: "Production React architecture guidance.",
    publisher: { name: "vercel-labs", url: "https://github.com/vercel-labs" },
    author: null,
    repository: {
      host: "github",
      owner: "vercel-labs",
      name: "agent-skills",
      path: "skills/react-guidance",
      url: "https://github.com/vercel-labs/agent-skills"
    },
    skillUrl: "https://skills.sh/vercel-labs/agent-skills/react-guidance",
    install: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      skill: "react-guidance",
      path: "skills/react-guidance"
    },
    metrics: {
      installs: { value: 18620, source: "skills.sh" },
      stars: { value: 4210, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: "vercel-labs/agent-skills/react-guidance" }
  },
  {
    id: "huggingface/skills/hf-cli",
    source: "hugging-face",
    catalogs: ["hugging-face"],
    name: "hf-cli",
    description: "Use the Hugging Face Hub CLI for safe, explicit repository operations.",
    publisher: { name: "Hugging Face", url: "https://huggingface.co" },
    author: { name: "Hugging Face", url: "https://huggingface.co" },
    repository: {
      host: "github",
      owner: "huggingface",
      name: "skills",
      path: "skills/hf-cli",
      url: "https://github.com/huggingface/skills"
    },
    skillUrl: "https://github.com/huggingface/skills/tree/main/skills/hf-cli",
    install: {
      kind: "github",
      repository: "huggingface/skills",
      skill: "hf-cli",
      path: "skills/hf-cli"
    },
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: "huggingface/skills/hf-cli" }
  },
  {
    id: "anthropics/skills/code-review",
    source: "github",
    catalogs: ["github"],
    name: "code-review",
    description: null,
    publisher: { name: "anthropics", url: "https://github.com/anthropics" },
    author: null,
    repository: {
      host: "github",
      owner: "anthropics",
      name: "skills",
      path: "skills/code-review",
      url: "https://github.com/anthropics/skills"
    },
    skillUrl: "https://github.com/anthropics/skills/tree/main/skills/code-review",
    install: {
      kind: "github",
      repository: "anthropics/skills",
      skill: "code-review",
      path: "skills/code-review"
    },
    metrics: {
      installs: null,
      stars: { value: 2460, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: "anthropics/skills/code-review" }
  },
  {
    id: "openai/skills/docs",
    source: "skills-sh",
    catalogs: ["skills-sh", "hugging-face"],
    name: "document-workflow",
    description: "Create and review structured documents with a bounded workflow.",
    publisher: { name: "openai", url: "https://github.com/openai" },
    author: null,
    repository: {
      host: "github",
      owner: "openai",
      name: "skills",
      path: "skills/docs",
      url: "https://github.com/openai/skills"
    },
    skillUrl: "https://skills.sh/openai/skills/docs",
    install: {
      kind: "github",
      repository: "openai/skills",
      skill: "docs",
      path: "skills/docs"
    },
    metrics: {
      installs: { value: 9730, source: "skills.sh" },
      stars: { value: 3180, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: "openai/skills/docs" }
  }
];

const repository: RepositoryCandidateWire = {
  repositoryId: 42,
  nodeId: "R_preview",
  repoKey: "github:openai/agent-skills",
  host: "github",
  owner: "openai",
  ownerId: 1,
  ownerType: "Organization",
  ownerAvatar: { type: "github-avatar", owner: "openai", accountId: 1 },
  name: "agent-skills",
  fullName: "openai/agent-skills",
  description: "A curated collection of portable Agent Skills for coding, research, design, and document workflows.",
  url: "https://github.com/openai/agent-skills",
  defaultBranch: "main",
  stars: 18420,
  forks: 1260,
  createdAt,
  updatedAt,
  pushedAt: updatedAt,
  topics: ["agent-skills", "coding", "design"],
  formatTopics: ["agent-skills"],
  categoryTopics: ["coding", "design"],
  archived: false,
  license: "MIT",
  knownSkillCount: null,
  classification: {
    primaryCategory: "agent",
    tags: ["Agent", "代码", "研究"],
    evidence: [{ source: "github-topic", value: "agent-skills" }],
    confidence: "topic"
  },
  trend: {
    weeklyStars: 320,
    monthlyStars: 1280,
    observedAt: updatedAt,
    source: "github-trending-html",
    stale: false
  },
  cover: { type: "generated", seed: "github:openai/agent-skills" },
  discovery: {
    signals: [{ source: "github", kind: "format-topic", label: "Topic: agent-skills" }],
    discoveredAt: updatedAt
  }
};

const inspectionCommit = "a".repeat(40);
const inspection: RepositoryInspectionWire = {
  repository: { ...repository, knownSkillCount: 3 },
  inspectionCommit,
  inspectedAt: updatedAt,
  status: "structure-verified",
  readme: {
    path: "README.md",
    title: "Agent Skills",
    content: "# Agent Skills\n\nPortable workflows for agents. Repository README is shown separately from Skill descriptions.",
    blobSha: "b".repeat(40)
  },
  manifestPaths: ["skills.json"],
  declaredSkillPaths: ["skills/code-review", "skills/design-audit", "skills/research-brief"],
  skills: [
    {
      skillKey: "github:openai/agent-skills#skills/code-review",
      repositoryId: 42,
      path: "skills/code-review",
      name: "code-review",
      description: "Review code changes with explicit evidence and risk-ranked findings.",
      classification: { primaryCategory: "development", tags: ["代码", "审查"], evidence: [{ source: "name", value: "code-review" }], confidence: "keyword" },
      author: { name: "OpenAI", url: "https://github.com/openai" },
      structureStatus: "structure-verified",
      validatedAtCommit: inspectionCommit,
      skillDocumentBlobSha: "c".repeat(40),
      manifestFiles: [],
      installable: true,
      warnings: []
    },
    {
      skillKey: "github:openai/agent-skills#skills/design-audit",
      repositoryId: 42,
      path: "skills/design-audit",
      name: "design-audit",
      description: "Audit desktop product interfaces for usability and visual consistency.",
      classification: { primaryCategory: "design", tags: ["设计", "审计"], evidence: [{ source: "name", value: "design-audit" }], confidence: "keyword" },
      author: { name: "OpenAI", url: "https://github.com/openai" },
      structureStatus: "structure-verified",
      validatedAtCommit: inspectionCommit,
      skillDocumentBlobSha: "d".repeat(40),
      manifestFiles: [],
      installable: true,
      warnings: []
    },
    {
      skillKey: "github:openai/agent-skills#skills/research-brief",
      repositoryId: 42,
      path: "skills/research-brief",
      name: "research-brief",
      description: "Produce concise source-grounded research briefs.",
      classification: { primaryCategory: "research", tags: ["研究", "写作"], evidence: [{ source: "name", value: "research-brief" }], confidence: "keyword" },
      author: { name: "OpenAI", url: "https://github.com/openai" },
      structureStatus: "structure-verified",
      validatedAtCommit: inspectionCommit,
      skillDocumentBlobSha: "e".repeat(40),
      manifestFiles: [],
      installable: true,
      warnings: []
    }
  ],
  media: [
    { type: "repo-blob", repo: repository.repoKey, commit: inspectionCommit, path: "docs/overview.png" },
    { type: "repo-blob", repo: repository.repoKey, commit: inspectionCommit, path: "docs/workflow.png" },
    { type: "repo-blob", repo: repository.repoKey, commit: inspectionCommit, path: "docs/skill-picker.png" },
    { type: "repo-blob", repo: repository.repoKey, commit: inspectionCommit, path: "docs/results.png" },
    { type: "github-social-preview", repo: repository.repoKey }
  ],
  warnings: []
};

let targetStates: SkillTargetStateWire[] = skills.flatMap((skill) => [
  { name: skill.name, target: "codex", status: skill.name === "react-guidance" ? "linked" : "not-linked" },
  { name: skill.name, target: "claude", status: skill.name === "safe-review" ? "conflict" : "not-linked" },
  { name: skill.name, target: "agents", status: skill.name === "release-notes" ? "not-configured" : "not-linked" }
]);

let trashedSkills = [{
  name: "design-helper",
  trashId: "22222222-2222-4222-8222-222222222222",
  description: "已删除的界面设计辅助 Skill。",
  origin: "self" as const,
  enabledTargets: ["dsh" as const],
  deletedAt: "2026-08-17T00:00:00.000Z",
  expiresAt: "2026-09-16T00:00:00.000Z"
}];

const updateChecks: SkillUpdateCheckWire[] = [
  {
    name: "release-notes",
    status: "unsupported",
    installed: null,
    latest: null,
    checkedAt: updatedAt
  },
  {
    name: "react-guidance",
    status: "update-available",
    installed: { commitSha: "a".repeat(40), blobSha: "b".repeat(40), bundleHash: "c".repeat(64) },
    latest: { commitSha: "d".repeat(40), blobSha: "e".repeat(40), bundleHash: "f".repeat(64) },
    checkedAt: updatedAt
  },
  {
    name: "safe-review",
    status: "unsupported",
    installed: null,
    latest: null,
    checkedAt: updatedAt
  }
];

const backups: SkillBackupWire[] = [{
  id: "11111111-1111-4111-8111-111111111111",
  name: "react-guidance",
  createdAt: updatedAt,
  reason: "update",
  contentHash: "9".repeat(64),
  snapshot: { commitSha: "a".repeat(40), blobSha: "b".repeat(40), bundleHash: "c".repeat(64) }
}];

function success<T>(data: T) {
  return Promise.resolve({ schemaVersion: 1 as const, ok: true as const, data });
}

function upsertSkill(skill: ManagedSkillWire): ManagedSkillWire {
  skills = [...skills.filter((candidate) => candidate.name !== skill.name), skill]
    .sort((left, right) => left.name.localeCompare(right.name));
  return skill;
}

const remote: SkillManagerRemote = {
  list: async () => success({ skills }),
  create: async (request) => success({ skill: upsertSkill({
    name: request.name,
    description: request.description,
    origin: "self",
    enabledTargets: [],
    createdAt,
    updatedAt,
    contentHash: "4".repeat(64)
  }) }),
  setEnabled: async (request) => {
    const current = skills.find((skill) => skill.name === request.name);
    if (!current) throw new Error(`Unknown preview Skill: ${request.name}`);
    const enabledTargets = request.enabled
      ? [...new Set([...current.enabledTargets, "dsh" as const])]
      : current.enabledTargets.filter((target) => target !== "dsh");
    return success({ skill: upsertSkill({ ...current, enabledTargets }) });
  },
  getCapabilities: async () => success({ capabilities: {
    protocolVersion: 5,
    buildId: "preview-v5-gallery",
    features: {
      marketplaceV2: true,
      repositoryInspection: true,
      mediaProxy: true,
      indexCatalog: false,
      riskAssessment: true,
      githubTrending: true,
      skillClassification: true,
      provenanceV2: true,
      updateRiskGate: true,
      repositoryBatchAnalysis: true,
      repositoryBatchInstall: true,
      batchProvenance: true,
      skillsShDiscoveryHints: true
    }
  } }),
  browseRepositories: async (request) => success({ result: {
    source: "github",
    query: null,
    sort: request.sort,
    page: request.page,
    returnedCount: 1,
    total: 1,
    hasMore: false,
    incomplete: false,
    dataUpdatedAt: updatedAt,
    repositories: [repository]
  } }),
  searchRepositories: async (request) => success({ result: {
    source: "github",
    query: request.query,
    sort: request.sort,
    page: request.page,
    returnedCount: 1,
    total: 1,
    hasMore: false,
    incomplete: false,
    dataUpdatedAt: updatedAt,
    repositories: [repository]
  } }),
  inspectRepository: async () => success({
    inspection,
    assessments: inspection.skills.map((skill) => ({
      skillPath: skill.path,
      assessment: {
        risk: skill.path.endsWith("design-audit") ? "medium" as const : "low" as const,
        findings: [],
        scannerVersion: "preview-1"
      }
    }))
  }),
  installSkill: async (request) => {
    const descriptor = inspection.skills.find((skill) => skill.path === request.skillPath);
    if (!descriptor) throw new Error(`Unknown preview Skill path: ${request.skillPath}`);
    return success({ skill: upsertSkill({
      name: descriptor.name,
      description: descriptor.description,
      origin: "github",
      enabledTargets: [],
      createdAt,
      updatedAt,
      contentHash: descriptor.skillDocumentBlobSha,
      source: {
        kind: "github",
        repository: repository.fullName,
        path: descriptor.path,
        commitSha: inspectionCommit,
        blobSha: descriptor.skillDocumentBlobSha,
        bundleHash: descriptor.skillDocumentBlobSha.padEnd(64, "0"),
        catalog: "github",
        url: repository.url
      }
    }) });
  },
  assessSkillRisk: async (request) => success({ assessment: {
    risk: request.skillPath.endsWith("design-audit") ? "medium" : "low",
    findings: request.skillPath.endsWith("design-audit") ? [{
      code: "NETWORK_REFERENCE",
      severity: "medium",
      title: "提及网络访问",
      detail: "安装前检查访问目的。",
      file: "SKILL.md"
    }] : [],
    scannerVersion: "preview-1"
  } }),
  resolveMedia: async ({ source }) => success({ asset: {
    source,
    mimeType: "image/png",
    width: 960,
    height: 540,
    dataUrl: previewMediaDataUrl(source)
  } }),
  searchMarketplace: async (request) => success({ result: {
    source: "composite",
    query: request.query,
    returnedCount: marketEntries.length,
    entries: marketEntries,
    sources: [
      { source: "skills-sh", status: "available", returnedCount: 2, error: null },
      { source: "github", status: "available", returnedCount: 1, error: null },
      {
        source: "hugging-face",
        status: "unavailable",
        returnedCount: 1,
        error: { code: "MARKETPLACE_TIMEOUT", message: "Hugging Face preview timeout." }
      }
    ]
  } }),
  installMarketplace: async (request) => success({ skill: upsertSkill({
    name: request.entry.install.skill,
    description: request.entry.description ?? "暂无简介",
    origin: "github",
    enabledTargets: [],
    createdAt,
    updatedAt,
    contentHash: "5".repeat(64)
  }) }),
  checkUpdates: async () => success({ checks: updateChecks }),
  update: async (request) => {
    const current = skills.find((skill) => skill.name === request.name);
    if (!current) throw new Error(`Unknown preview Skill: ${request.name}`);
    return success({ skill: upsertSkill({ ...current, updatedAt }), backup: backups[0]! });
  },
  listBackups: async (request) => success({ backups: backups.filter((backup) => request.name === undefined || backup.name === request.name) }),
  rollback: async (request) => {
    const current = skills.find((skill) => skill.name === request.name);
    if (!current) throw new Error(`Unknown preview Skill: ${request.name}`);
    return success({ skill: upsertSkill({ ...current, updatedAt }), backup: backups[0]! });
  },
  listTrash: async () => success({ trashed: trashedSkills }),
  restoreTrash: async (request) => {
    const archived = trashedSkills.find((skill) => skill.trashId === request.trashId);
    if (!archived) throw new Error(`Unknown preview archive: ${request.trashId}`);
    trashedSkills = trashedSkills.filter((skill) => skill.trashId !== request.trashId);
    return success({ skill: upsertSkill({
      name: archived.name,
      description: archived.description,
      origin: archived.origin,
      enabledTargets: archived.enabledTargets,
      createdAt,
      updatedAt,
      contentHash: "2".repeat(64)
    }) });
  },
  discoverExternal: async () => success({ candidates: [
    {
      name: "research-helper",
      description: "从 Codex Skill 库发现，仅返回元数据而不读取正文。",
      contentHash: "6".repeat(64),
      target: "codex"
    },
    {
      name: "writing-guide",
      description: "从 Claude Code Skill 库发现的写作工作流。",
      contentHash: "7".repeat(64),
      target: "claude"
    }
  ] }),
  importExternal: async (request) => success({ skill: upsertSkill({
    name: request.name,
    description: `从 ${request.target} 显式导入的 Skill。`,
    origin: "local-import",
    enabledTargets: [],
    createdAt,
    updatedAt,
    contentHash: "8".repeat(64),
    source: { kind: "local-import", name: request.name, target: request.target }
  }) }),
  listTargetStates: async () => success({ states: targetStates }),
  setTargetEnabled: async (request) => {
    const current = skills.find((skill) => skill.name === request.name);
    if (!current) throw new Error(`Unknown preview Skill: ${request.name}`);
    const enabledTargets = request.enabled
      ? [...new Set([...current.enabledTargets, request.target])]
      : current.enabledTargets.filter((target) => target !== request.target);
    targetStates = targetStates.map((state) => state.name === request.name && state.target === request.target
      ? { ...state, status: request.enabled ? "linked" : "not-linked" }
      : state);
    return success({ skill: upsertSkill({ ...current, enabledTargets }) });
  }
};

function previewMediaDataUrl(source: MediaSourceWire): string {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  if (!context) return "data:image/png;base64,";
  const label = source.type === "repo-blob"
    ? source.path
    : source.type === "github-avatar"
      ? source.owner
      : source.type === "github-social-preview"
        ? "GitHub Social Preview"
        : "Repository Preview";
  const accent = source.type === "repo-blob" && source.path.includes("workflow")
    ? "#d9a441"
    : source.type === "repo-blob" && source.path.includes("results")
      ? "#d86969"
      : "#50b78a";
  context.fillStyle = "#202329";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#2c3138";
  context.fillRect(54, 54, 852, 432);
  context.fillStyle = accent;
  context.fillRect(54, 54, 12, 432);
  context.fillStyle = "#f3f5f7";
  context.font = "600 38px system-ui";
  context.fillText(label, 104, 160, 730);
  context.fillStyle = "#b8bec7";
  context.font = "24px system-ui";
  context.fillText("README repository media", 104, 214);
  context.fillStyle = "#3a414a";
  context.fillRect(104, 278, 620, 22);
  context.fillRect(104, 324, 710, 22);
  context.fillRect(104, 370, 510, 22);
  return canvas.toDataURL("image/png");
}

const themeLabels = {
  original: "原版",
  light: "亮色",
  dark: "暗色",
  system: "跟随系统"
} as const;

type PreviewTheme = keyof typeof themeLabels;

function applyTheme(theme: PreviewTheme): void {
  document.body.dataset.previewTheme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : theme === "light" || theme === "original" ? "light" : "light dark";
  document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });
  const status = document.querySelector("#preview-theme-status");
  if (status) status.textContent = `当前：${themeLabels[theme]}`;
}

document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.theme as PreviewTheme));
});

const queryTheme = new URLSearchParams(window.location.search).get("theme");
applyTheme(queryTheme && queryTheme in themeLabels ? queryTheme as PreviewTheme : "original");
ensureSkillManagerStyles();

const root = document.querySelector("#root");
if (!root) throw new Error("Preview root is missing");
createRoot(root).render(<SkillManagerPanel remote={remote} />);
