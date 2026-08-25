export type SkillCategoryId =
  | "agent"
  | "automation"
  | "development"
  | "data"
  | "design"
  | "content"
  | "research"
  | "business"
  | "finance"
  | "security"
  | "creative"
  | "life"
  | "general";

export type ClassificationEvidenceSource =
  | "skill-frontmatter"
  | "skills-manifest"
  | "github-topic"
  | "name"
  | "description"
  | "readme";

export interface ClassificationEvidence {
  source: ClassificationEvidenceSource;
  value: string;
}

export interface SkillClassification {
  primaryCategory: SkillCategoryId;
  tags: string[];
  evidence: ClassificationEvidence[];
  confidence: "explicit" | "topic" | "keyword" | "none";
}

export interface SkillClassificationInput {
  name: string;
  description?: string | null;
  readmeSummary?: string | null;
  topics?: string[];
  frontmatter?: { category?: unknown; tags?: unknown } | undefined;
  manifest?: { category?: unknown; tags?: unknown } | undefined;
}

export const SKILL_CATEGORY_LABELS: Readonly<Record<SkillCategoryId, string>> = {
  agent: "智能体与提示",
  automation: "自动化与 Skill 工具",
  development: "软件开发",
  data: "数据与数据库",
  design: "设计与可视化",
  content: "内容与写作",
  research: "研究与知识",
  business: "商业与产品",
  finance: "金融与区块链",
  security: "安全与合规",
  creative: "游戏与娱乐",
  life: "生活与健康",
  general: "通用"
};

const CATEGORY_ORDER: readonly SkillCategoryId[] = [
  "agent", "automation", "development", "data", "design", "content",
  "research", "business", "finance", "security", "creative", "life"
];

const CATEGORY_ALIASES: Readonly<Record<string, SkillCategoryId>> = {
  agent: "agent",
  "agent orchestration": "agent",
  prompting: "agent",
  "token optimization": "agent",
  智能体: "agent",
  提示: "agent",
  "智能体与提示": "agent",
  automation: "automation",
  tools: "automation",
  "skill creation": "automation",
  "skill management": "automation",
  自动化: "automation",
  "自动化与 skill 工具": "automation",
  development: "development",
  "software engineering": "development",
  "developer tooling": "development",
  "code quality": "development",
  testing: "development",
  devops: "development",
  mobile: "development",
  开发: "development",
  "软件开发": "development",
  data: "data",
  databases: "data",
  数据: "data",
  数据库: "data",
  "数据与数据库": "data",
  design: "design",
  diagramming: "design",
  presentations: "design",
  设计: "design",
  可视化: "design",
  "设计与可视化": "design",
  content: "content",
  docs: "content",
  writing: "content",
  media: "content",
  内容: "content",
  写作: "content",
  "内容与写作": "content",
  research: "research",
  science: "research",
  knowledge: "research",
  learning: "research",
  研究: "research",
  知识: "research",
  "研究与知识": "research",
  business: "business",
  product: "business",
  marketing: "business",
  sales: "business",
  商业: "business",
  产品: "business",
  "商业与产品": "business",
  finance: "finance",
  blockchain: "finance",
  金融: "finance",
  区块链: "finance",
  "金融与区块链": "finance",
  security: "security",
  legal: "security",
  安全: "security",
  合规: "security",
  "安全与合规": "security",
  creative: "creative",
  gaming: "creative",
  game: "creative",
  游戏: "creative",
  "游戏与娱乐": "creative",
  life: "life",
  healthcare: "life",
  lifestyle: "life",
  健康: "life",
  生活: "life",
  "生活与健康": "life"
};

const KEYWORD_RULES: ReadonlyArray<{
  category: SkillCategoryId;
  terms: readonly string[];
}> = [
  { category: "agent", terms: ["agent", "prompt", "token", "orchestration", "智能体", "提示词"] },
  { category: "automation", terms: ["automation", "workflow", "tooling", "skill management", "skill creation", "自动化", "工作流"] },
  { category: "development", terms: ["software", "developer", "code", "coding", "typescript", "javascript", "python", "test", "devops", "mobile", "开发", "代码"] },
  { category: "data", terms: ["data", "database", "sql", "数据", "数据库"] },
  { category: "design", terms: ["design", "diagram", "presentation", "figma", "ui", "ux", "设计", "可视化"] },
  { category: "content", terms: ["docs", "documentation", "writing", "media", "story", "content", "写作", "文档", "创作"] },
  { category: "research", terms: ["research", "science", "knowledge", "learning", "academic", "研究", "科研", "知识", "学习"] },
  { category: "business", terms: ["business", "product", "marketing", "sales", "commerce", "商业", "产品", "营销", "电商"] },
  { category: "finance", terms: ["finance", "financial", "blockchain", "crypto", "金融", "区块链"] },
  { category: "security", terms: ["security", "secure", "legal", "compliance", "安全", "合规", "法律"] },
  { category: "creative", terms: ["game", "gaming", "entertainment", "游戏", "娱乐"] },
  { category: "life", terms: ["health", "healthcare", "lifestyle", "生活", "健康"] }
];

const TAG_RULES: ReadonlyArray<{ label: string; terms: readonly string[] }> = [
  { label: "代码", terms: ["code", "coding", "typescript", "javascript", "python", "开发"] },
  { label: "自动化", terms: ["automation", "workflow", "自动化"] },
  { label: "Agent", terms: ["agent", "orchestration", "智能体"] },
  { label: "设计", terms: ["design", "ui", "ux", "figma", "设计"] },
  { label: "写作", terms: ["writing", "story", "novel", "content", "写作", "小说"] },
  { label: "研究", terms: ["research", "science", "academic", "研究", "科研"] },
  { label: "数据", terms: ["data", "database", "sql", "数据", "数据库"] },
  { label: "安全", terms: ["security", "secure", "compliance", "安全", "合规"] },
  { label: "游戏", terms: ["game", "gaming", "游戏"] },
  { label: "电商", terms: ["commerce", "ecommerce", "shop", "电商"] },
  { label: "PDF", terms: ["pdf"] },
  { label: "网页", terms: ["web", "browser", "website", "网页"] }
];

export function classifySkill(input: SkillClassificationInput): SkillClassification {
  const frontmatterCategory = normalizeCategory(input.frontmatter?.category);
  const manifestCategory = normalizeCategory(input.manifest?.category);
  const frontmatterTags = normalizeTags(input.frontmatter?.tags);
  const manifestTags = normalizeTags(input.manifest?.tags);
  const evidence: ClassificationEvidence[] = [];

  if (frontmatterCategory !== undefined) {
    evidence.push({ source: "skill-frontmatter", value: input.frontmatter?.category as string });
  } else if (manifestCategory !== undefined) {
    evidence.push({ source: "skills-manifest", value: input.manifest?.category as string });
  }

  const explicitCategory = frontmatterCategory ?? manifestCategory;
  const explicitTags = [...new Set([...frontmatterTags, ...manifestTags])].slice(0, 3);
  const scores = new Map<SkillCategoryId, number>();
  const scoreEvidence = new Map<SkillCategoryId, ClassificationEvidence[]>();
  const addScore = (category: SkillCategoryId, score: number, source: ClassificationEvidenceSource, value: string) => {
    scores.set(category, (scores.get(category) ?? 0) + score);
    const entries = scoreEvidence.get(category) ?? [];
    if (!entries.some((entry) => entry.source === source && entry.value === value)) entries.push({ source, value });
    scoreEvidence.set(category, entries);
  };

  if (explicitCategory !== undefined) addScore(explicitCategory, 100, frontmatterCategory ? "skill-frontmatter" : "skills-manifest", frontmatterCategory ? String(input.frontmatter?.category) : String(input.manifest?.category));
  for (const tag of explicitTags) {
    const category = normalizeCategory(tag);
    if (category !== undefined) addScore(category, 20, frontmatterTags.includes(tag) ? "skill-frontmatter" : "skills-manifest", tag);
  }

  for (const topic of input.topics ?? []) {
    const category = normalizeCategory(topic);
    if (category !== undefined) addScore(category, 6, "github-topic", topic);
  }

  scoreText(input.name, "name", 4, addScore);
  scoreText(input.description ?? "", "description", 3, addScore);
  scoreText(input.readmeSummary ?? "", "readme", 1, addScore);

  const primaryCategory = explicitCategory ?? chooseCategory(scores);
  const primaryEvidence = primaryCategory === "general"
    ? []
    : scoreEvidence.get(primaryCategory) ?? [];
  const derivedTags = explicitTags.length > 0 ? explicitTags : deriveTags(input);
  const confidence = explicitCategory !== undefined
    ? "explicit"
    : primaryEvidence.some((entry) => entry.source === "github-topic")
      ? "topic"
      : primaryEvidence.length > 0 ? "keyword" : "none";

  return {
    primaryCategory,
    tags: derivedTags.slice(0, 3),
    evidence: primaryEvidence.slice(0, 8),
    confidence
  };
}

function scoreText(
  text: string,
  source: "name" | "description" | "readme",
  weight: number,
  addScore: (category: SkillCategoryId, score: number, source: ClassificationEvidenceSource, value: string) => void
): void {
  const normalized = text.toLocaleLowerCase();
  if (!normalized) return;
  for (const rule of KEYWORD_RULES) {
    const term = rule.terms.find((candidate) => normalized.includes(candidate.toLocaleLowerCase()));
    if (term !== undefined) addScore(rule.category, weight, source, term);
  }
}

function deriveTags(input: SkillClassificationInput): string[] {
  const text = [input.name, input.description ?? "", input.readmeSummary ?? "", ...(input.topics ?? [])]
    .join(" ").toLocaleLowerCase();
  return TAG_RULES
    .filter((rule) => rule.terms.some((term) => text.includes(term.toLocaleLowerCase())))
    .map((rule) => rule.label)
    .slice(0, 3);
}

function chooseCategory(scores: Map<SkillCategoryId, number>): SkillCategoryId {
  let best: SkillCategoryId = "general";
  let bestScore = 0;
  for (const category of CATEGORY_ORDER) {
    const score = scores.get(category) ?? 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

function normalizeCategory(value: unknown): SkillCategoryId | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase().replace(/[_-]+/gu, " ");
  return CATEGORY_ALIASES[normalized];
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/gu, " "))
    .filter((item) => item.length > 0 && item.length <= 32))].slice(0, 3);
}
