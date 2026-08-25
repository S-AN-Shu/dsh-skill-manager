import { Buffer } from "node:buffer";

import { createGitHubSnapshotResolver } from "./github-snapshot.js";
import type {
  MarketplaceFetch,
  RiskFinding,
  SkillRiskAssessment,
  SkillRiskAssessor
} from "./types.js";
import type { GitHubSnapshotCache } from "./github-snapshot-cache.js";

const SCANNER_VERSION = "1.0.0";
const MAX_SCAN_BYTES = 512 * 1024;

export interface StaticSkillRiskAssessorOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  now?: () => Date;
  cacheRoot?: string;
  snapshotCache?: GitHubSnapshotCache;
}

export function createStaticSkillRiskAssessor(
  options: StaticSkillRiskAssessorOptions = {}
): SkillRiskAssessor {
  const resolver = createGitHubSnapshotResolver({ ...options, refreshCommit: false });
  return {
    async assessSkillRisk(intent, request = {}) {
      const resolved = await resolver.resolveSkillSnapshot(intent, request);
      return scanBundle(resolved.files);
    },
    assessResolvedSkillRisk(resolved) {
      return scanBundle(resolved.files);
    }
  };
}

export function scanBundle(
  files: ReadonlyArray<{ path: string; content: Uint8Array }>
): SkillRiskAssessment {
  const findings: RiskFinding[] = [];
  for (const file of files) {
    const executable = /^(?:scripts\/|.*\.(?:sh|ps1|py|js|mjs|cjs|bat|cmd))$/iu.test(file.path);
    if (executable) addFinding(findings, {
      code: "SCRIPT_PRESENT",
      severity: "warning",
      title: "包含脚本",
      detail: "Skill bundle 包含可执行脚本文件；安装不会自动运行它。",
      file: file.path
    });
    if (file.content.byteLength > MAX_SCAN_BYTES) {
      addFinding(findings, {
        code: "FILE_SCAN_SKIPPED",
        severity: "info",
        title: "文件未完整扫描",
        detail: "文件超过静态扫描大小上限，风险状态可能不完整。",
        file: file.path
      });
      continue;
    }
    if (looksBinary(file.content)) continue;
    const text = Buffer.from(file.content).toString("utf8");
    if (/https?:\/\//iu.test(text)) addFinding(findings, {
      code: "NETWORK_REFERENCE",
      severity: "warning",
      title: "请求网络访问",
      detail: "内容包含网络地址或外部服务引用。",
      file: file.path
    });
    if (/(?:api[_ -]?key|access[_ -]?token|secret|password|credential|\.env|ssh\/|\.aws\/|\.config\/gcloud)/iu.test(text)) {
      addFinding(findings, {
        code: "SENSITIVE_REFERENCE",
        severity: "high",
        title: "提及凭据或敏感路径",
        detail: "内容提及凭据、令牌或常见敏感配置位置；安装前应人工检查。",
        file: file.path
      });
    }
    if (/(?:rm\s+-rf|remove-item\s+.+-recurse|format-volume|diskpart|del\s+\/s|rmdir\s+\/s|git\s+reset\s+--hard|curl\s+[^\r\n|]+\|\s*(?:sh|bash)|invoke-expression)/iu.test(text)) {
      addFinding(findings, {
        code: "DESTRUCTIVE_EXECUTION",
        severity: "high",
        title: "包含高风险执行模式",
        detail: "内容包含删除、覆盖、系统修改或下载后执行模式。",
        file: file.path
      });
    }
    if (/(?:\bmcp\b|tool[_ -]?call|shell|powershell|bash|python\s+-m)/iu.test(text)) addFinding(findings, {
      code: "TOOL_EXECUTION_REFERENCE",
      severity: "warning",
      title: "提及工具或命令执行",
      detail: "内容描述了 MCP、Shell 或其他工具调用。",
      file: file.path
    });
    if (/(?:upload|exfiltrat|send\s+.+to\s+https?:|webhook)/iu.test(text)) addFinding(findings, {
      code: "EXTERNAL_UPLOAD_REFERENCE",
      severity: "high",
      title: "可能向外部发送数据",
      detail: "内容提及上传、Webhook 或向外部服务发送数据。",
      file: file.path
    });
  }
  const risk = findings.some((finding) => finding.severity === "high")
    ? "high"
    : findings.some((finding) => finding.severity === "warning")
      ? "medium"
      : findings.length > 0 ? "low" : "low";
  return { risk, findings, scannerVersion: SCANNER_VERSION };
}

function addFinding(findings: RiskFinding[], finding: RiskFinding): void {
  if (!findings.some((candidate) => candidate.code === finding.code && candidate.file === finding.file)) {
    findings.push(finding);
  }
}

function looksBinary(content: Uint8Array): boolean {
  const sample = content.subarray(0, Math.min(content.byteLength, 4_096));
  let controlBytes = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return sample.byteLength > 0 && controlBytes / sample.byteLength > 0.05;
}
