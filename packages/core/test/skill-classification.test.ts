import { describe, expect, it } from "vitest";

import { classifySkill } from "../src/index.js";

describe("Skill classification", () => {
  it("maps every Skill Leaderboard subcategory into one of the 12 main categories", () => {
    const mappings: Record<string, string[]> = {
      agent: ["Agent Orchestration", "Prompting", "Token Optimization"],
      automation: ["Automation", "Tools", "Skill Creation", "Skill Management"],
      development: ["Software Engineering", "Developer Tooling", "Code Quality", "Testing", "DevOps", "Mobile"],
      data: ["Data", "Databases"],
      design: ["Design", "Diagramming", "Presentations"],
      content: ["Docs", "Writing", "Media"],
      research: ["Research", "Science", "Knowledge", "Learning"],
      business: ["Business", "Product", "Marketing", "Sales"],
      finance: ["Finance", "Blockchain"],
      security: ["Security", "Legal"],
      creative: ["Gaming"],
      life: ["Healthcare", "Lifestyle"]
    };

    for (const [category, labels] of Object.entries(mappings)) {
      for (const label of labels) {
        expect(classifySkill({ name: "example", frontmatter: { category: label } }).primaryCategory).toBe(category);
      }
    }
    expect(Object.values(mappings).flat()).toHaveLength(36);
  });

  it("prefers SKILL.md metadata over the manifest and supplements tags deterministically", () => {
    const result = classifySkill({
      name: "security-code-review",
      description: "Secure code review automation.",
      topics: ["writing"],
      frontmatter: { category: "Security", tags: ["安全", "审计", "合规", "应过滤"] },
      manifest: { category: "Writing", tags: ["写作"] }
    });

    expect(result).toEqual(expect.objectContaining({
      primaryCategory: "security",
      confidence: "explicit",
      tags: ["安全", "审计", "合规"]
    }));
    expect(result.evidence[0]).toEqual({ source: "skill-frontmatter", value: "Security" });
  });

  it("falls back from topics to name/description keywords and then to general", () => {
    expect(classifySkill({ name: "diagram-helper", topics: ["unknown-topic"] })).toEqual(expect.objectContaining({
      primaryCategory: "design",
      confidence: "keyword"
    }));
    expect(classifySkill({ name: "unrelated", description: "database migration utility" })).toEqual(expect.objectContaining({
      primaryCategory: "data",
      confidence: "keyword"
    }));
    expect(classifySkill({ name: "unrelated" })).toEqual({
      primaryCategory: "general",
      tags: [],
      evidence: [],
      confidence: "none"
    });
  });

  it("keeps derived tags stable, deduplicated, and bounded", () => {
    const result = classifySkill({
      name: "code-design-research",
      description: "A code, design, research, data, security, and game helper.",
      topics: ["coding", "design", "research", "security", "gaming"]
    });
    expect(result.tags).toEqual(["代码", "设计", "研究"]);
    expect(new Set(result.tags).size).toBe(result.tags.length);
    expect(result.tags.length).toBeLessThanOrEqual(3);
  });
});
