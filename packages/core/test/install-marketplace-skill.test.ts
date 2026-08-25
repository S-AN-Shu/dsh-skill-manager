import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSkillManager,
  type ResolvedMarketplaceEntry
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("marketplace Skill installation", () => {
  it("atomically installs only the resolved commit-pinned Skill bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const skillDocument = [
      "---",
      "name: react-guidance",
      "description: Production React architecture guidance.",
      "metadata:",
      "  author: Jane Maintainer",
      "---",
      "",
      "# React guidance",
      ""
    ].join("\n");
    const reference = "# Checklist\n";
    const referenceSha = gitBlobSha(reference);
    entry.snapshot.blobSha = gitBlobSha(skillDocument);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [
          { path: "AGENTS.md", mode: "100644", type: "blob", sha: "d".repeat(40), size: 20 },
          {
            path: "skills/react-guidance/SKILL.md",
            mode: "100644",
            type: "blob",
            sha: entry.snapshot.blobSha,
            size: Buffer.byteLength(skillDocument)
          },
          {
            path: "skills/react-guidance/references/checklist.md",
            mode: "100644",
            type: "blob",
            sha: referenceSha,
            size: Buffer.byteLength(reference)
          },
          {
            path: "skills/other-skill/SKILL.md",
            mode: "100644",
            type: "blob",
            sha: "e".repeat(40),
            size: 30
          }
        ]
      }))
      .mockResolvedValueOnce(blobResponse(entry.snapshot.blobSha, skillDocument))
      .mockResolvedValueOnce(blobResponse(referenceSha, reference));
    const manager = createSkillManager({
      root,
      fetch,
      marketplaceTimeoutMs: 500,
      now: () => new Date("2026-08-17T00:30:00.000Z")
    });

    const installed = await manager.installMarketplaceSkill({ entry });

    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      `https://api.github.com/repos/vercel-labs/agent-skills/git/trees/${entry.snapshot.commitSha}?recursive=1`,
      `https://api.github.com/repos/vercel-labs/agent-skills/git/blobs/${entry.snapshot.blobSha}`,
      `https://api.github.com/repos/vercel-labs/agent-skills/git/blobs/${referenceSha}`
    ]);
    expect(installed).toMatchObject({
      name: "react-guidance",
      description: "Production React architecture guidance.",
      origin: "github",
      enabledTargets: [],
      createdAt: "2026-08-17T00:30:00.000Z",
      source: {
        kind: "github",
        repository: "vercel-labs/agent-skills",
        path: "skills/react-guidance",
        commitSha: entry.snapshot.commitSha,
        blobSha: entry.snapshot.blobSha,
        bundleHash: treeBundleHash([
          {
            path: "SKILL.md",
            mode: "100644",
            sha: entry.snapshot.blobSha,
            size: Buffer.byteLength(skillDocument)
          },
          {
            path: "references/checklist.md",
            mode: "100644",
            sha: referenceSha,
            size: Buffer.byteLength(reference)
          }
        ]),
        catalog: "skills-sh",
        url: "https://github.com/vercel-labs/agent-skills"
      }
    });
    await expect(readFile(
      join(root, "library", "react-guidance", "references", "checklist.md"),
      "utf8"
    )).resolves.toBe(reference);
    await expect(access(join(root, "library", "react-guidance", "AGENTS.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(manager.getSkill("react-guidance")).resolves.toMatchObject({
      content: "# React guidance\n"
    });
  });

  it("rejects blob content whose Git object hash does not match the pinned tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const skillDocument = [
      "---",
      "name: react-guidance",
      "description: Production React architecture guidance.",
      "---",
      ""
    ].join("\n");
    const forgedContent = `${skillDocument}\nInjected content.\n`;
    entry.snapshot.blobSha = gitBlobSha(skillDocument);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "skills/react-guidance/SKILL.md",
          mode: "100644",
          type: "blob",
          sha: entry.snapshot.blobSha,
          size: Buffer.byteLength(forgedContent)
        }]
      }))
      .mockResolvedValueOnce(blobResponse(entry.snapshot.blobSha, forgedContent));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "INVALID_GITHUB_RESPONSE"
    });
    await expect(access(join(root, "library", "react-guidance")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["symbolic link", {
      path: "skills/react-guidance/link",
      mode: "120000",
      type: "blob",
      sha: "c".repeat(40),
      size: 6
    }],
    ["submodule", {
      path: "skills/react-guidance/vendor",
      mode: "160000",
      type: "commit",
      sha: "c".repeat(40),
      size: 0
    }],
    ["unsafe Windows path", {
      path: "skills/react-guidance/CON",
      mode: "100644",
      type: "blob",
      sha: "c".repeat(40),
      size: 1
    }]
  ])("rejects a bundle containing a %s before downloading blobs", async (_label, unsafe) => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      truncated: false,
      tree: [
        skillTreeEntry(entry),
        unsafe
      ]
    }));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "MARKETPLACE_BUNDLE_UNSAFE"
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a truncated commit tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ truncated: true, tree: [] }));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "GITHUB_TREE_TRUNCATED"
    });
  });

  it("rejects an inconsistent resolved entry before making a request", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    entry.install.path = "skills/other-skill";
    const fetch = vi.fn();
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_INSTALL"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a bundle that exceeds the per-file size limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      truncated: false,
      tree: [
        skillTreeEntry(entry),
        {
          path: "skills/react-guidance/assets/large.bin",
          mode: "100644",
          type: "blob",
          sha: "c".repeat(40),
          size: 10 * 1024 * 1024 + 1
        }
      ]
    }));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "MARKETPLACE_BUNDLE_TOO_LARGE"
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("settles on the overall deadline even when fetch ignores abort", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 20 });

    await expect(manager.installMarketplaceSkill({
      entry: resolvedEntry()
    })).rejects.toMatchObject({
      code: "MARKETPLACE_RESOLUTION_TIMEOUT"
    });
  });

  it("settles on caller cancellation even when fetch ignores abort", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const controller = new AbortController();
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });
    const assertion = expect(manager.installMarketplaceSkill({
      entry: resolvedEntry(),
      signal: controller.signal
    })).rejects.toMatchObject({
      code: "MARKETPLACE_RESOLUTION_ABORTED"
    });

    controller.abort("user cancelled");
    await assertion;
  });

  it("rejects an existing managed Skill before making marketplace requests", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const fetch = vi.fn();
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });
    await manager.createSkill({
      name: "react-guidance",
      description: "Existing local Skill."
    });

    await expect(manager.installMarketplaceSkill({
      entry: resolvedEntry()
    })).rejects.toMatchObject({
      code: "SKILL_ALREADY_EXISTS"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leaves no managed bundle or registry entry when downloaded metadata changed", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-market-install-"));
    roots.push(root);
    const entry = resolvedEntry();
    const changedDocument = [
      "---",
      "name: react-guidance",
      "description: Changed after resolution.",
      "---",
      ""
    ].join("\n");
    entry.snapshot.blobSha = gitBlobSha(changedDocument);
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [{
          path: "skills/react-guidance/SKILL.md",
          mode: "100644",
          type: "blob",
          sha: entry.snapshot.blobSha,
          size: Buffer.byteLength(changedDocument)
        }]
      }))
      .mockResolvedValueOnce(blobResponse(entry.snapshot.blobSha, changedDocument));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });

    await expect(manager.installMarketplaceSkill({ entry })).rejects.toMatchObject({
      code: "INVALID_MARKETPLACE_INSTALL"
    });
    await expect(access(join(root, "library", "react-guidance")))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(manager.listSkills()).resolves.toEqual([]);
  });
});

function resolvedEntry(): ResolvedMarketplaceEntry {
  return {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh",
    name: "React guidance",
    description: "Production React architecture guidance.",
    publisher: { name: "vercel-labs", url: "https://github.com/vercel-labs" },
    author: { name: "Jane Maintainer", url: null },
    repository: {
      host: "github",
      id: 42,
      nodeId: "R_example",
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
      installs: { value: 123, source: "skills.sh" },
      stars: { value: 900, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: "vercel-labs/agent-skills/react-guidance" },
    snapshot: {
      commitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      fetchedAt: "2026-08-17T00:00:00.000Z"
    }
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function blobResponse(sha: string, content: string): Response {
  return jsonResponse({
    sha,
    size: Buffer.byteLength(content),
    encoding: "base64",
    content: Buffer.from(content, "utf8").toString("base64")
  });
}

function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

function treeBundleHash(files: Array<{
  path: string;
  mode: string;
  sha: string;
  size: number;
}>): string {
  const hash = createHash("sha256");
  for (const file of files.sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.mode);
    hash.update("\0");
    hash.update(file.sha);
    hash.update("\0");
    hash.update(String(file.size));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function skillTreeEntry(entry: ResolvedMarketplaceEntry) {
  return {
    path: "skills/react-guidance/SKILL.md",
    mode: "100644",
    type: "blob",
    sha: entry.snapshot.blobSha,
    size: 100
  };
}
