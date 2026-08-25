import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SKILL_IDENTITY_FINGERPRINT_VERSION,
  fingerprintSkillDirectory,
  fingerprintSkillFiles
} from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("canonical Skill identity fingerprint", () => {
  it("normalizes only path separators and UTF-8 line endings across the complete bundle", () => {
    const lf = fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("---\nname: demo\ndescription: Demo.\n---\n\nBody  \n") },
      { path: "references\\guide.md", content: Buffer.from("# Guide\nLine\n") },
      { path: "assets/icon.bin", content: Uint8Array.from([0, 13, 10, 255]) }
    ]);
    const crlf = fingerprintSkillFiles([
      { path: "assets/icon.bin", content: Uint8Array.from([0, 13, 10, 255]) },
      { path: "references/guide.md", content: Buffer.from("# Guide\r\nLine\r\n") },
      { path: "SKILL.md", content: Buffer.from("---\r\nname: demo\r\ndescription: Demo.\r\n---\r\n\r\nBody  \r\n") }
    ]);

    expect(lf).toEqual({ version: SKILL_IDENTITY_FINGERPRINT_VERSION, hash: crlf.hash });
    expect(fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("---\nname: demo\ndescription: Demo.\n---\n\nBody \n") },
      { path: "references/guide.md", content: Buffer.from("# Guide\nLine\n") },
      { path: "assets/icon.bin", content: Uint8Array.from([0, 13, 10, 255]) }
    ]).hash).not.toBe(lf.hash);
    expect(fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("---\ndescription: Demo.\nname: demo\n---\n\nBody  \n") },
      { path: "references/guide.md", content: Buffer.from("# Guide\nLine\n") },
      { path: "assets/icon.bin", content: Uint8Array.from([0, 13, 10, 255]) }
    ]).hash).not.toBe(lf.hash);
    expect(fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("---\nname: demo\ndescription: Demo.\n---\n\nBody  \n") },
      { path: "references/guide.md", content: Buffer.from("# Guide\nChanged\n") },
      { path: "assets/icon.bin", content: Uint8Array.from([0, 13, 10, 255]) }
    ]).hash).not.toBe(lf.hash);
    expect(fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("---\nname: demo\ndescription: Demo.\n---\n\nBody  \n") },
      { path: "references/guide.md", content: Buffer.from("# Guide\nLine\n") },
      { path: "assets/icon.bin", content: Uint8Array.from([0, 10, 13, 255]) }
    ]).hash).not.toBe(lf.hash);
  });

  it("rejects unsafe, duplicate, and symbolic-link bundle entries", async () => {
    expect(() => fingerprintSkillFiles([{ path: "../SKILL.md", content: Buffer.from("x") }]))
      .toThrowError(expect.objectContaining({ code: "UNSAFE_SKILL_BUNDLE" }));
    expect(() => fingerprintSkillFiles([
      { path: "SKILL.md", content: Buffer.from("x") },
      { path: "SKILL.md", content: Buffer.from("x") }
    ])).toThrowError(expect.objectContaining({ code: "UNSAFE_SKILL_BUNDLE" }));

    const root = await mkdtemp(join(tmpdir(), "dsh-fingerprint-"));
    roots.push(root);
    await mkdir(join(root, "references"));
    await writeFile(join(root, "SKILL.md"), "---\nname: demo\ndescription: Demo.\n---\n");
    await writeFile(join(root, "references", "guide.md"), "Guide\n");
    await symlink(join(root, "references"), join(root, "linked"), "junction");

    await expect(fingerprintSkillDirectory(root)).rejects.toMatchObject({
      code: "UNSAFE_SKILL_BUNDLE"
    });
  });
});
