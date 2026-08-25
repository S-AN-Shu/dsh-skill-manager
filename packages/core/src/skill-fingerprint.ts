import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { SkillManagerError } from "./skill-manager-error.js";

export const SKILL_IDENTITY_FINGERPRINT_VERSION = "dsm-skill-fingerprint-v1" as const;
export const MANAGER_PROVENANCE_METADATA_PATH = ".dsh-skill-manager/provenance.json" as const;

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export interface SkillFingerprintFile {
  path: string;
  content: Uint8Array;
}

export interface SkillIdentityFingerprint {
  version: typeof SKILL_IDENTITY_FINGERPRINT_VERSION;
  hash: string;
}

export function fingerprintSkillFiles(
  inputFiles: ReadonlyArray<SkillFingerprintFile>
): SkillIdentityFingerprint {
  const comparablePaths = new Set<string>();
  const files = inputFiles
    .map((file) => ({ path: normalizeSkillPath(file.path), content: file.content }))
    .filter((file) => file.path !== MANAGER_PROVENANCE_METADATA_PATH)
    .sort((left, right) => left.path.localeCompare(right.path));

  if (files.length === 0) unsafeBundle("Skill bundle does not contain fingerprintable files.");
  const hash = createHash("sha256");
  hash.update(frame(Buffer.from(SKILL_IDENTITY_FINGERPRINT_VERSION, "utf8")));
  for (const file of files) {
    const comparable = file.path.toLocaleLowerCase("en-US");
    if (comparablePaths.has(comparable)) {
      unsafeBundle("Skill bundle contains duplicate or case-colliding paths.");
    }
    comparablePaths.add(comparable);
    if (!(file.content instanceof Uint8Array)) unsafeBundle("Skill bundle contains invalid file content.");
    const content = canonicalizeContent(file.content);
    hash.update(frame(Buffer.from(file.path, "utf8")));
    hash.update(frame(content));
  }
  return { version: SKILL_IDENTITY_FINGERPRINT_VERSION, hash: hash.digest("hex") };
}

export async function fingerprintSkillDirectory(root: string): Promise<SkillIdentityFingerprint> {
  const files: SkillFingerprintFile[] = [];
  await collectDirectoryFiles(root, "", files);
  return fingerprintSkillFiles(files);
}

async function collectDirectoryFiles(
  root: string,
  relative: string,
  files: SkillFingerprintFile[]
): Promise<void> {
  const directory = relative.length === 0 ? root : join(root, ...relative.split("/"));
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = normalizeSkillPath(relative.length === 0 ? entry.name : `${relative}/${entry.name}`);
    if (entry.isSymbolicLink()) unsafeBundle("Skill bundle contains an unsupported symbolic link.");
    if (entry.isDirectory()) {
      await collectDirectoryFiles(root, path, files);
      continue;
    }
    if (!entry.isFile()) unsafeBundle("Skill bundle contains an unsupported filesystem entry.");
    files.push({ path, content: await readFile(join(root, ...path.split("/"))) });
  }
}

function normalizeSkillPath(value: string): string {
  const path = value.replaceAll("\\", "/");
  if (
    path.length === 0
    || path.startsWith("/")
    || path.includes("\0")
    || path.split("/").some((segment) => (
      segment.length === 0
      || segment === "."
      || segment === ".."
      || /[<>:"|?*\u0000-\u001f]/u.test(segment)
      || /[. ]$/u.test(segment)
      || WINDOWS_RESERVED_NAME.test(segment)
    ))
  ) unsafeBundle("Skill bundle contains an unsafe relative path.");
  return path;
}

function canonicalizeContent(content: Uint8Array): Buffer {
  const bytes = Buffer.from(content);
  if (!isUtf8Text(bytes)) return bytes;
  const normalized: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 13) {
      if (bytes[index + 1] === 10) index += 1;
      normalized.push(10);
    } else {
      normalized.push(bytes[index]!);
    }
  }
  return Buffer.from(normalized);
}

function isUtf8Text(content: Uint8Array): boolean {
  try {
    UTF8_DECODER.decode(content);
  } catch {
    return false;
  }
  const sample = content.subarray(0, Math.min(content.byteLength, 4_096));
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1;
  }
  return sample.byteLength === 0 || controls / sample.byteLength <= 0.05;
}

function frame(value: Uint8Array): Buffer {
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(value.byteLength));
  return Buffer.concat([length, value]);
}

function unsafeBundle(message: string): never {
  throw new SkillManagerError("UNSAFE_SKILL_BUNDLE", message);
}
