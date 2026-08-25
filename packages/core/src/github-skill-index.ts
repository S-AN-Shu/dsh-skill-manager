import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  SKILL_IDENTITY_FINGERPRINT_VERSION,
  type SkillIdentityFingerprint
} from "./skill-fingerprint.js";

const INDEX_SCHEMA_VERSION = 1 as const;
const SHA_1 = /^[a-f0-9]{40}$/iu;
const SHA_256 = /^[a-f0-9]{64}$/iu;
const GITHUB_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;

export interface GitHubSkillObservation {
  repositoryId: number;
  nodeId: string;
  repository: { owner: string; name: string };
  skillPath: string;
  skillName: string;
  fingerprint: SkillIdentityFingerprint;
  commitSha: string;
  skillDocumentBlobSha: string;
  bundleHash: string;
  manifestFiles: string[];
  observedAt: string;
  verifiedAt: string;
}

interface GitHubSkillIndexFile {
  schemaVersion: typeof INDEX_SCHEMA_VERSION;
  observations: GitHubSkillObservation[];
}

export interface GitHubSkillIndexOptions {
  path: string;
  versionsPerSkill?: number;
  maxObservations?: number;
}

export interface GitHubSkillIndex {
  list(): Promise<GitHubSkillObservation[]>;
  findByFingerprint(fingerprint: SkillIdentityFingerprint): Promise<GitHubSkillObservation[]>;
  findByRepositoryPath(repositoryId: number, skillPath: string): Promise<GitHubSkillObservation[]>;
  record(observation: GitHubSkillObservation): Promise<void>;
}

export function createGitHubSkillIndex(options: GitHubSkillIndexOptions): GitHubSkillIndex {
  const versionsPerSkill = positiveInteger(options.versionsPerSkill ?? 5, "versionsPerSkill");
  const maxObservations = positiveInteger(options.maxObservations ?? 10_000, "maxObservations");
  let writes = Promise.resolve();

  const read = async (): Promise<GitHubSkillObservation[]> => {
    try {
      const value = JSON.parse(await readFile(options.path, "utf8")) as unknown;
      if (!isIndexFile(value)) return [];
      return value.observations.map(cloneObservation);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      if (error instanceof SyntaxError) return [];
      throw error;
    }
  };

  return {
    list: read,
    async findByFingerprint(fingerprint) {
      if (!isFingerprint(fingerprint)) return [];
      return (await read())
        .filter((entry) => entry.fingerprint.version === fingerprint.version
          && entry.fingerprint.hash === fingerprint.hash)
        .sort(newestFirst);
    },
    async findByRepositoryPath(repositoryId, skillPath) {
      return (await read())
        .filter((entry) => entry.repositoryId === repositoryId && entry.skillPath === skillPath)
        .sort(newestFirst);
    },
    async record(observation) {
      const verified = validateObservation(observation);
      const operation = writes.then(async () => {
        const current = await read();
        const identity = observationIdentity(verified);
        const withoutDuplicate = current.filter((entry) => observationIdentity(entry) !== identity);
        const grouped = new Map<string, GitHubSkillObservation[]>();
        for (const entry of [verified, ...withoutDuplicate]) {
          const key = `${entry.repositoryId}#${entry.skillPath}`;
          const group = grouped.get(key) ?? [];
          group.push(entry);
          grouped.set(key, group);
        }
        const bounded = [...grouped.values()]
          .flatMap((group) => group.sort(newestFirst).slice(0, versionsPerSkill))
          .sort(newestFirst)
          .slice(0, maxObservations);
        await writeAtomic(options.path, {
          schemaVersion: INDEX_SCHEMA_VERSION,
          observations: bounded
        });
      });
      writes = operation.catch(() => undefined);
      return operation;
    }
  };
}

async function writeAtomic(path: string, value: GitHubSkillIndexFile): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const backup = `${path}.${randomUUID()}.bak`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  let hadExisting = false;
  try {
    await rename(path, backup);
    hadExisting = true;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      await rm(temporary, { force: true });
      throw error;
    }
  }
  try {
    await rename(temporary, path);
    if (hadExisting) await rm(backup, { force: true });
  } catch (error) {
    await rm(temporary, { force: true });
    if (hadExisting) await rename(backup, path).catch(() => undefined);
    throw error;
  }
}

function validateObservation(value: GitHubSkillObservation): GitHubSkillObservation {
  if (!isObservation(value)) throw new TypeError("GitHub Skill observation is invalid.");
  return cloneObservation(value);
}

function isIndexFile(value: unknown): value is GitHubSkillIndexFile {
  return isRecord(value)
    && value.schemaVersion === INDEX_SCHEMA_VERSION
    && Array.isArray(value.observations)
    && value.observations.length <= 10_000
    && value.observations.every(isObservation);
}

function isObservation(value: unknown): value is GitHubSkillObservation {
  if (!isRecord(value) || !isRecord(value.repository) || !isFingerprint(value.fingerprint)) return false;
  return Number.isSafeInteger(value.repositoryId) && Number(value.repositoryId) > 0
    && typeof value.nodeId === "string" && value.nodeId.length > 0
    && typeof value.repository.owner === "string" && GITHUB_SEGMENT.test(value.repository.owner)
    && typeof value.repository.name === "string" && GITHUB_SEGMENT.test(value.repository.name)
    && typeof value.skillPath === "string" && isSafePath(value.skillPath)
    && typeof value.skillName === "string" && value.skillName.length > 0
    && typeof value.commitSha === "string" && SHA_1.test(value.commitSha)
    && typeof value.skillDocumentBlobSha === "string" && SHA_1.test(value.skillDocumentBlobSha)
    && typeof value.bundleHash === "string" && SHA_256.test(value.bundleHash)
    && Array.isArray(value.manifestFiles) && value.manifestFiles.every((path) => typeof path === "string" && isSafePath(path))
    && typeof value.observedAt === "string" && isIsoDate(value.observedAt)
    && typeof value.verifiedAt === "string" && isIsoDate(value.verifiedAt);
}

function isFingerprint(value: unknown): value is SkillIdentityFingerprint {
  return isRecord(value)
    && value.version === SKILL_IDENTITY_FINGERPRINT_VERSION
    && typeof value.hash === "string"
    && SHA_256.test(value.hash);
}

function cloneObservation(value: GitHubSkillObservation): GitHubSkillObservation {
  return {
    ...value,
    repository: { ...value.repository },
    fingerprint: { ...value.fingerprint },
    manifestFiles: [...value.manifestFiles]
  };
}

function observationIdentity(value: GitHubSkillObservation): string {
  return `${value.repositoryId}#${value.skillPath}@${value.commitSha}:${value.fingerprint.hash}`;
}

function newestFirst(left: GitHubSkillObservation, right: GitHubSkillObservation): number {
  return right.verifiedAt.localeCompare(left.verifiedAt)
    || right.observedAt.localeCompare(left.observedAt)
    || right.commitSha.localeCompare(left.commitSha);
}

function isSafePath(path: string): boolean {
  return path === "." || (path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0")
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."));
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
