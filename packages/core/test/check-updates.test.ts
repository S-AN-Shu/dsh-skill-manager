import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("managed Skill update checks", () => {
  it("reports local and imported Skills as unsupported without network access", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const fetch = vi.fn();
    const manager = createSkillManager({
      root,
      targetRoots: { codex: join(root, "external") },
      fetch,
      now: () => new Date("2026-08-17T02:00:00.000Z")
    });
    await manager.createSkill({ name: "local-notes", description: "Local notes." });
    const importedRoot = join(root, "external", "imported-notes");
    await mkdir(importedRoot, { recursive: true });
    await writeFile(join(importedRoot, "SKILL.md"), [
      "---",
      "name: imported-notes",
      "description: Imported notes.",
      "---",
      ""
    ].join("\n"), "utf8");
    await manager.importSkill({ name: "imported-notes", target: "codex" });

    await expect(manager.checkUpdates()).resolves.toEqual([
      {
        name: "imported-notes",
        status: "unsupported",
        installed: null,
        latest: null,
        latestRisk: null,
        checkedAt: "2026-08-17T02:00:00.000Z"
      },
      {
        name: "local-notes",
        status: "unsupported",
        installed: null,
        latest: null,
        latestRisk: null,
        checkedAt: "2026-08-17T02:00:00.000Z"
      }
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts and deduplicates selected names and rejects unknown Skills", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const manager = createSkillManager({
      root,
      now: () => new Date("2026-08-17T02:00:00.000Z")
    });
    await manager.createSkill({ name: "zebra-notes", description: "Zebra notes." });
    await manager.createSkill({ name: "alpha-notes", description: "Alpha notes." });

    await expect(manager.checkUpdates({
      names: ["zebra-notes", "alpha-notes", "zebra-notes"]
    })).resolves.toEqual([
      expect.objectContaining({ name: "alpha-notes", status: "unsupported" }),
      expect.objectContaining({ name: "zebra-notes", status: "unsupported" })
    ]);
    await expect(manager.checkUpdates({ names: ["missing-skill"] })).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND"
    });
  });

  it("detects local bundle changes before making a remote request", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const fixture = installedBundleFixture();
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: fixture.tree }))
      .mockResolvedValueOnce(blobResponse(fixture.skillSha, fixture.skillDocument))
      .mockResolvedValueOnce(blobResponse(fixture.referenceSha, fixture.reference));
    const manager = createSkillManager({
      root,
      fetch,
      marketplaceTimeoutMs: 500,
      now: () => new Date("2026-08-17T02:00:00.000Z")
    });
    await manager.installMarketplaceSkill({ entry: fixture.entry });
    fetch.mockClear();
    await writeFile(
      join(root, "library", "react-guidance", "references", "checklist.md"),
      "# Locally changed checklist\n",
      "utf8"
    );

    await expect(manager.checkUpdates()).resolves.toEqual([{
      name: "react-guidance",
      status: "local-modified",
      installed: {
        commitSha: fixture.entry.snapshot.commitSha,
        blobSha: fixture.entry.snapshot.blobSha,
        bundleHash: treeBundleHash(fixture.tree)
      },
      latest: null,
      latestRisk: null,
      checkedAt: "2026-08-17T02:00:00.000Z"
    }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["up-to-date", false],
    ["update-available", true]
  ])("reports an unchanged remote bundle as %s", async (status, changeReference) => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const fixture = installedBundleFixture();
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: fixture.tree }))
      .mockResolvedValueOnce(blobResponse(fixture.skillSha, fixture.skillDocument))
      .mockResolvedValueOnce(blobResponse(fixture.referenceSha, fixture.reference));
    const manager = createSkillManager({
      root,
      fetch,
      marketplaceTimeoutMs: 500,
      now: () => new Date("2026-08-17T02:00:00.000Z")
    });
    await manager.installMarketplaceSkill({ entry: fixture.entry });
    fetch.mockClear();
    const latestCommitSha = "f".repeat(40);
    const latestTree = fixture.tree.map((item) => ({ ...item }));
    if (changeReference) {
      latestTree[1] = {
        ...latestTree[1]!,
        sha: "e".repeat(40),
        size: Number(latestTree[1]!.size) + 5
      };
    }
    fetch
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ sha: latestCommitSha }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: latestTree }));

    await expect(manager.checkUpdates({ names: ["react-guidance"] })).resolves.toEqual([{
      name: "react-guidance",
      status,
      installed: {
        commitSha: fixture.entry.snapshot.commitSha,
        blobSha: fixture.entry.snapshot.blobSha,
        bundleHash: treeBundleHash(fixture.tree)
      },
      latest: {
        commitSha: latestCommitSha,
        blobSha: fixture.skillSha,
        bundleHash: treeBundleHash(latestTree)
      },
      latestRisk: null,
      checkedAt: "2026-08-17T02:00:00.000Z"
    }]);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.github.com/repos/vercel-labs/agent-skills",
      "https://api.github.com/repos/vercel-labs/agent-skills/commits/main",
      `https://api.github.com/repos/vercel-labs/agent-skills/git/trees/${latestCommitSha}?recursive=1`
    ]);
  });

  it("rejects an unsafe latest tree without mutating the installed Skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const fixture = installedBundleFixture();
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: fixture.tree }))
      .mockResolvedValueOnce(blobResponse(fixture.skillSha, fixture.skillDocument))
      .mockResolvedValueOnce(blobResponse(fixture.referenceSha, fixture.reference));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500 });
    const installed = await manager.installMarketplaceSkill({ entry: fixture.entry });
    fetch.mockClear();
    fetch
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ sha: "f".repeat(40) }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: [
          ...fixture.tree,
          {
            path: "skills/react-guidance/link",
            mode: "120000",
            type: "blob",
            sha: "e".repeat(40),
            size: 6
          }
        ]
      }));

    await expect(manager.checkUpdates()).rejects.toMatchObject({
      code: "MARKETPLACE_BUNDLE_UNSAFE"
    });
    await expect(manager.listSkills()).resolves.toEqual([installed]);
    await expect(readFile(
      join(root, "library", "react-guidance", "references", "checklist.md"),
      "utf8"
    )).resolves.toBe(fixture.reference);
  });

  it("rejects a truncated latest tree", async () => {
    const { manager, fetch } = await installedManager({ timeoutMs: 500 });
    fetch
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ sha: "f".repeat(40) }))
      .mockResolvedValueOnce(jsonResponse({ truncated: true, tree: [] }));

    await expect(manager.checkUpdates()).rejects.toMatchObject({
      code: "GITHUB_TREE_TRUNCATED"
    });
  });

  it("settles on the batch deadline when fetch ignores abort", async () => {
    const { manager, fetch } = await installedManager({ timeoutMs: 20 });
    fetch.mockImplementation(() => new Promise<Response>(() => undefined));

    await expect(manager.checkUpdates()).rejects.toMatchObject({
      code: "MARKETPLACE_RESOLUTION_TIMEOUT"
    });
  });

  it("settles on caller cancellation when fetch ignores abort", async () => {
    const { manager, fetch } = await installedManager({ timeoutMs: 500 });
    fetch.mockImplementation(() => new Promise<Response>(() => undefined));
    const controller = new AbortController();
    const assertion = expect(manager.checkUpdates({ signal: controller.signal }))
      .rejects.toMatchObject({ code: "MARKETPLACE_RESOLUTION_ABORTED" });

    controller.abort("user cancelled");
    await assertion;
  });

  it("keeps deterministic batch order and runs at most four remote checks", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
    roots.push(root);
    const fetch = vi.fn();
    const now = vi.fn(() => new Date("2026-08-17T02:00:00.000Z"));
    const manager = createSkillManager({ root, fetch, marketplaceTimeoutMs: 500, now });
    const fixtures = ["echo-skill", "delta-skill", "charlie-skill", "bravo-skill", "alpha-skill"]
      .map((name) => installedBundleFixture(name, `${name} description.`));
    for (const fixture of fixtures) {
      fetch
        .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: fixture.tree }))
        .mockResolvedValueOnce(blobResponse(fixture.skillSha, fixture.skillDocument))
        .mockResolvedValueOnce(blobResponse(fixture.referenceSha, fixture.reference));
      await manager.installMarketplaceSkill({ entry: fixture.entry });
    }
    fetch.mockReset();
    now.mockClear();

    const latestCommitSha = "f".repeat(40);
    const latestTree = fixtures.flatMap((fixture) => fixture.tree);
    const gates = Array.from({ length: 4 }, deferred);
    let repositoryCalls = 0;
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    fetch.mockImplementation(async (input) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      try {
        const url = String(input);
        if (url === "https://api.github.com/repos/vercel-labs/agent-skills") {
          const call = repositoryCalls;
          repositoryCalls += 1;
          if (call < gates.length) await gates[call]!.promise;
          return jsonResponse({ default_branch: "main" });
        }
        if (url.endsWith("/commits/main")) return jsonResponse({ sha: latestCommitSha });
        if (url.endsWith(`/git/trees/${latestCommitSha}?recursive=1`)) {
          return jsonResponse({ truncated: false, tree: latestTree });
        }
        throw new Error(`Unexpected URL: ${url}`);
      } finally {
        activeRequests -= 1;
      }
    });

    const operation = manager.checkUpdates();
    await vi.waitFor(() => expect(repositoryCalls).toBe(4));
    expect(maximumActiveRequests).toBe(4);
    gates[0]!.resolve();
    await vi.waitFor(() => expect(repositoryCalls).toBe(5));
    gates.slice(1).forEach((gate) => gate.resolve());

    await expect(operation).resolves.toEqual([
      "alpha-skill",
      "bravo-skill",
      "charlie-skill",
      "delta-skill",
      "echo-skill"
    ].map((name) => expect.objectContaining({ name, status: "up-to-date" })));
    expect(maximumActiveRequests).toBe(4);
    expect(now).toHaveBeenCalledTimes(1);
  });
});

async function installedManager({ timeoutMs }: { timeoutMs: number }) {
  const root = await mkdtemp(join(tmpdir(), "dsh-skill-manager-update-"));
  roots.push(root);
  const fixture = installedBundleFixture();
  const fetch = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: fixture.tree }))
    .mockResolvedValueOnce(blobResponse(fixture.skillSha, fixture.skillDocument))
    .mockResolvedValueOnce(blobResponse(fixture.referenceSha, fixture.reference));
  const manager = createSkillManager({
    root,
    fetch,
    marketplaceTimeoutMs: timeoutMs
  });
  await manager.installMarketplaceSkill({ entry: fixture.entry });
  fetch.mockClear();
  return { manager, fetch };
}

function installedBundleFixture(
  name = "react-guidance",
  description = "Production React architecture guidance."
) {
  const skillDocument = [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    "# React guidance",
    ""
  ].join("\n");
  const reference = "# Checklist\n";
  const skillSha = gitBlobSha(skillDocument);
  const referenceSha = gitBlobSha(reference);
  const entry = resolvedEntry(skillSha, name, description);
  const tree = [
    {
      path: `skills/${name}/SKILL.md`,
      mode: "100644",
      type: "blob",
      sha: skillSha,
      size: Buffer.byteLength(skillDocument)
    },
    {
      path: `skills/${name}/references/checklist.md`,
      mode: "100644",
      type: "blob",
      sha: referenceSha,
      size: Buffer.byteLength(reference)
    }
  ];
  return { entry, skillDocument, reference, skillSha, referenceSha, tree };
}

function resolvedEntry(
  blobSha: string,
  name = "react-guidance",
  description = "Production React architecture guidance."
): ResolvedMarketplaceEntry {
  return {
    id: `vercel-labs/agent-skills/${name}`,
    source: "skills-sh",
    name,
    description,
    publisher: { name: "vercel-labs", url: "https://github.com/vercel-labs" },
    author: null,
    repository: {
      host: "github",
      id: 42,
      nodeId: "R_example",
      owner: "vercel-labs",
      name: "agent-skills",
      path: `skills/${name}`,
      url: "https://github.com/vercel-labs/agent-skills"
    },
    skillUrl: `https://skills.sh/vercel-labs/agent-skills/${name}`,
    install: {
      kind: "github",
      repository: "vercel-labs/agent-skills",
      skill: name,
      path: `skills/${name}`
    },
    metrics: {
      installs: { value: 123, source: "skills.sh" },
      stars: null,
      downloads: null
    },
    cover: { kind: "generated", seed: `vercel-labs/agent-skills/${name}` },
    snapshot: {
      commitSha: "a".repeat(40),
      blobSha,
      fetchedAt: "2026-08-17T01:30:00.000Z"
    }
  };
}

function deferred() {
  let resolve = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
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

function treeBundleHash(tree: Array<Record<string, unknown>>): string {
  const hash = createHash("sha256");
  for (const item of [...tree].sort((left, right) =>
    String(left.path).localeCompare(String(right.path)))) {
    hash.update(String(item.path).replace("skills/react-guidance/", ""));
    hash.update("\0");
    hash.update(String(item.mode));
    hash.update("\0");
    hash.update(String(item.sha));
    hash.update("\0");
    hash.update(String(item.size));
    hash.update("\0");
  }
  return hash.digest("hex");
}
