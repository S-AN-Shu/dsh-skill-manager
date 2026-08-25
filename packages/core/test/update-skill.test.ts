import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSkillManager, type ResolvedMarketplaceEntry } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("managed GitHub Skill updates and rollback", () => {
  it("updates from a core-resolved snapshot and persists the displaced version", async () => {
    const fixture = await installedFixture();
    await fixture.manager.setTargetEnabled({ name: "react-guidance", target: "dsh", enabled: true });
    fixture.fetch.mockClear();
    queueLatest(fixture.fetch, fixture, updatedDocument(), "# Updated checklist\n");

    const result = await fixture.manager.updateSkill({ name: "react-guidance" });

    expect(result.skill).toMatchObject({
      name: "react-guidance",
      description: "Updated React architecture guidance.",
      enabledTargets: ["dsh"],
      source: { kind: "github", commitSha: "f".repeat(40) }
    });
    expect(result.backup).toMatchObject({
      name: "react-guidance",
      reason: "update",
      contentHash: fixture.installed.contentHash,
      snapshot: {
        commitSha: fixture.entry.snapshot.commitSha,
        blobSha: fixture.entry.snapshot.blobSha
      }
    });
    expect(result.backup.id).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(readFile(join(fixture.root, "library", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(updatedDocument());
    await expect(readFile(join(fixture.root, "active", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(updatedDocument());
    await expect(fixture.manager.listBackups({ name: "react-guidance" }))
      .resolves.toEqual([result.backup]);
  });

  it("rejects local modifications before network or backup creation", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    await writeFile(
      join(fixture.root, "library", "react-guidance", "references", "checklist.md"),
      "# User changes\n",
      "utf8"
    );

    await expect(fixture.manager.updateSkill({ name: "react-guidance" })).rejects.toMatchObject({
      code: "SKILL_LOCAL_MODIFIED"
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
    await expect(fixture.manager.listBackups()).resolves.toEqual([]);
  });

  it("lists backups after restart and makes rollback itself reversible", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    queueLatest(fixture.fetch, fixture, updatedDocument(), "# Updated checklist\n");
    const update = await fixture.manager.updateSkill({ name: "react-guidance" });
    await fixture.manager.setTargetEnabled({
      name: "react-guidance",
      target: "dsh",
      enabled: true
    });
    const restarted = createSkillManager({
      root: fixture.root,
      fetch: fixture.fetch,
      marketplaceTimeoutMs: 500,
      now: () => new Date("2026-08-17T04:00:00.000Z")
    });

    await expect(restarted.listBackups()).resolves.toEqual([update.backup]);
    const rollback = await restarted.rollbackSkill({
      name: "react-guidance",
      backupId: update.backup.id
    });

    expect(rollback.skill).toMatchObject({
      description: "Production React architecture guidance.",
      enabledTargets: ["dsh"],
      source: { kind: "github", commitSha: fixture.entry.snapshot.commitSha }
    });
    expect(rollback.backup).toMatchObject({
      name: "react-guidance",
      reason: "rollback",
      snapshot: { commitSha: "f".repeat(40) }
    });
    await expect(readFile(join(fixture.root, "active", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(originalDocument());
    await expect(restarted.listBackups({ name: "react-guidance" }))
      .resolves.toHaveLength(2);
  });

  it("rejects unsupported and already-current Skills without creating a backup", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-skill-update-"));
    roots.push(root);
    const localManager = createSkillManager({ root });
    await localManager.createSkill({ name: "local-notes", description: "Local notes." });
    await expect(localManager.updateSkill({ name: "local-notes" })).rejects.toMatchObject({
      code: "SKILL_UPDATE_UNSUPPORTED"
    });

    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    fixture.fetch
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ sha: fixture.entry.snapshot.commitSha }))
      .mockResolvedValueOnce(jsonResponse({
        truncated: false,
        tree: treeFor(originalDocument(), "# Checklist\n", fixture.entry.snapshot.commitSha)
      }));
    await expect(fixture.manager.updateSkill({ name: "react-guidance" })).rejects.toMatchObject({
      code: "SKILL_ALREADY_CURRENT"
    });
    await expect(fixture.manager.listBackups()).resolves.toEqual([]);
  });

  it("leaves the installed bundle unchanged when update download validation fails", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    const updated = updatedDocument();
    const latestTree = treeFor(updated, "# Updated checklist\n", "f".repeat(40));
    fixture.fetch
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ sha: "f".repeat(40) }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: latestTree }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: latestTree }))
      .mockResolvedValueOnce(blobResponse(gitBlobSha(updated), `${updated}\nforged`));

    await expect(fixture.manager.updateSkill({ name: "react-guidance" })).rejects.toMatchObject({
      code: "INVALID_GITHUB_RESPONSE"
    });
    await expect(readFile(join(fixture.root, "library", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(originalDocument());
    await expect(fixture.manager.listBackups()).resolves.toEqual([]);
  });

  it("refuses rollback over local changes and rejects untrusted backup identities", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    queueLatest(fixture.fetch, fixture, updatedDocument(), "# Updated checklist\n");
    const update = await fixture.manager.updateSkill({ name: "react-guidance" });
    await writeFile(
      join(fixture.root, "library", "react-guidance", "SKILL.md"),
      `${updatedDocument()}\n# User edit\n`,
      "utf8"
    );

    await expect(fixture.manager.rollbackSkill({
      name: "react-guidance",
      backupId: update.backup.id
    })).rejects.toMatchObject({ code: "SKILL_LOCAL_MODIFIED" });
    await expect(fixture.manager.rollbackSkill({
      name: "react-guidance",
      backupId: "..\\..\\library"
    })).rejects.toMatchObject({ code: "SKILL_BACKUP_NOT_FOUND" });
  });

  it("rejects a tampered persisted backup", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockClear();
    queueLatest(fixture.fetch, fixture, updatedDocument(), "# Updated checklist\n");
    const update = await fixture.manager.updateSkill({ name: "react-guidance" });
    await writeFile(
      join(
        fixture.root,
        "backups",
        "react-guidance",
        update.backup.id,
        "bundle",
        "SKILL.md"
      ),
      `${originalDocument()}\n# Tampered\n`,
      "utf8"
    );

    await expect(fixture.manager.rollbackSkill({
      name: "react-guidance",
      backupId: update.backup.id
    })).rejects.toMatchObject({ code: "SKILL_BACKUP_INVALID" });
    await expect(readFile(join(fixture.root, "library", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(updatedDocument());
  });

  it("settles update cancellation when the transport ignores abort", async () => {
    const fixture = await installedFixture();
    fixture.fetch.mockImplementation(() => new Promise<Response>(() => undefined));
    const controller = new AbortController();
    const assertion = expect(fixture.manager.updateSkill({
      name: "react-guidance",
      signal: controller.signal
    })).rejects.toMatchObject({ code: "MARKETPLACE_RESOLUTION_ABORTED" });

    controller.abort("user cancelled");
    await assertion;
    await expect(fixture.manager.listBackups()).resolves.toEqual([]);
  });

  it("uses one overall deadline across update checking and bundle download", async () => {
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValue(1_030);
    try {
      const fixture = await installedFixture();
      fixture.fetch.mockClear();
      const latestCommit = "f".repeat(40);
      const latestTree = treeFor(updatedDocument(), "# Updated checklist\n", latestCommit);
      fixture.fetch
        .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
        .mockResolvedValueOnce(jsonResponse({ sha: latestCommit }))
        .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: latestTree }))
        .mockImplementation(() => new Promise<Response>(() => undefined));
      const manager = createSkillManager({
        root: fixture.root,
        fetch: fixture.fetch,
        marketplaceTimeoutMs: 50
      });
      await expect(manager.updateSkill({ name: "react-guidance" }))
        .rejects.toMatchObject({ code: "MARKETPLACE_RESOLUTION_TIMEOUT" });
      expect(fixture.fetch).toHaveBeenCalledTimes(4);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("recovers an interrupted replacement after the old directory was displaced", async () => {
    const fixture = await installedFixture();
    const displaced = join(
      fixture.root,
      "library",
      `.displaced-react-guidance-${"1".repeat(8)}-${"1".repeat(4)}-4${"1".repeat(3)}-8${"1".repeat(3)}-${"1".repeat(12)}`
    );
    await rename(join(fixture.root, "library", "react-guidance"), displaced);

    const restarted = createSkillManager({ root: fixture.root, fetch: fixture.fetch });
    await expect(restarted.getSkill("react-guidance")).resolves.toMatchObject({
      description: "Production React architecture guidance."
    });
    await expect(readFile(join(fixture.root, "library", "react-guidance", "SKILL.md"), "utf8"))
      .resolves.toBe(originalDocument());
  });

  it("removes a displaced residue when the registry-selected bundle is already present", async () => {
    const fixture = await installedFixture();
    const displaced = join(
      fixture.root,
      "library",
      `.displaced-react-guidance-${"2".repeat(8)}-${"2".repeat(4)}-4${"2".repeat(3)}-8${"2".repeat(3)}-${"2".repeat(12)}`
    );
    await cp(join(fixture.root, "library", "react-guidance"), displaced, { recursive: true });

    const restarted = createSkillManager({ root: fixture.root, fetch: fixture.fetch });
    await expect(restarted.listSkills()).resolves.toHaveLength(1);
    await expect(readFile(join(displaced, "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rolls back a journaled replacement interrupted before registry commit", async () => {
    const fixture = await installedFixture();
    const transaction = transactionIds("3");
    const registry = JSON.parse(await readFile(join(fixture.root, "registry.json"), "utf8"));
    const destination = join(fixture.root, "library", "react-guidance");
    const displaced = join(fixture.root, "library", transaction.displacedName);
    const replacement = join(fixture.root, "library", transaction.replacementName);
    await writeBundle(replacement, updatedDocument(), "# Updated checklist\n");
    await rename(destination, displaced);
    await writeTransactionJournal(fixture.root, transaction, registry, updatedDocument());

    const restarted = createSkillManager({ root: fixture.root, fetch: fixture.fetch });
    await expect(restarted.getSkill("react-guidance")).resolves.toMatchObject({
      description: "Production React architecture guidance."
    });
    await expect(readFile(join(destination, "SKILL.md"), "utf8"))
      .resolves.toBe(originalDocument());
    await expect(readFile(join(replacement, "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("finishes cleanup for a journaled replacement committed in the registry", async () => {
    const fixture = await installedFixture();
    const transaction = transactionIds("4");
    const registryPath = join(fixture.root, "registry.json");
    const previousRegistry = JSON.parse(await readFile(registryPath, "utf8"));
    const destination = join(fixture.root, "library", "react-guidance");
    const displaced = join(fixture.root, "library", transaction.displacedName);
    await rename(destination, displaced);
    await writeBundle(destination, updatedDocument(), "# Updated checklist\n");
    const latestCommit = "f".repeat(40);
    const updatedTree = treeFor(updatedDocument(), "# Updated checklist\n", latestCommit);
    const currentRegistry = structuredClone(previousRegistry);
    currentRegistry.skills["react-guidance"] = {
      ...currentRegistry.skills["react-guidance"],
      description: "Updated React architecture guidance.",
      contentHash: bundleContentHash(updatedDocument(), "# Updated checklist\n"),
      source: {
        ...currentRegistry.skills["react-guidance"].source,
        commitSha: latestCommit,
        blobSha: gitBlobSha(updatedDocument()),
        bundleHash: treeBundleHash(updatedTree)
      }
    };
    await writeFile(registryPath, `${JSON.stringify(currentRegistry, null, 2)}\n`, "utf8");
    await writeTransactionJournal(fixture.root, transaction, previousRegistry, updatedDocument());

    const restarted = createSkillManager({ root: fixture.root, fetch: fixture.fetch });
    await expect(restarted.getSkill("react-guidance")).resolves.toMatchObject({
      description: "Updated React architecture guidance."
    });
    await expect(readFile(join(displaced, "SKILL.md"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });
});

function transactionIds(digit: string) {
  const transactionId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  const backupDigit = digit === "9" ? "8" : String(Number(digit) + 1);
  const backupId = `${backupDigit.repeat(8)}-${backupDigit.repeat(4)}-4${backupDigit.repeat(3)}-8${backupDigit.repeat(3)}-${backupDigit.repeat(12)}`;
  return {
    transactionId,
    backupId,
    displacedName: `.displaced-react-guidance-${transactionId}`,
    replacementName: `.update-react-guidance-${backupId}`
  };
}

async function writeTransactionJournal(
  root: string,
  transaction: ReturnType<typeof transactionIds>,
  previousRegistry: Record<string, unknown> & {
    skills: Record<string, { contentHash: string }>;
  },
  replacementDocument: string
) {
  await writeFile(
    join(root, `.replacement-${transaction.transactionId}.json`),
    `${JSON.stringify({
      version: 1,
      id: transaction.transactionId,
      name: "react-guidance",
      currentHash: previousRegistry.skills["react-guidance"].contentHash,
      replacementHash: bundleContentHash(replacementDocument, "# Updated checklist\n"),
      displacedName: transaction.displacedName,
      replacementName: transaction.replacementName,
      backupId: transaction.backupId,
      previousRegistry
    }, null, 2)}\n`,
    "utf8"
  );
}

async function writeBundle(root: string, document: string, reference: string) {
  await mkdir(join(root, "references"), { recursive: true });
  await writeFile(join(root, "SKILL.md"), document, "utf8");
  await writeFile(join(root, "references", "checklist.md"), reference, "utf8");
}

function bundleContentHash(document: string, reference: string): string {
  const hash = createHash("sha256");
  for (const [path, content] of [
    ["references/checklist.md", reference],
    ["SKILL.md", document]
  ] as const) {
    hash.update(path);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
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

async function installedFixture() {
  const root = await mkdtemp(join(tmpdir(), "dsh-skill-update-"));
  roots.push(root);
  const document = originalDocument();
  const reference = "# Checklist\n";
  const entry = resolvedEntry(gitBlobSha(document));
  const tree = treeFor(document, reference, entry.snapshot.commitSha);
  const fetch = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ truncated: false, tree }))
    .mockResolvedValueOnce(blobResponse(gitBlobSha(document), document))
    .mockResolvedValueOnce(blobResponse(gitBlobSha(reference), reference));
  const manager = createSkillManager({
    root,
    fetch,
    marketplaceTimeoutMs: 500,
    now: () => new Date("2026-08-17T03:00:00.000Z")
  });
  const installed = await manager.installMarketplaceSkill({ entry });
  return { root, manager, fetch, entry, installed };
}

function queueLatest(
  fetch: ReturnType<typeof vi.fn>,
  fixture: Awaited<ReturnType<typeof installedFixture>>,
  document: string,
  reference: string
) {
  const commitSha = "f".repeat(40);
  const tree = treeFor(document, reference, commitSha);
  fetch
    .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
    .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
    .mockResolvedValueOnce(jsonResponse({ truncated: false, tree }))
    .mockResolvedValueOnce(jsonResponse({ truncated: false, tree }))
    .mockResolvedValueOnce(blobResponse(gitBlobSha(document), document))
    .mockResolvedValueOnce(blobResponse(gitBlobSha(reference), reference));
}

function treeFor(document: string, reference: string, _commitSha: string) {
  return [
    {
      path: "skills/react-guidance/SKILL.md",
      mode: "100644",
      type: "blob",
      sha: gitBlobSha(document),
      size: Buffer.byteLength(document)
    },
    {
      path: "skills/react-guidance/references/checklist.md",
      mode: "100644",
      type: "blob",
      sha: gitBlobSha(reference),
      size: Buffer.byteLength(reference)
    }
  ];
}

function originalDocument() {
  return [
    "---",
    "name: react-guidance",
    "description: Production React architecture guidance.",
    "---",
    "",
    "# React guidance",
    ""
  ].join("\n");
}

function updatedDocument() {
  return [
    "---",
    "name: react-guidance",
    "description: Updated React architecture guidance.",
    "---",
    "",
    "# Updated React guidance",
    ""
  ].join("\n");
}

function resolvedEntry(blobSha: string): ResolvedMarketplaceEntry {
  return {
    id: "vercel-labs/agent-skills/react-guidance",
    source: "skills-sh",
    name: "react-guidance",
    description: "Production React architecture guidance.",
    publisher: { name: "vercel-labs", url: "https://github.com/vercel-labs" },
    author: null,
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
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: "react-guidance" },
    snapshot: { commitSha: "a".repeat(40), blobSha, fetchedAt: "2026-08-17T03:00:00.000Z" }
  };
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
