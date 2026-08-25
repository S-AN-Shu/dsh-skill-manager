import {
  IconCloseOutline16,
  IconPlusOutline16,
  IconRefreshOutline16,
  IconRightUpOutline14,
  IconSearchOutline16
} from "@deepseek-ai/dsh-client-ui-primitives";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal, flushSync } from "react-dom";

import { skillManagerClientDescriptors } from "./client-descriptors.js";
import {
  RPC_SCHEMA_VERSION,
  type AssessSkillRiskRpcRequest,
  type BrowseRepositoriesRpcRequest,
  type CheckUpdatesRpcRequest,
  type CreateSkillRpcRequest,
  type DeleteSkillRpcRequest,
  type DiscoverExternalRpcRequest,
  type ExternalSkillCandidateWire,
  type ImportExternalRpcRequest,
  type GetCapabilitiesRpcRequest,
  type InspectRepositoryRpcRequest,
  type InstallRepositoryRpcRequest,
  type InstallSkillRpcRequest,
  type ListBackupsRpcRequest,
  type ListSkillsRpcRequest,
  type ListTargetStatesRpcRequest,
  type ListTrashRpcRequest,
  type ManagedSkillWire,
  type ProvenanceBatchFailureWire,
  type RepositoryCandidateWire,
  type RepositoryInspectionWire,
  type RepositoryInspectionResultWire,
  type RepositoryInstallResultWire,
  type RepositoryQueryResultWire,
  type RepositorySortWire,
  type SkillCategoryIdWire,
  type ResolveMediaRpcRequest,
  type MediaAssetWire,
  type MediaSourceWire,
  type RollbackSkillRpcRequest,
  type RestoreTrashRpcRequest,
  type RpcResponse,
  type SearchRepositoriesRpcRequest,
  type SetEnabledRpcRequest,
  type SetTargetEnabledRpcRequest,
  type SkillBackupWire,
  type SkillMutationResultWire,
  type SkillTargetStateWire,
  type SkillUpdateCheckWire,
  type TrashedSkillWire,
  type SkillProvenanceVerificationWire,
  type SkillManagerCapabilitiesWire,
  type SkillRiskAssessmentWire,
  type UpdateSkillRpcRequest,
  type VerifyProvenanceBatchRpcRequest,
  type VerifyProvenanceRpcRequest
} from "./rpc.js";

const STYLE_ATTRIBUTE = "dsh-skill-manager/client";

export interface SkillManagerRemote {
  list(request: ListSkillsRpcRequest): Promise<RpcResponse<{ skills: ManagedSkillWire[] }>>;
  create(request: CreateSkillRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  setEnabled(request: SetEnabledRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  getCapabilities?(
    request: GetCapabilitiesRpcRequest
  ): Promise<RpcResponse<{ capabilities: SkillManagerCapabilitiesWire }>>;
  searchRepositories?(
    request: SearchRepositoriesRpcRequest
  ): Promise<RpcResponse<{ result: RepositoryQueryResultWire }>>;
  browseRepositories?(
    request: BrowseRepositoriesRpcRequest
  ): Promise<RpcResponse<{ result: RepositoryQueryResultWire }>>;
  inspectRepository?(
    request: InspectRepositoryRpcRequest
  ): Promise<RpcResponse<RepositoryInspectionResultWire>>;
  installSkill?(
    request: InstallSkillRpcRequest
  ): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  installRepository?(
    request: InstallRepositoryRpcRequest
  ): Promise<RpcResponse<{ results: RepositoryInstallResultWire[] }>>;
  assessSkillRisk?(
    request: AssessSkillRiskRpcRequest
  ): Promise<RpcResponse<{ assessment: SkillRiskAssessmentWire }>>;
  resolveMedia?(
    request: ResolveMediaRpcRequest
  ): Promise<RpcResponse<{ asset: MediaAssetWire }>>;
  verifyProvenance?(
    request: VerifyProvenanceRpcRequest
  ): Promise<RpcResponse<{ verification: SkillProvenanceVerificationWire }>>;
  verifyProvenanceBatch?(
    request: VerifyProvenanceBatchRpcRequest
  ): Promise<RpcResponse<{
    results: SkillProvenanceVerificationWire[];
    failures?: ProvenanceBatchFailureWire[];
  }>>;
  checkUpdates(
    request: CheckUpdatesRpcRequest
  ): Promise<RpcResponse<{ checks: SkillUpdateCheckWire[] }>>;
  update(request: UpdateSkillRpcRequest): Promise<RpcResponse<SkillMutationResultWire>>;
  listBackups(
    request: ListBackupsRpcRequest
  ): Promise<RpcResponse<{ backups: SkillBackupWire[] }>>;
  rollback(request: RollbackSkillRpcRequest): Promise<RpcResponse<SkillMutationResultWire>>;
  delete?(request: DeleteSkillRpcRequest): Promise<RpcResponse<{ deleted: { name: string; trashId: string; deletedAt: string } }>>;
  listTrash?(request: ListTrashRpcRequest): Promise<RpcResponse<{ trashed: TrashedSkillWire[] }>>;
  restoreTrash?(request: RestoreTrashRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  discoverExternal?(request: DiscoverExternalRpcRequest): Promise<RpcResponse<{ candidates: ExternalSkillCandidateWire[] }>>;
  importExternal?(request: ImportExternalRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  listTargetStates?(request: ListTargetStatesRpcRequest): Promise<RpcResponse<{ states: SkillTargetStateWire[] }>>;
  setTargetEnabled?(request: SetTargetEnabledRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
}

interface TypertRemoteFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

interface TypertRemoteSuccess<T> {
  ok: true;
  value: T;
}

type TypertRemoteResult<T> = TypertRemoteSuccess<T> | TypertRemoteFailure;

type TypertSkillManagerRemote = {
  [Method in keyof Required<SkillManagerRemote>]: (
    request: Parameters<Required<SkillManagerRemote>[Method]>[0]
  ) => Promise<TypertRemoteResult<Awaited<ReturnType<Required<SkillManagerRemote>[Method]>>>>;
};

export interface SkillManagerPanelProps {
  remote: SkillManagerRemote;
}

interface ClientContextLike {
  remote: {
    $mount(options: {
      package: string;
      descriptors: typeof skillManagerClientDescriptors;
    }): Promise<() => void | Promise<void>>;
  };
  get(name: string): unknown;
  slots: {
    inject(name: string, registration: () => unknown, label?: string): unknown;
    register(
      options: {
        name: string;
        id: string;
        order: number;
        label: () => string;
        inject: () => SkillManagerPanelProps;
      },
      component: typeof SkillManagerPanel
    ): unknown;
  };
}

export const inject = ["slots", "remote"] as const;

export async function apply(ctx: ClientContextLike) {
  const disposeRemote = await ctx.remote.$mount({
    package: "dsh-skill-manager",
    descriptors: skillManagerClientDescriptors
  });
  const disposeStyles = ensureSkillManagerStyles();
  const remote = adaptTypertRemote(ctx.get("remote.skillManager") as TypertSkillManagerRemote);

  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "skill-manager",
    order: 30,
    label: () => "Skill 管理插件",
    inject: () => ({ remote })
  }, SkillManagerPanel), "dsh-skill-manager: settings section entry");

  return async () => {
    try {
      await disposeRemote();
    } finally {
      disposeStyles();
    }
  };
}

export function adaptTypertRemote(remote: TypertSkillManagerRemote): SkillManagerRemote {
  const invoke = async <T,>(operation: Promise<TypertRemoteResult<T>>): Promise<T> => {
    const result = await operation;
    if (result.ok) return result.value;
    throw new Error(`${result.error.message} (${result.error.code})`);
  };

  return {
    list: (request) => invoke(remote.list(request)),
    create: (request) => invoke(remote.create(request)),
    setEnabled: (request) => invoke(remote.setEnabled(request)),
    getCapabilities: (request) => invoke(remote.getCapabilities(request)),
    searchRepositories: (request) => invoke(remote.searchRepositories(request)),
    browseRepositories: (request) => invoke(remote.browseRepositories(request)),
    inspectRepository: (request) => invoke(remote.inspectRepository(request)),
    installSkill: (request) => invoke(remote.installSkill(request)),
    installRepository: (request) => invoke(remote.installRepository(request)),
    assessSkillRisk: (request) => invoke(remote.assessSkillRisk(request)),
    resolveMedia: (request) => invoke(remote.resolveMedia(request)),
    verifyProvenance: (request) => invoke(remote.verifyProvenance(request)),
    verifyProvenanceBatch: (request) => invoke(remote.verifyProvenanceBatch(request)),
    checkUpdates: (request) => invoke(remote.checkUpdates(request)),
    update: (request) => invoke(remote.update(request)),
    listBackups: (request) => invoke(remote.listBackups(request)),
    rollback: (request) => invoke(remote.rollback(request)),
    delete: (request) => invoke(remote.delete(request)),
    listTrash: (request) => invoke(remote.listTrash(request)),
    restoreTrash: (request) => invoke(remote.restoreTrash(request)),
    discoverExternal: (request) => invoke(remote.discoverExternal(request)),
    importExternal: (request) => invoke(remote.importExternal(request)),
    listTargetStates: (request) => invoke(remote.listTargetStates(request)),
    setTargetEnabled: (request) => invoke(remote.setTargetEnabled(request))
  };
}

export function SkillManagerPanel({ remote }: SkillManagerPanelProps) {
  const [skills, setSkills] = useState<ManagedSkillWire[]>([]);
  const [view, setView] = useState<SkillView>("all");
  const [localQuery, setLocalQuery] = useState("");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketActiveQuery, setMarketActiveQuery] = useState<string | null>(null);
  const [marketCapabilities, setMarketCapabilities] = useState<SkillManagerCapabilitiesWire | null>(null);
  const [marketHostChecked, setMarketHostChecked] = useState(false);
  const [marketRepositories, setMarketRepositories] = useState<RepositoryCandidateWire[]>([]);
  const [marketSort, setMarketSort] = useState<RepositorySortWire>("trend-monthly");
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("all");
  const [marketSearched, setMarketSearched] = useState(false);
  const [marketPage, setMarketPage] = useState(1);
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketHasMore, setMarketHasMore] = useState(false);
  const [marketDataUpdatedAt, setMarketDataUpdatedAt] = useState<string | null>(null);
  const [marketSourceState, setMarketSourceState] = useState<RepositoryQueryResultWire["sourceState"]>("empty");
  const [marketSourceMessage, setMarketSourceMessage] = useState<string | null>(null);
  const [inspectionRepository, setInspectionRepository] = useState<RepositoryCandidateWire | null>(null);
  const [inspection, setInspection] = useState<RepositoryInspectionWire | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [inspectionAvatarUrl, setInspectionAvatarUrl] = useState<string | null>(null);
  const [inspectionMedia, setInspectionMedia] = useState<ResolvedInspectionMedia[]>([]);
  const [selectedInspectionMediaId, setSelectedInspectionMediaId] = useState<string | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(() => new Set());
  const [riskAssessments, setRiskAssessments] = useState<Map<string, SkillRiskAssessmentWire>>(() => new Map());
  const [installingSkillPaths, setInstallingSkillPaths] = useState<Set<string>>(() => new Set());
  const [installResults, setInstallResults] = useState<Map<string, { ok: boolean; message: string }>>(() => new Map());
  const [confirmHighRiskInstall, setConfirmHighRiskInstall] = useState(false);
  const [provenanceCheckingNames, setProvenanceCheckingNames] = useState<Set<string>>(
    () => new Set()
  );
  const [provenanceStatuses, setProvenanceStatuses] = useState<Map<string, ProvenanceDisplayStatus>>(
    () => new Map()
  );
  const [provenanceErrors, setProvenanceErrors] = useState<Map<string, string>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyNames, setBusyNames] = useState<Set<string>>(() => new Set());
  const [selectedManagedNames, setSelectedManagedNames] = useState<Set<string>>(() => new Set());
  const [bulkManagedAction, setBulkManagedAction] = useState<"enable" | "disable" | "delete" | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkEnabling, setBulkEnabling] = useState(false);
  const [checkingUpdateNames, setCheckingUpdateNames] = useState<Set<string>>(() => new Set());
  const [updateChecks, setUpdateChecks] = useState<Map<string, SkillUpdateCheckWire>>(
    () => new Map()
  );
  const [updatingNames, setUpdatingNames] = useState<Set<string>>(() => new Set());
  const [confirmingRiskUpdateName, setConfirmingRiskUpdateName] = useState<string | null>(null);
  const [expandedBackupNames, setExpandedBackupNames] = useState<Set<string>>(
    () => new Set()
  );
  const [backupsByName, setBackupsByName] = useState<Map<string, SkillBackupWire[]>>(
    () => new Map()
  );
  const [loadingBackupNames, setLoadingBackupNames] = useState<Set<string>>(() => new Set());
  const [rollingBackIds, setRollingBackIds] = useState<Set<string>>(() => new Set());
  const [confirmingBackupId, setConfirmingBackupId] = useState<string | null>(null);
  const [deletingNames, setDeletingNames] = useState<Set<string>>(() => new Set());
  const [confirmingDeleteName, setConfirmingDeleteName] = useState<string | null>(null);
  const [trashedSkills, setTrashedSkills] = useState<TrashedSkillWire[]>([]);
  const [trashExpanded, setTrashExpanded] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [restoringTrashIds, setRestoringTrashIds] = useState<Set<string>>(() => new Set());
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>(() => readMaintenanceSettings());
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [rematchingAll, setRematchingAll] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<string | null>(null);
  const [externalCandidates, setExternalCandidates] = useState<ExternalSkillCandidateWire[]>([]);
  const [targetStates, setTargetStates] = useState<SkillTargetStateWire[]>([]);
  const [syncScanned, setSyncScanned] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncBusyKeys, setSyncBusyKeys] = useState<Set<string>>(() => new Set());
  const [syncSource, setSyncSource] = useState<ExternalSourceFilter>("all");
  const [selectedExternalKeys, setSelectedExternalKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const marketRequestId = useRef(0);
  const inspectionRequestId = useRef(0);
  const inspectionMediaRequests = useRef<Map<string, Promise<ResolvedInspectionMedia | null>>>(new Map());
  const inspectionMediaSelectionTouched = useRef(false);
  const panelMounted = useRef(true);
  const maintenanceRunActive = useRef(false);

  useEffect(() => {
    if (notice === null || !isBulkCompletionNotice(notice)) return;
    const timer = window.setTimeout(() => {
      setNotice((current) => current === notice ? null : current);
    }, BULK_NOTICE_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await remote.list({ schemaVersion: RPC_SCHEMA_VERSION });
      if (response.ok) {
        setSkills(sortSkills(response.data.skills));
        const persistedProvenance = new Map<string, ProvenanceDisplayStatus>();
        for (const skill of response.data.skills) {
          if (skill.source?.kind === "github") persistedProvenance.set(skill.name, "matched");
          else if (skill.provenanceCheck !== undefined) {
            persistedProvenance.set(skill.name, skill.provenanceCheck.status);
          }
        }
        setProvenanceStatuses(persistedProvenance);
        setProvenanceErrors(new Map());
        setUpdateChecks(new Map());
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [remote]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const loadTrash = useCallback(async () => {
    if (!remote.listTrash) return;
    setTrashLoading(true);
    try {
      const response = await remote.listTrash({ schemaVersion: RPC_SCHEMA_VERSION });
      if (response.ok) setTrashedSkills(response.data.trashed);
      else setError(response.error.message);
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setTrashLoading(false);
    }
  }, [remote]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  useEffect(() => () => {
    panelMounted.current = false;
  }, []);

  const visibleSkills = useMemo(() => {
    const candidates = view === "custom"
      ? skills.filter((skill) => skill.origin === "self" || skill.origin === "local-import")
      : skills;
    const normalized = localQuery.trim().toLocaleLowerCase();
    if (normalized.length === 0) return candidates;
    return candidates.filter((skill) =>
      skill.name.toLocaleLowerCase().includes(normalized)
      || skill.description.toLocaleLowerCase().includes(normalized)
    );
  }, [localQuery, skills, view]);

  useEffect(() => {
    const visible = new Set(visibleSkills.map((skill) => skill.name));
    setSelectedManagedNames((current) => new Set([...current].filter((name) => visible.has(name))));
  }, [visibleSkills]);

  const visibleExternalCandidates = useMemo(() => externalCandidates.filter((candidate) => (
    syncSource === "all" || candidate.target === syncSource
  )), [externalCandidates, syncSource]);
  const visibleMarketRepositories = useMemo(() => {
    if (marketCategory === "all") return marketRepositories;
    return marketRepositories.filter((repository) => repository.classification.primaryCategory === marketCategory);
  }, [marketCategory, marketRepositories]);
  const visibleCount = view === "market" ? visibleMarketRepositories.length : visibleSkills.length;

  async function verifySkillProvenance(skill: ManagedSkillWire): Promise<ProvenanceDisplayStatus> {
    if (!remote.verifyProvenance) return "unavailable";
    setProvenanceCheckingNames((current) => new Set(current).add(skill.name));
    setProvenanceStatuses((current) => withoutMapKey(current, skill.name));
    setProvenanceErrors((current) => withoutMapKey(current, skill.name));
    try {
      const response = await remote.verifyProvenance({ schemaVersion: RPC_SCHEMA_VERSION, name: skill.name });
      if (!response.ok) {
        setProvenanceStatuses((current) => new Map(current).set(skill.name, "unavailable"));
        setProvenanceErrors((current) => new Map(current).set(skill.name, response.error.message));
        return "unavailable";
      }
      const status = response.data.verification.status;
      setProvenanceStatuses((current) => new Map(current).set(skill.name, status));
      setSkills((current) => upsertSkill(current, response.data.verification.skill));
      return status;
    } catch (error) {
      if (panelMounted.current) {
        setProvenanceStatuses((current) => new Map(current).set(skill.name, "unavailable"));
        setProvenanceErrors((current) => new Map(current).set(skill.name, remoteErrorMessage(error)));
      }
      return "unavailable";
    } finally {
      if (panelMounted.current) setProvenanceCheckingNames((current) => withoutValue(current, skill.name));
    }
  }

  async function matchProvenanceCandidates(
    candidates: ManagedSkillWire[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ProvenanceMatchSummary> {
    const summary: ProvenanceMatchSummary = {
      matched: 0,
      custom: 0,
      ambiguous: 0,
      ineligible: 0,
      unavailable: 0,
      failures: []
    };
    if (candidates.length === 0) return summary;

    if (remote.verifyProvenanceBatch) {
      let completed = 0;
      for (const batch of chunk(candidates, 20)) {
        const names = batch.map((skill) => skill.name);
        setProvenanceCheckingNames((current) => new Set([...current, ...names]));
        setProvenanceErrors((current) => withoutMapKeys(current, names));
        try {
          const response = await remote.verifyProvenanceBatch({ schemaVersion: RPC_SCHEMA_VERSION, names });
          const batchFailures: ProvenanceBatchFailureWire[] = response.ok
            ? [...(response.data.failures ?? [])]
            : names.map((name) => ({ name, code: response.error.code, message: response.error.message }));
          const verifications = response.ok ? response.data.results : [];
          const accountedNames = new Set([
            ...verifications.map((verification) => verification.name),
            ...batchFailures.map((failure) => failure.name)
          ]);
          for (const name of names) {
            if (!accountedNames.has(name)) {
              batchFailures.push({
                name,
                code: "PROVENANCE_RESULT_MISSING",
                message: "Host 未返回该 Skill 的来源核验结果。"
              });
            }
          }
          setSkills((current) => verifications.reduce(
            (next, verification) => upsertSkill(next, verification.skill),
            current
          ));
          for (const verification of verifications) {
            incrementProvenanceSummary(summary, verification.status);
          }
          setProvenanceStatuses((current) => {
            let next = new Map(current);
            for (const verification of verifications) {
              next.set(verification.name, verification.status);
            }
            next = withStatuses(next, batchFailures.map((failure) => failure.name), "unavailable");
            return next;
          });
          setProvenanceErrors((current) => {
            const next = new Map(current);
            for (const failure of batchFailures) next.set(failure.name, failure.message);
            return next;
          });
          summary.unavailable += batchFailures.length;
          summary.failures.push(...batchFailures);
        } catch (error) {
          const message = remoteErrorMessage(error);
          const batchFailures = names.map((name) => ({
            name,
            code: "PROVENANCE_BATCH_UNAVAILABLE",
            message
          }));
          setProvenanceStatuses((current) => withStatuses(current, names, "unavailable"));
          setProvenanceErrors((current) => withMapValues(current, names, message));
          summary.unavailable += names.length;
          summary.failures.push(...batchFailures);
        } finally {
          completed += names.length;
          setProvenanceCheckingNames((current) => withoutValues(current, names));
          onProgress?.(completed, candidates.length);
        }
      }
      return summary;
    }

    let completed = 0;
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < candidates.length) {
        const skill = candidates[nextIndex++];
        if (skill === undefined) return;
        const status = await verifySkillProvenance(skill);
        if (status === "unavailable") {
          summary.unavailable += 1;
          summary.failures.push({
            name: skill.name,
            code: "PROVENANCE_CHECK_FAILED",
            message: "GitHub 来源核验暂时不可用"
          });
        } else {
          incrementProvenanceSummary(summary, status);
        }
        completed += 1;
        onProgress?.(completed, candidates.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, candidates.length) }, () => worker()));
    return summary;
  }

  async function rematchAllProvenance() {
    if (rematchingAll || maintenanceRunning) return;
    const candidates = skills.filter((skill) => skill.source?.kind !== "github");
    if (candidates.length === 0) {
      setMaintenanceStatus("没有需要重新匹配的本地 Skill");
      return;
    }
    setRematchingAll(true);
    setError(null);
    setMaintenanceStatus(`正在重新匹配 0 / ${candidates.length}`);
    try {
      const summary = await matchProvenanceCandidates(candidates, (completed, total) => {
        setMaintenanceStatus(`正在重新匹配 ${completed} / ${total}`);
      });
      setMaintenanceStatus(formatProvenanceSummary(summary));
      if (summary.failures.length > 0) {
        setError(`来源匹配部分失败：${summary.failures.map((failure) => `${failure.name}：${failure.message}`).join("；")}`);
      }
    } finally {
      setRematchingAll(false);
    }
  }

  function toggleMaintenanceSetting(key: MaintenanceKey, enabled: boolean) {
    setMaintenance((current) => {
      const next = { ...current, [key]: { ...current[key], enabled } };
      writeMaintenanceSettings(next);
      return next;
    });
  }

  async function runAutomatedMaintenance() {
    if (maintenanceRunActive.current) return;
    const startedAt = new Date().toISOString();
    const shouldCheck = maintenance.autoCheck.enabled && maintenanceDue(maintenance.autoCheck.lastRunAt);
    const shouldUpdate = maintenance.autoUpdate.enabled && maintenanceDue(maintenance.autoUpdate.lastRunAt);
    if (!shouldCheck && !shouldUpdate) return;
    maintenanceRunActive.current = true;
    setMaintenanceRunning(true);
    setMaintenanceStatus("自动维护正在后台运行");
    const next: MaintenanceSettings = structuredClone(maintenance);
    const failures: string[] = [];
    try {
      let freshChecks: SkillUpdateCheckWire[] = [];
      let freshCheckSucceeded = false;
      if (shouldCheck || shouldUpdate) {
        const response = await remote.checkUpdates({ schemaVersion: RPC_SCHEMA_VERSION });
        if (response.ok) {
          freshChecks = response.data.checks;
          freshCheckSucceeded = true;
          setUpdateChecks(new Map(freshChecks.map((check) => [check.name, check])));
          if (shouldCheck) next.autoCheck.lastRunAt = startedAt;
        } else {
          failures.push(response.error.message);
        }
      }

      if (shouldUpdate && freshCheckSucceeded) {
        for (const check of freshChecks.filter((item) => item.status === "update-available")) {
          try {
            const response = await remote.update({ schemaVersion: RPC_SCHEMA_VERSION, name: check.name });
            if (response.ok) {
              setSkills((current) => upsertSkill(current, response.data.skill));
              setUpdateChecks((current) => setUpdateStatus(current, check.name, "up-to-date"));
            } else failures.push(`${check.name}：${response.error.message}`);
          } catch (error) {
            failures.push(`${check.name}：${remoteErrorMessage(error)}`);
          }
        }
        next.autoUpdate.lastRunAt = startedAt;
      }
      writeMaintenanceSettings(next);
      setMaintenance(next);
      setMaintenanceStatus(failures.length === 0 ? "自动维护已完成" : `自动维护完成，${failures.length} 项失败`);
      if (failures.length > 0) setError(`自动维护部分失败：${failures.join("；")}`);
    } catch (error) {
      setMaintenanceStatus("自动维护失败，将在下次进入时重试");
      setError(remoteErrorMessage(error));
    } finally {
      maintenanceRunActive.current = false;
      setMaintenanceRunning(false);
    }
  }

  useEffect(() => {
    if (loading || skills.length === 0 || maintenanceRunActive.current) return;
    const due = (Object.keys(maintenance) as MaintenanceKey[])
      .some((key) => maintenance[key].enabled && maintenanceDue(maintenance[key].lastRunAt));
    if (due) void runAutomatedMaintenance();
  }, [loading, maintenance, skills]);

  function selectView(next: SkillView) {
    setView(next);
    setError(null);
    if (next === "market") {
      setCreating(false);
      if (!marketHostChecked) void initializeMarketplace();
      else if (marketCapabilities?.features.marketplaceV2 && marketRepositories.length === 0) {
        void browseRepositories(true);
      }
    }
  }

  async function initializeMarketplace() {
    setMarketLoading(true);
    setError(null);
    try {
      if (!remote.getCapabilities) throw new Error("Missing Marketplace V2 capabilities.");
      const response = await remote.getCapabilities({ schemaVersion: RPC_SCHEMA_VERSION });
      setMarketHostChecked(true);
      if (!response.ok || response.data.capabilities.protocolVersion < 5
        || !response.data.capabilities.features.marketplaceV2
        || !response.data.capabilities.features.repositoryInspection
        || !response.data.capabilities.features.githubTrending
        || !response.data.capabilities.features.skillClassification
        || !response.data.capabilities.features.updateRiskGate
        || !response.data.capabilities.features.repositoryBatchAnalysis
        || !response.data.capabilities.features.repositoryBatchInstall) {
        setMarketCapabilities(response.ok ? response.data.capabilities : null);
        setError("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
        return;
      }
      setMarketCapabilities(response.data.capabilities);
      await browseRepositories(true, "trend-monthly");
    } catch {
      setMarketHostChecked(true);
      setError("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
    } finally {
      setMarketLoading(false);
    }
  }

  async function browseRepositories(reset: boolean, forcedSort?: RepositorySortWire) {
    if (!remote.browseRepositories) {
      setError("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
      return;
    }
    if (marketLoading && marketHostChecked) return;
    const sort = forcedSort ?? marketSort;
    const page = reset ? 1 : marketPage + 1;
    const requestId = ++marketRequestId.current;
    setMarketLoading(true);
    setError(null);
    try {
      const response = await remote.browseRepositories({
        schemaVersion: RPC_SCHEMA_VERSION,
        sort,
        page,
        limit: 20
      });
      if (requestId !== marketRequestId.current) return;
      if (response.ok) {
        setMarketRepositories((current) => reset
          ? response.data.result.repositories
          : mergeRepositories(current, response.data.result.repositories));
        setMarketSort(sort);
        setMarketPage(page);
        setMarketSearched(false);
        setMarketActiveQuery(null);
        setMarketTotal(response.data.result.total);
        setMarketHasMore(response.data.result.hasMore);
        setMarketDataUpdatedAt(response.data.result.dataUpdatedAt);
        setMarketSourceState(response.data.result.sourceState);
        setMarketSourceMessage(response.data.result.sourceMessage);
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      if (requestId === marketRequestId.current) setError(remoteErrorMessage(error));
    } finally {
      if (requestId === marketRequestId.current) {
        setMarketLoading(false);
      }
    }
  }

  function changeMarketQuery(value: string) {
    setMarketQuery(value);
    if (value.trim().length === 0 && marketSearched) {
      setMarketRepositories([]);
      setMarketSearched(false);
      setMarketActiveQuery(null);
      setMarketCategory("all");
      setMarketTotal(0);
      setMarketHasMore(false);
      void browseRepositories(true, "trend-monthly");
    }
  }

  async function searchMarketplace(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = marketQuery.trim();
    if (query.length < 2) return;
    setMarketCategory("all");
    await searchRepositoryQuery(query, true, "relevance");
  }

  async function searchRepositoryQuery(
    query: string,
    reset: boolean,
    forcedSort?: RepositorySortWire
  ) {
    if (query.length < 2 || marketLoading) return;

    const requestId = ++marketRequestId.current;
    setMarketLoading(true);
    setError(null);
    try {
      if (!remote.searchRepositories) throw new Error("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
      const response = await remote.searchRepositories({
        schemaVersion: RPC_SCHEMA_VERSION,
        query,
        sort: forcedSort ?? marketSort,
        page: reset ? 1 : marketPage + 1,
        limit: 20
      });
      if (requestId !== marketRequestId.current) return;
      if (response.ok) {
        setMarketRepositories((current) => reset
          ? response.data.result.repositories
          : mergeRepositories(current, response.data.result.repositories));
        setMarketSort(response.data.result.sort);
        setMarketSearched(true);
        setMarketActiveQuery(query);
        setMarketPage(response.data.result.page);
        setMarketTotal(response.data.result.total);
        setMarketHasMore(response.data.result.hasMore);
        setMarketDataUpdatedAt(response.data.result.dataUpdatedAt);
        setMarketSourceState(response.data.result.sourceState);
        setMarketSourceMessage(response.data.result.sourceMessage);
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      if (requestId === marketRequestId.current) setError(remoteErrorMessage(error));
    } finally {
      if (requestId === marketRequestId.current) setMarketLoading(false);
    }
  }

  async function searchNextRepositories() {
    if (marketActiveQuery !== null) await searchRepositoryQuery(marketActiveQuery, false);
  }

  async function selectMarketCategory(category: MarketCategory) {
    setMarketCategory(category);
    setError(null);
    if (category === "all") {
      setMarketActiveQuery(null);
      await browseRepositories(true, marketSort);
      return;
    }
    if (isTrendingSort(marketSort)) {
      setMarketActiveQuery(null);
      setMarketSearched(false);
      return;
    }
    if (category === "general") {
      setMarketActiveQuery(null);
      setMarketSearched(false);
      return;
    }
    await searchRepositoryQuery(MARKET_CATEGORY_QUERIES[category], true, "relevance");
  }

  function openCreate() {
    setView("custom");
    setError(null);
    setCreating((value) => !value);
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    if (name.length === 0 || description.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await remote.create({
        schemaVersion: RPC_SCHEMA_VERSION,
        name,
        description
      });
      if (response.ok) {
        setSkills((current) => upsertSkill(current, response.data.skill));
        setCreating(false);
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function setEnabled(skill: ManagedSkillWire, enabled: boolean) {
    setBusyNames((current) => new Set(current).add(skill.name));
    setError(null);
    try {
      const response = await remote.setEnabled({
        schemaVersion: RPC_SCHEMA_VERSION,
        name: skill.name,
        enabled
      });
      if (response.ok) {
        setSkills((current) => upsertSkill(current, response.data.skill));
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setBusyNames((current) => {
        const next = new Set(current);
        next.delete(skill.name);
        return next;
      });
    }
  }

  async function enableAllManagedSkills() {
    const disabled = skills.filter((skill) => !skill.enabledTargets.includes("dsh"));
    if (disabled.length === 0 || bulkEnabling) return;
    setBulkEnabling(true);
    setNotice(null);
    setError(null);
    setBusyNames((current) => new Set([...current, ...disabled.map((skill) => skill.name)]));
    const failures: string[] = [];
    let enabledCount = 0;
    try {
      for (const skill of disabled) {
        try {
          const response = await remote.setEnabled({
            schemaVersion: RPC_SCHEMA_VERSION,
            name: skill.name,
            enabled: true
          });
          if (response.ok) {
            enabledCount += 1;
            setSkills((current) => upsertSkill(current, response.data.skill));
          } else {
            failures.push(`${skill.name}：${response.error.message}`);
          }
        } catch (error) {
          failures.push(`${skill.name}：${remoteErrorMessage(error)}`);
        }
      }
      setNotice(`批量开启完成：成功 ${enabledCount} 项，失败 ${failures.length} 项。`);
      if (failures.length > 0) setError(`部分开启失败：${failures.join("；")}`);
    } finally {
      const names = new Set(disabled.map((skill) => skill.name));
      setBusyNames((current) => new Set([...current].filter((name) => !names.has(name))));
      setBulkEnabling(false);
    }
  }

  function selectVisibleManagedSkills(selected: boolean) {
    setConfirmingBulkDelete(false);
    setSelectedManagedNames(new Set(selected ? visibleSkills.map((skill) => skill.name) : []));
  }

  async function runBulkManagedAction(action: "enable" | "disable" | "delete") {
    const selected = visibleSkills.filter((skill) => selectedManagedNames.has(skill.name));
    if (selected.length === 0 || bulkManagedAction !== null) return;
    if (action === "delete" && !confirmingBulkDelete) {
      setConfirmingBulkDelete(true);
      return;
    }
    if (action === "delete" && !remote.delete) {
      setError("当前 Host 不支持删除 Skill，请重启 DSH Desktop。");
      return;
    }
    setBulkManagedAction(action);
    setConfirmingBulkDelete(false);
    setBusyNames((current) => new Set([...current, ...selected.map((skill) => skill.name)]));
    const failures: string[] = [];
    let success = 0;
    try {
      for (const skill of selected) {
        try {
          if (action === "delete") {
            const response = await remote.delete!({ schemaVersion: RPC_SCHEMA_VERSION, name: skill.name });
            if (!response.ok) { failures.push(`${skill.name}：${response.error.message}`); continue; }
            success += 1;
            setSkills((current) => current.filter((candidate) => candidate.name !== skill.name));
            setProvenanceStatuses((current) => withoutMapKey(current, skill.name));
            setUpdateChecks((current) => withoutMapKey(current, skill.name));
            continue;
          }
          const response = await remote.setEnabled({
            schemaVersion: RPC_SCHEMA_VERSION,
            name: skill.name,
            enabled: action === "enable"
          });
          if (!response.ok) { failures.push(`${skill.name}：${response.error.message}`); continue; }
          success += 1;
          setSkills((current) => upsertSkill(current, response.data.skill));
        } catch (error) {
          failures.push(`${skill.name}：${remoteErrorMessage(error)}`);
        }
      }
      setSelectedManagedNames(new Set());
      setNotice(`批量${action === "enable" ? "开启" : action === "disable" ? "关闭" : "删除"}完成：成功 ${success} 项，失败 ${failures.length} 项。`);
      if (failures.length > 0) setError(`部分操作失败：${failures.join("；")}`);
      if (action === "delete" && success > 0) await loadTrash();
    } finally {
      const names = new Set(selected.map((skill) => skill.name));
      setBusyNames((current) => new Set([...current].filter((name) => !names.has(name))));
      setBulkManagedAction(null);
    }
  }

  function openRepository(repository: RepositoryCandidateWire) {
    const requestId = ++inspectionRequestId.current;
    flushSync(() => {
      setInspectionRepository(repository);
      setInspectionLoading(false);
      setInspectionError(null);
      setInspection(null);
      setInspectionAvatarUrl(null);
      setInspectionMedia([]);
      setSelectedInspectionMediaId(null);
      setRiskAssessments(new Map());
      setInstallResults(new Map());
      setConfirmHighRiskInstall(false);
    });
    inspectionMediaRequests.current.clear();
    inspectionMediaSelectionTouched.current = false;
    void loadCandidateMedia(repository, requestId);
    void inspectRepositoryContent(repository, requestId);
  }

  async function inspectOpenRepository() {
    const repository = inspectionRepository;
    if (repository === null || inspectionLoading) return;
    const requestId = ++inspectionRequestId.current;
    await inspectRepositoryContent(repository, requestId);
  }

  async function inspectRepositoryContent(repository: RepositoryCandidateWire, requestId: number) {
    setInspectionLoading(true);
    setInspectionError(null);
    try {
      if (!remote.inspectRepository) throw new Error("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
      const response = await remote.inspectRepository({
        schemaVersion: RPC_SCHEMA_VERSION,
        repository: { owner: repository.owner, name: repository.name }
      });
      if (requestId !== inspectionRequestId.current) return;
      if (response.ok) {
        const installedPaths = installedRepositorySkillPaths(skills, repository);
        setInspection(response.data.inspection);
        setSelectedSkillPaths(new Set(response.data.inspection.skills
          .filter((skill) => skill.installable && !installedPaths.has(skill.path))
          .map((skill) => skill.path)));
        setRiskAssessments(new Map(response.data.assessments.map((item) => [item.skillPath, item.assessment])));
        void loadInspectionMedia(response.data.inspection, requestId);
      } else {
        setInspectionError(response.error.message);
      }
    } catch (error) {
      if (requestId === inspectionRequestId.current) setInspectionError(remoteErrorMessage(error));
    } finally {
      if (requestId === inspectionRequestId.current) setInspectionLoading(false);
    }
  }

  function closeRepositoryDialog() {
    inspectionRequestId.current += 1;
    setInspectionRepository(null);
    setInspection(null);
    setInspectionError(null);
    setInspectionLoading(false);
    setInspectionAvatarUrl(null);
    setInspectionMedia([]);
    setSelectedInspectionMediaId(null);
    inspectionMediaRequests.current.clear();
    inspectionMediaSelectionTouched.current = false;
    setSelectedSkillPaths(new Set());
    setRiskAssessments(new Map());
    setInstallResults(new Map());
    setConfirmHighRiskInstall(false);
  }

  async function assessInspectionRisks(target: RepositoryInspectionWire) {
    const assessor = remote.assessSkillRisk;
    if (!assessor) return;
    await Promise.all(target.skills.filter((skill) => skill.installable).map(async (skill) => {
      try {
        const response = await assessor({
          schemaVersion: RPC_SCHEMA_VERSION,
          repository: { owner: target.repository.owner, name: target.repository.name },
          skillPath: skill.path
        });
        const assessment = response.ok ? response.data.assessment : {
          risk: "unknown" as const,
          findings: [],
          scannerVersion: "unavailable"
        };
        setRiskAssessments((current) => new Map(current).set(skill.path, assessment));
      } catch {
        setRiskAssessments((current) => new Map(current).set(skill.path, {
          risk: "unknown",
          findings: [],
          scannerVersion: "unavailable"
        }));
      }
    }));
  }

  function resolveInspectionMedia(source: MediaSourceWire): Promise<ResolvedInspectionMedia | null> {
    const resolver = remote.resolveMedia;
    if (!resolver || !marketCapabilities?.features.mediaProxy) return Promise.resolve(null);
    const id = mediaSourceId(source);
    const existing = inspectionMediaRequests.current.get(id);
    if (existing) return existing;
    const request = (async () => {
      try {
        const response = await resolver({ schemaVersion: RPC_SCHEMA_VERSION, source });
        return response.ok ? { id, asset: response.data.asset } : null;
      } catch { return null; }
    })();
    inspectionMediaRequests.current.set(id, request);
    return request;
  }

  async function loadInspectionMedia(target: RepositoryInspectionWire, requestId: number) {
    const sources = uniqueMediaSources(target.media)
      .filter((source) => source.type === "repo-blob" || source.type === "github-social-preview")
      .slice(0, MAX_INSPECTION_MEDIA);
    const resolved = (await mapConcurrent(sources, INSPECTION_MEDIA_CONCURRENCY, resolveInspectionMedia))
      .filter((media): media is ResolvedInspectionMedia => media !== null);
    if (requestId !== inspectionRequestId.current) return;
    setInspectionMedia((current) => mergeInspectionMedia(resolved, current));
    const preferred = resolved.find((media) => media.asset.source.type === "repo-blob") ?? resolved[0];
    if (preferred && !inspectionMediaSelectionTouched.current) {
      setSelectedInspectionMediaId(preferred.id);
    }
  }

  async function loadCandidateMedia(repository: RepositoryCandidateWire, requestId: number) {
    if (!remote.resolveMedia || !marketCapabilities?.features.mediaProxy) return;
    const [avatar, cover] = await Promise.all([
      resolveInspectionMedia(repository.ownerAvatar),
      resolveInspectionMedia({ type: "github-social-preview", repo: repository.repoKey })
    ]);
    if (requestId !== inspectionRequestId.current) return;
    if (avatar !== null) setInspectionAvatarUrl(avatar.asset.dataUrl);
    if (cover !== null) {
      setInspectionMedia((current) => mergeInspectionMedia([cover], current));
      setSelectedInspectionMediaId((current) => current ?? cover.id);
    }
  }

  function selectInspectionMedia(id: string) {
    inspectionMediaSelectionTouched.current = true;
    setSelectedInspectionMediaId(id);
  }

  function removeInspectionMedia(id: string) {
    setInspectionMedia((current) => current.filter((media) => media.id !== id));
    setSelectedInspectionMediaId((selected) => selected === id
      ? inspectionMedia.find((media) => media.id !== id)?.id ?? null
      : selected);
  }

  function toggleSelectedSkill(path: string, selected: boolean) {
    setConfirmHighRiskInstall(false);
    setSelectedSkillPaths((current) => {
      const next = new Set(current);
      if (selected) next.add(path); else next.delete(path);
      return next;
    });
  }

  async function installSelectedSkills() {
    if (inspection === null) return;
    if (!remote.installRepository) {
      setInspectionError("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
      return;
    }
    const selected = inspection.skills.filter((skill) => selectedSkillPaths.has(skill.path));
    if (selected.length === 0) return;
    const risksReady = selected.every((skill) => {
      const assessment = riskAssessments.get(skill.path);
      return assessment !== undefined && assessment.risk !== "unknown";
    });
    if (!risksReady) {
      setInspectionError("所选 Skill 的内容风险检查尚未完成；请等待检查完成或重试仓库详情。");
      return;
    }
    const hasHighRisk = selected.some((skill) => riskAssessments.get(skill.path)?.risk === "high");
    if (hasHighRisk && !confirmHighRiskInstall) {
      setConfirmHighRiskInstall(true);
      return;
    }
    const acknowledgeHighRisk = hasHighRisk && confirmHighRiskInstall;
    setConfirmHighRiskInstall(false);
    setInspectionError(null);
    setInstallingSkillPaths(new Set(selected.map((skill) => skill.path)));
    const failures: string[] = [];
    try {
      const response = await remote.installRepository({
        schemaVersion: RPC_SCHEMA_VERSION,
        repository: { owner: inspection.repository.owner, name: inspection.repository.name },
        selection: { mode: "paths", paths: selected.map((skill) => skill.path) },
        ...(acknowledgeHighRisk ? { acknowledgeHighRiskPaths: selected.filter((skill) => riskAssessments.get(skill.path)?.risk === "high").map((skill) => skill.path) } : {})
      });
      if (!response.ok) {
        setInspectionError(response.error.message);
        return;
      }
      for (const result of response.data.results) {
        if (result.status === "installed" && result.skill !== undefined) {
          setSkills((current) => upsertSkill(current, result.skill!));
          setSelectedSkillPaths((current) => withoutValue(current, result.skillPath));
          setInstallResults((current) => new Map(current).set(result.skillPath, { ok: true, message: "安装成功" }));
        } else if (result.status !== "already-installed") {
          const message = result.error?.message ?? (result.status === "needs-confirmation" ? "需要确认高风险内容" : "安装失败");
          failures.push(`${result.skillPath}：${message}`);
          setInstallResults((current) => new Map(current).set(result.skillPath, { ok: false, message }));
        }
      }
    } catch (error) {
      failures.push(remoteErrorMessage(error));
    } finally {
      setInstallingSkillPaths(new Set());
    }
    if (failures.length > 0) setInspectionError(`部分安装失败：${failures.join("；")}`);
  }

  async function installRepositoryAll(repository: RepositoryCandidateWire) {
    if (!remote.installRepository) {
      setError("Skill Manager Host 版本较旧，请重启 DSH Desktop。");
      return;
    }
    setError(null);
    setNotice(`正在后台安装 ${repository.fullName} 中可安装的 Skill...`);
    try {
      const response = await remote.installRepository({
        schemaVersion: RPC_SCHEMA_VERSION,
        repository: { owner: repository.owner, name: repository.name },
        selection: { mode: "all" }
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      const installed = response.data.results.filter((item) => item.status === "installed" && item.skill !== undefined);
      const highRisk = response.data.results.filter((item) => item.status === "needs-confirmation");
      for (const result of installed) setSkills((current) => upsertSkill(current, result.skill!));
      setNotice(`${repository.fullName}：已安装 ${installed.length} 个 Skill${highRisk.length > 0 ? `；${highRisk.length} 个高风险项等待确认` : ""}。`);
      if (highRisk.length > 0) openRepository(repository);
    } catch (error) {
      setError(remoteErrorMessage(error));
    }
  }

  async function checkSkillUpdate(skill: ManagedSkillWire) {
    setCheckingUpdateNames((current) => new Set(current).add(skill.name));
    setError(null);
    try {
      const response = await remote.checkUpdates({ schemaVersion: RPC_SCHEMA_VERSION, names: [skill.name] });
      if (response.ok) {
        setUpdateChecks((current) => {
          const next = new Map(current);
          for (const check of response.data.checks) next.set(check.name, check);
          return next;
        });
      } else {
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setCheckingUpdateNames((current) => withoutValue(current, skill.name));
    }
  }

  async function syncAllConfiguredTargets() {
    if (!remote.listTargetStates || !remote.setTargetEnabled) {
      setError("当前 Host 不支持 Skill 同步");
      return;
    }
    setSyncLoading(true);
    setError(null);
    setNotice(null);
    const failures: string[] = [];
    let linked = 0;
    try {
      const response = await remote.listTargetStates({ schemaVersion: RPC_SCHEMA_VERSION });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setTargetStates(response.data.states);
      for (const state of response.data.states.filter((candidate) => candidate.status === "not-linked")) {
        const key = `target:${state.target}:${state.name}`;
        setSyncBusyKeys((current) => new Set(current).add(key));
        try {
          const enabled = await remote.setTargetEnabled({
            schemaVersion: RPC_SCHEMA_VERSION,
            name: state.name,
            target: state.target,
            enabled: true
          });
          if (enabled.ok) {
            linked += 1;
            setSkills((current) => upsertSkill(current, enabled.data.skill));
            setTargetStates((current) => current.map((candidate) => (
              candidate.name === state.name && candidate.target === state.target
                ? { ...candidate, status: "linked" }
                : candidate
            )));
          } else failures.push(`${state.name} → ${targetLabel(state.target)}：${enabled.error.message}`);
        } catch (error) {
          failures.push(`${state.name} → ${targetLabel(state.target)}：${remoteErrorMessage(error)}`);
        } finally {
          setSyncBusyKeys((current) => withoutValue(current, key));
        }
      }
      const conflicts = response.data.states.filter((state) => state.status === "conflict").length;
      setNotice(`同步完成：新增 ${linked} 个链接，跳过 ${conflicts} 个冲突。`);
      if (failures.length > 0) setError(`部分同步失败：${failures.join("；")}`);
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setSyncLoading(false);
    }
  }

  async function deleteSkill(skill: ManagedSkillWire) {
    if (confirmingDeleteName !== skill.name) {
      setConfirmingDeleteName(skill.name);
      return;
    }
    if (!remote.delete) {
      setError("当前 Host 不支持删除 Skill，请重启 DSH Desktop。");
      return;
    }
    setDeletingNames((current) => new Set(current).add(skill.name));
    setError(null);
    setNotice(null);
    try {
      const response = await remote.delete({ schemaVersion: RPC_SCHEMA_VERSION, name: skill.name });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setSkills((current) => current.filter((candidate) => candidate.name !== skill.name));
      setProvenanceStatuses((current) => withoutMapKey(current, skill.name));
      setUpdateChecks((current) => withoutMapKey(current, skill.name));
      setExpandedBackupNames((current) => withoutValue(current, skill.name));
      setNotice(`已删除 ${skill.name}，完整内容已移入可恢复归档。`);
      await loadTrash();
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setConfirmingDeleteName(null);
      setDeletingNames((current) => withoutValue(current, skill.name));
    }
  }

  async function restoreTrashedSkill(trashed: TrashedSkillWire) {
    if (!remote.restoreTrash) {
      setError("当前 Host 不支持恢复 Skill，请重启 DSH Desktop。");
      return;
    }
    setRestoringTrashIds((current) => new Set(current).add(trashed.trashId));
    setError(null);
    try {
      const response = await remote.restoreTrash({
        schemaVersion: RPC_SCHEMA_VERSION,
        name: trashed.name,
        trashId: trashed.trashId
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setSkills((current) => upsertSkill(current, response.data.skill));
      setTrashedSkills((current) => current.filter((item) => item.trashId !== trashed.trashId));
      setNotice(`已恢复 ${trashed.name}，并恢复原先启用的工具链接。`);
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setRestoringTrashIds((current) => withoutValue(current, trashed.trashId));
    }
  }

  async function updateSkill(skill: ManagedSkillWire, acknowledgeHighRisk = false) {
    setUpdatingNames((current) => new Set(current).add(skill.name));
    setError(null);
    try {
      const response = await remote.update({
        schemaVersion: RPC_SCHEMA_VERSION,
        name: skill.name,
        ...(acknowledgeHighRisk ? { acknowledgeHighRisk: true } : {})
      });
      if (response.ok) {
        setSkills((current) => upsertSkill(current, response.data.skill));
        setUpdateChecks((current) => {
          const next = new Map(current);
          const previous = next.get(skill.name);
          if (previous) {
            next.set(skill.name, {
              ...previous,
              status: "up-to-date",
              installed: previous.latest,
              latest: previous.latest
            });
          }
          return next;
        });
        setBackupsByName((current) => prependBackup(current, response.data.backup));
        setConfirmingRiskUpdateName(null);
      } else {
        if (response.error.code === "SKILL_LOCAL_MODIFIED") {
          setUpdateChecks((current) => setUpdateStatus(current, skill.name, "local-modified"));
        }
        if (response.error.code === "SKILL_UPDATE_RISK_CONFIRMATION_REQUIRED") {
          setConfirmingRiskUpdateName(skill.name);
        }
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setUpdatingNames((current) => withoutValue(current, skill.name));
    }
  }

  async function loadBackups(name: string): Promise<boolean> {
    setLoadingBackupNames((current) => new Set(current).add(name));
    setError(null);
    try {
      const response = await remote.listBackups({
        schemaVersion: RPC_SCHEMA_VERSION,
        name
      });
      if (response.ok) {
        setBackupsByName((current) => new Map(current).set(name, response.data.backups));
        return true;
      }
      setError(response.error.message);
      return false;
    } catch (error) {
      setError(remoteErrorMessage(error));
      return false;
    } finally {
      setLoadingBackupNames((current) => withoutValue(current, name));
    }
  }

  async function toggleBackups(name: string) {
    if (expandedBackupNames.has(name)) {
      setExpandedBackupNames((current) => withoutValue(current, name));
      setConfirmingBackupId(null);
      return;
    }
    setExpandedBackupNames((current) => new Set(current).add(name));
    if (!(await loadBackups(name))) {
      setExpandedBackupNames((current) => withoutValue(current, name));
    }
  }

  async function rollbackSkill(skill: ManagedSkillWire, backup: SkillBackupWire) {
    if (confirmingBackupId !== backup.id) {
      setConfirmingBackupId(backup.id);
      return;
    }

    setRollingBackIds((current) => new Set(current).add(backup.id));
    setError(null);
    try {
      const response = await remote.rollback({
        schemaVersion: RPC_SCHEMA_VERSION,
        name: skill.name,
        backupId: backup.id
      });
      if (response.ok) {
        setSkills((current) => upsertSkill(current, response.data.skill));
        setUpdateChecks((current) => {
          const next = new Map(current);
          next.delete(skill.name);
          return next;
        });
        await loadBackups(skill.name);
      } else {
        if (response.error.code === "SKILL_LOCAL_MODIFIED") {
          setUpdateChecks((current) => setUpdateStatus(current, skill.name, "local-modified"));
        }
        setError(response.error.message);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setConfirmingBackupId(null);
      setRollingBackIds((current) => withoutValue(current, backup.id));
    }
  }

  async function scanExternalSkills() {
    if (!remote.discoverExternal || !remote.listTargetStates) {
      setError("当前 Host 不支持 Skill 同步");
      return;
    }
    setSyncLoading(true);
    setError(null);
    try {
      const [discovery, states] = await Promise.all([
        remote.discoverExternal({ schemaVersion: RPC_SCHEMA_VERSION }),
        remote.listTargetStates({ schemaVersion: RPC_SCHEMA_VERSION })
      ]);
      if (!discovery.ok) setError(discovery.error.message);
      else if (!states.ok) setError(states.error.message);
      else {
        setExternalCandidates(discovery.data.candidates);
        setSelectedExternalKeys(new Set(discovery.data.candidates
          .filter((candidate) => !skills.some((skill) => skill.name === candidate.name))
          .map(externalCandidateKey)));
        setTargetStates(states.data.states);
        setSyncScanned(true);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setSyncLoading(false);
    }
  }

  async function importExternal(candidate: ExternalSkillCandidateWire) {
    if (!remote.importExternal) return;
    const key = `import:${candidate.target}:${candidate.name}`;
    setSyncBusyKeys((current) => new Set(current).add(key));
    setError(null);
    try {
      const response = await remote.importExternal({ schemaVersion: RPC_SCHEMA_VERSION, target: candidate.target, name: candidate.name });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setSkills((current) => upsertSkill(current, response.data.skill));
      setSelectedExternalKeys((current) => withoutValue(current, externalCandidateKey(candidate)));
      if (remote.listTargetStates) {
        const states = await remote.listTargetStates({ schemaVersion: RPC_SCHEMA_VERSION, names: [response.data.skill.name] });
        if (!states.ok) setError(states.error.message);
        else setTargetStates((current) => [
          ...current.filter((state) => state.name !== response.data.skill.name),
          ...states.data.states
        ]);
      }
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setSyncBusyKeys((current) => withoutValue(current, key));
    }
  }

  function toggleExternalSelection(candidate: ExternalSkillCandidateWire, selected: boolean) {
    const key = externalCandidateKey(candidate);
    setSelectedExternalKeys((current) => {
      const next = new Set(current);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function selectVisibleExternal(selected: boolean) {
    setSelectedExternalKeys((current) => {
      const next = new Set(current);
      for (const candidate of visibleExternalCandidates) {
        const installed = skills.some((skill) => skill.name === candidate.name);
        if (selected && !installed) next.add(externalCandidateKey(candidate));
        else next.delete(externalCandidateKey(candidate));
      }
      return next;
    });
  }

  async function importSelectedExternal() {
    if (!remote.importExternal) return;
    const candidates = uniqueCandidatesByName(visibleExternalCandidates.filter((candidate) => (
      selectedExternalKeys.has(externalCandidateKey(candidate))
      && !skills.some((skill) => skill.name === candidate.name)
    )));
    if (candidates.length === 0) return;
    await importExternalBatch(candidates);
  }

  async function importAllVisibleExternal() {
    const candidates = uniqueCandidatesByName(visibleExternalCandidates.filter((candidate) => (
      !skills.some((skill) => skill.name === candidate.name)
    )));
    if (candidates.length === 0) return;
    await importExternalBatch(candidates);
  }

  async function importExternalBatch(candidates: ExternalSkillCandidateWire[]) {
    if (!remote.importExternal) return;
    setSyncLoading(true);
    setError(null);
    const imported: ManagedSkillWire[] = [];
    const failures: string[] = [];
    for (const candidate of candidates) {
      const key = `import:${externalCandidateKey(candidate)}`;
      setSyncBusyKeys((current) => new Set(current).add(key));
      try {
        const response = await remote.importExternal({
          schemaVersion: RPC_SCHEMA_VERSION,
          target: candidate.target,
          name: candidate.name
        });
        if (response.ok) {
          imported.push(response.data.skill);
          setSkills((current) => upsertSkill(current, response.data.skill));
          setSelectedExternalKeys((current) => withoutValue(current, externalCandidateKey(candidate)));
        } else failures.push(`${candidate.name}：${response.error.message}`);
      } catch (error) {
        failures.push(`${candidate.name}：${remoteErrorMessage(error)}`);
      } finally {
        setSyncBusyKeys((current) => withoutValue(current, key));
      }
    }
    if (imported.length > 0 && remote.listTargetStates) {
      const states = await remote.listTargetStates({
        schemaVersion: RPC_SCHEMA_VERSION,
        names: imported.map((skill) => skill.name)
      });
      if (states.ok) setTargetStates((current) => [
        ...current.filter((state) => !imported.some((skill) => skill.name === state.name)),
        ...states.data.states
      ]);
      else failures.push(`同步状态：${states.error.message}`);
    }
    if (failures.length > 0) setError(`部分导入失败：${failures.join("；")}`);
    setSyncLoading(false);
  }

  async function setExternalEnabled(skill: ManagedSkillWire, state: SkillTargetStateWire, enabled: boolean) {
    if (!remote.setTargetEnabled) return;
    const key = `target:${state.target}:${skill.name}`;
    setSyncBusyKeys((current) => new Set(current).add(key));
    setError(null);
    try {
      const response = await remote.setTargetEnabled({ schemaVersion: RPC_SCHEMA_VERSION, name: skill.name, target: state.target, enabled });
      if (response.ok) {
        setSkills((current) => upsertSkill(current, response.data.skill));
        setTargetStates((current) => current.map((candidate) =>
          candidate.name === state.name && candidate.target === state.target
            ? { ...candidate, status: enabled ? "linked" : "not-linked" }
            : candidate));
      } else setError(response.error.message);
    } catch (error) {
      setError(remoteErrorMessage(error));
    } finally {
      setSyncBusyKeys((current) => withoutValue(current, key));
    }
  }

  return (
    <section className="dsm-panel" aria-labelledby="dsm-title">
      <div className="dsm-primary-tabs" role="tablist" aria-label="Skill 功能">
        <button type="button" role="tab" aria-selected={view !== "market"} onClick={() => selectView("all")}>Skill 管理</button>
        <button type="button" role="tab" aria-selected={view === "market"} onClick={() => selectView("market")}>Skill 市场</button>
      </div>
      <header className="dsm-header">
        <div className="dsm-title-row">
          <h2 id="dsm-title">{view === "market" ? marketplaceTitle(marketSearched, marketSort) : "Skill 管理"}</h2>
          <span className="dsm-count" aria-label={`${visibleCount} 个 Skill`}>
            {visibleCount}
          </span>
        </div>
        <div className="dsm-toolbar">
          {view === "sync" ? (
            <button className="dsm-update-check" type="button" aria-label="扫描本机 Skill" disabled={syncLoading} onClick={() => void scanExternalSkills()}>
              {syncLoading ? "扫描中" : "扫描本机 Skill"}
            </button>
          ) : view === "market" ? (
            <form className="dsm-market-search" onSubmit={(event) => void searchMarketplace(event)}>
              <label className="dsm-search">
                <span className="dsm-sr-only">搜索 GitHub Skill 仓库</span>
                <input
                  type="search"
                  value={marketQuery}
                  onChange={(event) => changeMarketQuery(event.currentTarget.value)}
                  placeholder="搜索 GitHub Skill 仓库"
                />
              </label>
              <button
                className="dsm-icon-button"
                type="submit"
                aria-label="搜索市场"
                title="搜索市场"
                disabled={marketLoading || marketQuery.trim().length < 2}
              >
                <IconSearchOutline16 aria-hidden="true" />
              </button>
            </form>
          ) : (
            <>
              <label className="dsm-search">
                <IconSearchOutline16 aria-hidden="true" />
                <span className="dsm-sr-only">搜索 Skill</span>
                <input
                  type="search"
                  value={localQuery}
                  onChange={(event) => setLocalQuery(event.currentTarget.value)}
                  placeholder="搜索本机 Skill"
                />
              </label>
              <button
                className="dsm-update-check"
                type="button"
                aria-label="同步到其他工具"
                title="为 Codex、Claude Code、Agents 和 OpenCode 创建由 Skill Manager 管理的单 Skill 链接；不会复制 AGENTS.md 或 CLAUDE.md"
                disabled={syncLoading || loading || skills.length === 0}
                onClick={() => void syncAllConfiguredTargets()}
              >
                {syncLoading ? "同步中" : "同步到其他工具"}
              </button>
            </>
          )}
          <button
            className="dsm-icon-button"
            type="button"
            aria-label={view === "market" ? "刷新市场结果" : view === "sync" ? "重新扫描本机 Skill" : "刷新 Skill"}
            title={view === "market" ? "刷新市场结果" : view === "sync" ? "重新扫描本机 Skill" : "刷新 Skill"}
            disabled={view === "market"
              ? marketLoading || (marketSearched && marketActiveQuery === null)
              : view === "sync" ? syncLoading
              : loading}
            onClick={() => view === "market"
              ? marketActiveQuery !== null
                ? void searchRepositoryQuery(marketActiveQuery, true)
                : void browseRepositories(true)
              : view === "sync" ? void scanExternalSkills()
              : void loadSkills()}
          >
            <IconRefreshOutline16 aria-hidden="true" />
          </button>
          <button
            className="dsm-icon-button dsm-icon-button-primary"
            type="button"
            aria-label="新建 Skill"
            title="新建 Skill"
            aria-expanded={creating}
            onClick={openCreate}
          >
            <IconPlusOutline16 aria-hidden="true" />
          </button>
        </div>
      </header>

      {view !== "market" ? <div className="dsm-tabs" role="tablist" aria-label="本机 Skill 分类">
        {LOCAL_SKILL_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => selectView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div> : null}

      {(view === "all" || view === "custom") ? (
        <div className="dsm-local-tools">
          <section className="dsm-maintenance" aria-labelledby="dsm-maintenance-title">
            <div className="dsm-utility-heading">
              <div>
                <h3 id="dsm-maintenance-title">自动维护</h3>
                <p>{maintenanceRunning ? "后台运行中；每项最多 24 小时一次" : maintenanceStatus ?? "默认关闭，勾选后进入本机管理时后台运行"}</p>
              </div>
              <div className="dsm-utility-actions">
                <button
                  className="dsm-row-button"
                  type="button"
                  aria-label="一键开启全部 Skill"
                  disabled={loading || bulkEnabling || skills.every((skill) => skill.enabledTargets.includes("dsh"))}
                  onClick={() => void enableAllManagedSkills()}
                >
                  {bulkEnabling ? "开启中" : "一键开启全部"}
                </button>
              </div>
            </div>
            <div className="dsm-maintenance-options">
              {MAINTENANCE_OPTIONS.map((option) => (
                <label key={option.key}>
                  <input
                    type="checkbox"
                    checked={maintenance[option.key].enabled}
                    onChange={(event) => toggleMaintenanceSetting(option.key, event.currentTarget.checked)}
                  />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>
              ))}
            </div>
          </section>
          <section className="dsm-trash" aria-labelledby="dsm-trash-title">
            <button
              className="dsm-trash-toggle"
              type="button"
              aria-expanded={trashExpanded}
              onClick={() => setTrashExpanded((current) => !current)}
            >
              <span><strong id="dsm-trash-title">最近删除</strong><small>完整归档保留 30 天，到期后自动清理</small></span>
              <span>{trashLoading ? "加载中" : `${trashedSkills.length} 项`}</span>
            </button>
            {trashExpanded ? (
              trashedSkills.length === 0 ? <p className="dsm-trash-empty">最近 30 天没有可恢复的 Skill。</p> : (
                <ul>
                  {trashedSkills.map((trashed) => {
                    const restoring = restoringTrashIds.has(trashed.trashId);
                    return <li key={trashed.trashId}>
                      <div><strong>{trashed.name}</strong><small>{trashed.description}</small><time>到期 {formatTrashExpiry(trashed.expiresAt)}</time></div>
                      <button type="button" disabled={restoring} onClick={() => void restoreTrashedSkill(trashed)}>{restoring ? "恢复中" : "恢复"}</button>
                    </li>;
                  })}
                </ul>
              )
            ) : null}
          </section>
        </div>
      ) : null}

      {view === "market" && marketCapabilities?.features.marketplaceV2 ? (
        <div className="dsm-market-controls">
          <div className="dsm-market-source-bar">
            <div className="dsm-source-filters" role="group" aria-label="市场排序">
              {MARKET_SORT_OPTIONS.map((sort) => (
                <button
                  key={sort.id}
                  type="button"
                  aria-pressed={marketSort === sort.id}
                  onClick={() => {
                    setMarketSort(sort.id);
                    if (isTrendingSort(sort.id)) {
                      setMarketQuery("");
                      setMarketActiveQuery(null);
                      setMarketSearched(false);
                      setMarketCategory("all");
                      void browseRepositories(true, sort.id);
                    } else if (marketActiveQuery !== null) {
                      void searchRepositoryQuery(marketActiveQuery, true, sort.id);
                    } else {
                      void browseRepositories(true, sort.id);
                    }
                  }}
                >
                  {sort.label}
                </button>
              ))}
            </div>
            <p className="dsm-source-warning">GitHub 元数据候选 · 列表阶段不读取 README 或 Tree</p>
          </div>
          <div className="dsm-market-category-bar">
            <div className="dsm-source-filters" role="group" aria-label="GitHub Skill 分类">
              {MARKET_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={marketCategory === category.id}
                  disabled={marketLoading}
                  onClick={() => void selectMarketCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <p className="dsm-source-warning">选择分类会重新搜索 GitHub 候选，安装前仍会验证 SKILL.md</p>
          </div>
        </div>
      ) : null}

      {creating ? (
        <form className="dsm-create" onSubmit={(event) => void createSkill(event)}>
          <div className="dsm-field-grid">
            <label>
              <span>Skill 名称</span>
              <input
                name="name"
                autoComplete="off"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="example-skill"
                required
              />
            </label>
            <label>
              <span>简要说明</span>
              <input
                name="description"
                autoComplete="off"
                placeholder="一句话说明用途"
                required
              />
            </label>
          </div>
          <div className="dsm-create-actions">
            <button
              className="dsm-icon-button"
              type="button"
              aria-label="取消新建"
              title="取消"
              onClick={() => setCreating(false)}
            >
              <IconCloseOutline16 aria-hidden="true" />
            </button>
            <button className="dsm-command-button" type="submit" disabled={submitting}>
              {submitting ? "创建中" : "创建"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="dsm-status" aria-live="polite">
        {notice ? (
          <div className="dsm-notice" role="status">
            <span>{notice}</span>
            <button
              className="dsm-notice-dismiss"
              type="button"
              aria-label="关闭提示"
              title="关闭"
              onClick={() => setNotice(null)}
            >
              <IconCloseOutline16 aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {error ? <p className="dsm-error">{error}</p> : null}
      </div>

      {view === "sync" ? (
        <div className="dsm-sync">
          {!syncScanned ? (
            <p className="dsm-empty">扫描后可选择导入或同步，不会读取 Skill 正文或相邻 Agent 文件。</p>
          ) : (
            <>
              <section aria-labelledby="dsm-external-title">
                <div className="dsm-sync-section-header">
                  <div><h3 id="dsm-external-title">从其他工具导入</h3><p>扫描来源仅表示发现位置；没有可靠上游证据的 Skill 导入后归入“自设”。</p></div>
                  <div className="dsm-bulk-actions">
                    <button type="button" disabled={syncLoading || importableCandidateCount(visibleExternalCandidates, skills) === 0} onClick={() => void importAllVisibleExternal()}>一键导入当前来源全部</button>
                    <button type="button" onClick={() => selectVisibleExternal(true)}>全选当前来源</button>
                    <button type="button" onClick={() => selectVisibleExternal(false)}>取消全选</button>
                    <button type="button" className="dsm-bulk-primary" disabled={syncLoading || selectedVisibleCount(visibleExternalCandidates, selectedExternalKeys, skills) === 0} onClick={() => void importSelectedExternal()}>
                      {syncLoading ? "导入中" : `导入所选 (${selectedVisibleCount(visibleExternalCandidates, selectedExternalKeys, skills)})`}
                    </button>
                  </div>
                </div>
                <div className="dsm-source-filters dsm-sync-source-filters" role="group" aria-label="扫描来源">
                  {EXTERNAL_SOURCE_FILTERS.map((source) => <button key={source.id} type="button" aria-pressed={syncSource === source.id} onClick={() => setSyncSource(source.id)}>{source.label}</button>)}
                </div>
                {visibleExternalCandidates.length === 0 ? <p className="dsm-empty">当前来源未发现外部 Skill</p> : (
                  <ul className="dsm-list" aria-label="外部 Skill 列表">
                    {visibleExternalCandidates.map((candidate) => {
                      const installed = skills.some((skill) => skill.name === candidate.name);
                      const busy = syncBusyKeys.has(`import:${candidate.target}:${candidate.name}`);
                      return <li className="dsm-row dsm-sync-row" key={`${candidate.target}:${candidate.name}`}>
                        <label className="dsm-select"><input type="checkbox" aria-label={`选择 ${targetLabel(candidate.target)} 的 ${candidate.name}`} checked={!installed && selectedExternalKeys.has(externalCandidateKey(candidate))} disabled={installed || busy || syncLoading} onChange={(event) => toggleExternalSelection(candidate, event.currentTarget.checked)} /></label>
                        <div className="dsm-skill-copy"><div className="dsm-skill-heading"><strong>{candidate.name}</strong><span>{targetLabel(candidate.target)}</span></div><p title={candidate.description}>{candidate.description}</p></div>
                        <button className="dsm-row-button" type="button" disabled={installed || busy} aria-label={`导入 ${candidate.name}`} onClick={() => void importExternal(candidate)}>{installed ? "已导入" : busy ? "导入中" : "导入"}</button>
                      </li>;
                    })}
                  </ul>
                )}
              </section>
              <section aria-labelledby="dsm-target-title">
                <h3 id="dsm-target-title">同步到其他 Agent</h3>
                <ul className="dsm-list" aria-label="同步目标列表">
                  {skills.map((skill) => <li className="dsm-sync-managed" key={skill.name}>
                    <span className="dsm-skill-icon" aria-hidden="true"><SkillFileIcon /></span>
                    <div className="dsm-skill-copy"><strong>{skill.name}</strong><p title={skill.description}>{skill.description}</p></div>
                    <div className="dsm-targets">
                      {targetStates.filter((state) => state.name === skill.name).map((state) => {
                        const busy = syncBusyKeys.has(`target:${state.target}:${skill.name}`);
                        const disabled = busy || state.status === "conflict" || state.status === "not-configured";
                        return <label className="dsm-target-toggle" key={state.target}>
                          <span>{targetLabel(state.target)}</span><small>{targetStatusLabel(state)}</small>
                          <span className="dsm-switch"><input type="checkbox" aria-label={`同步 ${skill.name} 到 ${targetLabel(state.target)}`} checked={state.status === "linked"} disabled={disabled} onChange={(event) => void setExternalEnabled(skill, state, event.currentTarget.checked)} /><span className="dsm-switch-track" aria-hidden="true" /></span>
                        </label>;
                      })}
                    </div>
                  </li>)}
                </ul>
              </section>
            </>
          )}
        </div>
      ) : view === "market" ? (
        !marketHostChecked && marketLoading ? (
          <p className="dsm-empty">正在检查 Skill Manager Host 能力...</p>
        ) : marketHostChecked && (!marketCapabilities?.features.marketplaceV2 || marketCapabilities.protocolVersion < 5 || !marketCapabilities.features.githubTrending || !marketCapabilities.features.skillClassification || !marketCapabilities.features.repositoryBatchAnalysis || !marketCapabilities.features.repositoryBatchInstall) ? (
          <div className="dsm-market-empty"><SkillFileIcon /><strong>Skill Manager Host 版本较旧</strong><p>请重启 DSH Desktop，让 Host 和客户端加载同一版 Marketplace V2。</p></div>
        ) : marketLoading && marketRepositories.length === 0 ? (
          <p className="dsm-empty">{marketSearched ? "正在搜索仓库..." : isTrendingSort(marketSort) ? "正在加载 GitHub 近期热度..." : marketSort === "latest" ? "正在加载最近创建的仓库..." : "正在加载历史热门仓库..."}</p>
        ) : marketSourceState === "unavailable" && marketRepositories.length === 0 ? (
          <div className="dsm-market-empty"><SkillFileIcon /><strong>GitHub Trending 暂时不可用</strong><p>{marketSourceMessage ?? "趋势网页未能加载。请稍后重试；不会用最近更新时间代替趋势。"}</p></div>
        ) : visibleMarketRepositories.length === 0 ? (
          <div className="dsm-market-empty"><SkillFileIcon /><strong>{marketSearched ? marketCategory === "all" ? "没有找到匹配的仓库" : "该分类暂未搜到 Skill 仓库" : marketCategory === "all" ? "当前榜单没有可识别的 Skill 候选" : "当前趋势榜没有该分类候选"}</strong><p>{marketSearched ? marketCategory === "all" ? "GitHub 搜索没有返回候选，可以更换关键词或排序后重试。" : "已完成该分类的 GitHub 远程搜索；可切换分类或稍后重试。" : marketSourceMessage ?? "GitHub Trending 只展示全站榜单中出现的 Skill 候选；安装前仍会验证 SKILL.md。"}</p></div>
        ) : (
          <>
          <div className="dsm-market-ranking"><strong>{marketSearched ? "GitHub 仓库搜索结果" : isTrendingSort(marketSort) ? "GitHub 近期热度 Skill 候选" : marketSort === "latest" ? "最近 60 天创建的 GitHub Skill 仓库" : marketSort === "popular" ? "历史热门 GitHub Skill 仓库" : "GitHub 仓库结果"}</strong><span>本次显示 {visibleMarketRepositories.length} · GitHub 候选 {marketRepositories.length} / {marketTotal}{marketDataUpdatedAt ? ` · ${formatRelativeDate(marketDataUpdatedAt)}` : ""}{marketSourceState === "cached" ? " · 缓存数据" : ""}</span></div>
          <ul className="dsm-list" aria-label={marketSearched ? "仓库搜索结果" : "GitHub Skill 仓库列表"}>
            {visibleMarketRepositories.map((repository) => (
              <li className="dsm-market-row dsm-repository-row" key={repository.repoKey}>
                <button
                  className="dsm-repository-open"
                  type="button"
                  aria-label={`查看 ${repository.fullName} 安装详情`}
                  onClick={() => void openRepository(repository)}
                >
                  <span className="dsm-repository-avatar" aria-hidden="true">{repository.owner.slice(0, 1).toLocaleUpperCase()}</span>
                  <div className="dsm-skill-copy">
                  <div className="dsm-skill-heading">
                    <strong>{repository.fullName}</strong>
                    <span>{repository.ownerType === "Organization" ? "组织" : "发布者"} {repository.owner}</span>
                  </div>
                  <p className="dsm-repository-description" title={repository.description ?? undefined}>
                    {repository.description ?? "仓库未提供简介"}
                    <span role="tooltip">{repository.description ?? "仓库未提供简介"}</span>
                  </p>
                  <div className="dsm-tags" aria-label={`${repository.fullName} Topics`}>
                    {[...repository.formatTopics, ...repository.categoryTopics].slice(0, 5).map((topic) => <span key={topic}>{topic}</span>)}
                    <span>{classificationLabel(repository.classification.primaryCategory)}</span>
                  </div>
                  <div className="dsm-market-meta">
                    {repository.stars > 0 ? <span>★ {formatMetric(repository.stars)}</span> : null}
                    {repository.repositoryId > 0 ? <span>{formatMetric(repository.forks)} forks</span> : null}
                    {repository.repositoryId > 0 ? <span>创建 {formatRelativeDate(repository.createdAt)}</span> : null}
                    {repository.trend?.weeklyStars !== null && repository.trend?.weeklyStars !== undefined ? <span>本周 +{formatMetric(repository.trend.weeklyStars)}</span> : null}
                    {repository.trend?.monthlyStars !== null && repository.trend?.monthlyStars !== undefined ? <span>本月 +{formatMetric(repository.trend.monthlyStars)}</span> : null}
                    {repository.trend ? <span>GitHub Trending</span> : null}
                    {repository.repositoryId > 0 ? <span>默认分支 {repository.defaultBranch}</span> : <span>Trending 摘要元数据</span>}
                    {repository.discovery.signals.map((signal) => <span key={`${signal.kind}:${signal.label}`}>{signal.label}</span>)}
                  </div>
                  </div>
                </button>
                <div className="dsm-market-actions">
                  {repositoryInstallCount(skills, repository) > 0 ? (
                    <span className="dsm-installed-badge">已安装 {repositoryInstallCount(skills, repository)}</span>
                  ) : null}
                  <button
                    className="dsm-market-install"
                    type="button"
                    aria-label={`安装 ${repository.fullName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void installRepositoryAll(repository);
                    }}
                  >
                    安装
                  </button>
                  <a
                    className="dsm-source-link"
                    href={repository.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`在 GitHub 查看 ${repository.fullName}`}
                    title="查看来源"
                  >
                    <IconRightUpOutline14 aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {marketHasMore ? (
            <div className="dsm-market-more">
              <button type="button" disabled={marketLoading} onClick={() => void (marketSearched ? searchNextRepositories() : browseRepositories(false))}>
                {marketLoading ? "加载中..." : "加载更多 20 个"}
              </button>
            </div>
          ) : null}
          </>
        )
      ) : loading ? (
        <p className="dsm-empty">正在加载...</p>
      ) : visibleSkills.length === 0 ? (
        <p className="dsm-empty">没有匹配的 Skill</p>
      ) : (
        <>
        <div className="dsm-bulk-actions" aria-label="批量管理当前结果">
          <span>{selectedManagedNames.size} / {visibleSkills.length} 已选择</span>
          <button type="button" onClick={() => selectVisibleManagedSkills(true)}>全选当前结果</button>
          <button type="button" onClick={() => selectVisibleManagedSkills(false)}>取消全选</button>
          <button type="button" disabled={selectedManagedNames.size === 0 || bulkManagedAction !== null} onClick={() => void runBulkManagedAction("enable")}>批量开启</button>
          <button type="button" disabled={selectedManagedNames.size === 0 || bulkManagedAction !== null} onClick={() => void runBulkManagedAction("disable")}>批量关闭</button>
          <button className={confirmingBulkDelete ? "dsm-bulk-primary" : ""} type="button" disabled={selectedManagedNames.size === 0 || bulkManagedAction !== null} onClick={() => void runBulkManagedAction("delete")}>{confirmingBulkDelete ? `确认删除 ${selectedManagedNames.size} 项` : "批量删除"}</button>
        </div>
        <ul className="dsm-list" aria-label="Skill 列表">
          {visibleSkills.map((skill) => {
            const enabled = skill.enabledTargets.includes("dsh");
            const check = updateChecks.get(skill.name);
            const supportsUpdates = skill.source?.kind === "github";
            const checkingUpdate = checkingUpdateNames.has(skill.name);
            const updating = updatingNames.has(skill.name);
            const busy = busyNames.has(skill.name) || updating || checkingUpdate;
            const deleting = deletingNames.has(skill.name);
            const confirmingDelete = confirmingDeleteName === skill.name;
            return (
              <li className="dsm-skill-item" key={skill.name}>
                <div className="dsm-row">
                  <label className="dsm-select"><input type="checkbox" aria-label={`选择 ${skill.name}`} checked={selectedManagedNames.has(skill.name)} disabled={busy} onChange={(event) => {
                    setConfirmingBulkDelete(false);
                    setSelectedManagedNames((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.checked) next.add(skill.name); else next.delete(skill.name);
                      return next;
                    });
                  }} /></label>
                  <span className="dsm-skill-icon" aria-hidden="true">
                    <SkillFileIcon />
                  </span>
                  <div className="dsm-skill-copy">
                    <div className="dsm-skill-heading">
                      <strong>{skill.name}</strong>
                      <span title={managedSourceTitle(skill)}>{managedSourceLabel(skill)}</span>
                      {check ? (
                        <span className="dsm-update-state" data-status={check.status}>
                          {updateStatusLabel(check.status)}
                        </span>
                      ) : null}
                    </div>
                    <p title={skill.description}>{skill.description}</p>
                    {check?.latestRisk ? (
                      <div className="dsm-provenance-state" data-status={check.latestRisk.risk === "high" ? "ambiguous" : "matched"}>
                        <span>{`更新风险：${riskLabel(check.latestRisk.risk)}${check.latestRisk.findings.length > 0
                          ? ` · ${check.latestRisk.findings.length} 项提示`
                          : ""}`}</span>
                      </div>
                    ) : null}
                    <div className="dsm-tags" aria-label={`${skill.name} 类型标签`}>
                      {contentTags(skill.name, skill.description).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                  <div className="dsm-skill-actions">
                    {check?.status === "update-available" ? (
                      <button
                        className={`dsm-row-button ${confirmingRiskUpdateName === skill.name
                          ? "dsm-row-button-danger"
                          : "dsm-row-button-accent"}`}
                        type="button"
                        aria-label={`更新 ${skill.name}`}
                        disabled={busy}
                        onClick={() => {
                          const requiresReview = check.latestRisk !== undefined && (
                            check.latestRisk === null
                            || check.latestRisk.risk === "unknown"
                            || check.latestRisk.risk === "high"
                          );
                          if (requiresReview && confirmingRiskUpdateName !== skill.name) {
                            setConfirmingRiskUpdateName(skill.name);
                            setNotice(`${skill.name} 的更新包含高或未知风险，请查看风险提示后再次确认。`);
                            return;
                          }
                          void updateSkill(skill, requiresReview);
                        }}
                      >
                        {updating ? "更新中" : confirmingRiskUpdateName === skill.name ? "确认更新" : "更新"}
                      </button>
                    ) : null}
                    {supportsUpdates && check?.status !== "update-available" ? (
                      <button
                        className="dsm-row-button"
                        type="button"
                        aria-label={`${check ? "重新检查" : "检查"} ${skill.name} 更新`}
                        disabled={busy}
                        onClick={() => void checkSkillUpdate(skill)}
                      >
                        {checkingUpdate ? "检查中" : check ? "重新检查" : "检查更新"}
                      </button>
                    ) : null}
                    <button
                      className={`dsm-row-button${confirmingDelete ? " dsm-row-button-danger" : ""}`}
                      type="button"
                      aria-label={`${confirmingDelete ? "确认删除" : "删除"} ${skill.name}`}
                      disabled={busy || deleting}
                      onClick={() => void deleteSkill(skill)}
                    >
                      {deleting ? "删除中" : confirmingDelete ? "确认删除" : "删除"}
                    </button>
                    <label className="dsm-switch">
                      <span className="dsm-sr-only">在 DSH 中启用 {skill.name}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={busy}
                        onChange={(event) => void setEnabled(skill, event.currentTarget.checked)}
                      />
                      <span className="dsm-switch-track" aria-hidden="true" />
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
      {inspectionRepository !== null ? (
        <RepositoryInstallDialog
          repository={inspectionRepository}
          inspection={inspection}
          loading={inspectionLoading}
          error={inspectionError}
          avatarUrl={inspectionAvatarUrl}
          media={inspectionMedia}
          selectedMediaId={selectedInspectionMediaId}
          installedSkillPaths={installedRepositorySkillPaths(skills, inspectionRepository)}
          selectedSkillPaths={selectedSkillPaths}
          riskAssessments={riskAssessments}
          installingSkillPaths={installingSkillPaths}
          installResults={installResults}
          confirmHighRiskInstall={confirmHighRiskInstall}
          onClose={closeRepositoryDialog}
          onRetry={() => void inspectOpenRepository()}
          onSelectMedia={selectInspectionMedia}
          onMediaError={removeInspectionMedia}
          onToggle={toggleSelectedSkill}
          onSelectAll={(selected) => setSelectedSkillPaths(new Set(selected && inspection !== null
            ? inspection.skills.filter((skill) => skill.installable
              && !installedRepositorySkillPaths(skills, inspectionRepository).has(skill.path)).map((skill) => skill.path)
            : []))}
          onInstall={() => void installSelectedSkills()}
        />
      ) : null}
    </section>
  );
}

type SkillView = "all" | "market" | "custom" | "sync";
type ExternalSourceFilter = "all" | ExternalSkillCandidateWire["target"];
type MarketCategory = "all" | SkillCategoryIdWire;
type ProvenanceDisplayStatus = SkillProvenanceVerificationWire["status"] | "no-match" | "unavailable";
type MaintenanceKey = "autoMatch" | "autoCheck" | "autoUpdate";
interface MaintenanceSetting { enabled: boolean; lastRunAt: string | null }
type MaintenanceSettings = Record<MaintenanceKey, MaintenanceSetting>;
interface ResolvedInspectionMedia { id: string; asset: MediaAssetWire }
interface ProvenanceMatchSummary {
  matched: number;
  custom: number;
  ambiguous: number;
  ineligible: number;
  unavailable: number;
  failures: ProvenanceBatchFailureWire[];
}

const MAINTENANCE_STORAGE_KEY = "dsh-skill-manager:maintenance:v1";
const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const BULK_NOTICE_DISMISS_MS = 5_000;
const MAX_INSPECTION_MEDIA = 8;
const INSPECTION_MEDIA_CONCURRENCY = 3;

function mediaSourceId(source: MediaSourceWire): string {
  switch (source.type) {
    case "repo-blob": return `${source.type}:${source.repo}@${source.commit}:${source.path}`;
    case "github-avatar": return `${source.type}:${source.accountId}`;
    case "github-social-preview": return `${source.type}:${source.repo}`;
    case "generated": return `${source.type}:${source.seed}`;
  }
}

function isBulkCompletionNotice(value: string): boolean {
  return /^批量(?:开启|关闭|删除)完成：/u.test(value);
}

function uniqueMediaSources(sources: MediaSourceWire[]): MediaSourceWire[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const id = mediaSourceId(source);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function mergeInspectionMedia(
  preferred: ResolvedInspectionMedia[],
  existing: ResolvedInspectionMedia[]
): ResolvedInspectionMedia[] {
  const merged = new Map<string, ResolvedInspectionMedia>();
  for (const media of [...preferred, ...existing]) {
    if (!merged.has(media.id)) merged.set(media.id, media);
  }
  return [...merged.values()].slice(0, MAX_INSPECTION_MEDIA);
}

async function mapConcurrent<Input, Output>(
  items: Input[],
  concurrency: number,
  operation: (item: Input) => Promise<Output>
): Promise<Output[]> {
  const results = new Array<Output>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await operation(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const LOCAL_SKILL_VIEWS: ReadonlyArray<{ id: Exclude<SkillView, "market">; label: string }> = [
  { id: "all", label: "全部" },
  { id: "custom", label: "自设" },
  { id: "sync", label: "同步" }
];

const MARKET_SORT_OPTIONS: ReadonlyArray<{ id: RepositorySortWire; label: string }> = [
  { id: "trend-monthly", label: "近期热度榜" },
  { id: "popular", label: "历史热门" },
  { id: "latest", label: "最新" },
  { id: "relevance", label: "相关度" }
];

const MARKET_CATEGORY_OPTIONS: ReadonlyArray<{ id: MarketCategory; label: string }> = [
  { id: "all", label: "全部分类" },
  { id: "agent", label: "智能体与提示" },
  { id: "automation", label: "自动化与 Skill 工具" },
  { id: "development", label: "软件开发" },
  { id: "data", label: "数据与数据库" },
  { id: "design", label: "设计与可视化" },
  { id: "content", label: "内容与写作" },
  { id: "research", label: "研究与知识" },
  { id: "business", label: "商业与产品" },
  { id: "finance", label: "金融与区块链" },
  { id: "security", label: "安全与合规" },
  { id: "creative", label: "游戏与娱乐" },
  { id: "life", label: "生活与健康" }
];

const MARKET_CATEGORY_QUERIES: Record<Exclude<MarketCategory, "all" | "general">, string> = {
  agent: "agent prompt skill",
  automation: "automation skill",
  development: "software developer skill",
  data: "data database skill",
  design: "design visualization skill",
  content: "writing documentation skill",
  research: "research knowledge skill",
  business: "business product skill",
  finance: "finance blockchain skill",
  security: "security compliance skill",
  creative: "game entertainment skill",
  life: "health lifestyle skill"
};

const MAINTENANCE_OPTIONS: ReadonlyArray<{
  key: MaintenanceKey;
  label: string;
  description: string;
}> = [
  { key: "autoCheck", label: "自动检查更新", description: "读取已匹配 Skill 的最新固定快照" },
  { key: "autoUpdate", label: "自动更新", description: "仅自动更新未本地修改且风险为低或中等的 Skill" }
];

const EXTERNAL_SOURCE_FILTERS: ReadonlyArray<{ id: ExternalSourceFilter; label: string }> = [
  { id: "all", label: "全部位置" },
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude Code" },
  { id: "agents", label: "Agents" },
  { id: "opencode", label: "OpenCode" }
];

export function ensureSkillManagerStyles(): () => void {
  if (typeof document === "undefined") return () => undefined;
  let style = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ATTRIBUTE}"]`);
  if (style === null) {
    style = document.createElement("style");
    style.dataset.plugin = "dsh-skill-manager";
    style.dataset.pluginCss = STYLE_ATTRIBUTE;
    style.textContent = CLIENT_CSS;
    document.head.appendChild(style);
  }
  const ownerCount = Number.parseInt(style.dataset.pluginCssOwners ?? "0", 10);
  style.dataset.pluginCssOwners = String(Number.isFinite(ownerCount) ? ownerCount + 1 : 1);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const currentCount = Number.parseInt(style.dataset.pluginCssOwners ?? "1", 10);
    const nextCount = Math.max(0, (Number.isFinite(currentCount) ? currentCount : 1) - 1);
    if (nextCount === 0) {
      style.remove();
    } else {
      style.dataset.pluginCssOwners = String(nextCount);
    }
  };
}

function upsertSkill(skills: ManagedSkillWire[], next: ManagedSkillWire): ManagedSkillWire[] {
  return sortSkills([...skills.filter((skill) => skill.name !== next.name), next]);
}

function repositoryInstallCount(skills: ManagedSkillWire[], repository: RepositoryCandidateWire): number {
  return installedRepositorySkillPaths(skills, repository).size;
}

function installedRepositorySkillPaths(
  skills: ManagedSkillWire[],
  repository: RepositoryCandidateWire
): Set<string> {
  const expected = repository.fullName.toLocaleLowerCase();
  return new Set(skills.flatMap((skill) => (
    skill.source?.kind === "github" && (
      skill.source.repositoryId === repository.repositoryId
      || skill.source.repository.toLocaleLowerCase() === expected
    )
      ? [skill.source.path]
      : []
  )));
}

function sortSkills(skills: ManagedSkillWire[]): ManagedSkillWire[] {
  return [...skills].sort((left, right) => left.name.localeCompare(right.name));
}

function mergeRepositories(
  current: RepositoryCandidateWire[],
  incoming: RepositoryCandidateWire[]
): RepositoryCandidateWire[] {
  const repositories = new Map(current.map((repository) => [repository.repoKey, repository]));
  for (const repository of incoming) {
    if (!repositories.has(repository.repoKey)) repositories.set(repository.repoKey, repository);
  }
  return [...repositories.values()];
}

function originLabel(origin: ManagedSkillWire["origin"]): string {
  switch (origin) {
    case "self": return "自设";
    case "local-import": return "自设";
    case "github": return "GitHub";
    case "skills-sh": return "skills.sh";
    case "hugging-face": return "Hugging Face";
  }
}

function managedSourceLabel(skill: ManagedSkillWire): string {
  const source = skill.source;
  if (source?.kind === "local-import") {
    return `自设 · 来自 ${targetLabel(source.target)}`;
  }
  if (source?.kind === "github") {
    const discoveredBy = source.discoverySources
      ?.filter((candidate) => candidate !== source.catalog)
      .map(sourceLabel) ?? [];
    const primary = sourceLabel(source.catalog);
    return discoveredBy.length === 0 ? primary : `${primary} · 由 ${discoveredBy.join("、")} 发现`;
  }
  return originLabel(skill.origin);
}

function managedSourceTitle(skill: ManagedSkillWire): string {
  if (skill.source?.kind !== "github") return managedSourceLabel(skill);
  const method = skill.source.matchMethod === "exact-content" ? "完整内容精确匹配" : "安装时记录";
  return `${skill.source.repository}#${skill.source.path} · ${method}${skill.source.matchedAt
    ? ` · ${formatBackupDate(skill.source.matchedAt)}`
    : ""}`;
}

function sourceLabel(source: "skills-sh" | "github" | "hugging-face"): string {
  switch (source) {
    case "skills-sh": return "skills.sh";
    case "github": return "GitHub";
    case "hugging-face": return "Hugging Face";
  }
}

function targetLabel(target: SkillTargetStateWire["target"]): string {
  if (target === "codex") return "Codex";
  if (target === "claude") return "Claude Code";
  if (target === "opencode") return "OpenCode";
  return "Agents";
}

function targetStatusLabel(state: SkillTargetStateWire): string {
  switch (state.status) {
    case "not-configured": return `${targetLabel(state.target)} 未配置`;
    case "not-linked": return "未同步";
    case "linked": return "已同步";
    case "conflict": return `${targetLabel(state.target)} 已存在同名目录`;
  }
}

function formatMetric(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 })
    .format(value);
}

function SkillFileIcon() {
  return (
    <svg
      className="dsm-skill-file-icon"
      data-skill-file-icon="true"
      viewBox="0 0 28 32"
      fill="none"
      focusable="false"
    >
      <path className="dsm-skill-file-paper" d="M5.5 1.75h10.25L22.5 8.5v21.75h-17z" />
      <path className="dsm-skill-file-fold" d="M15.75 1.75V8.5h6.75" />
    </svg>
  );
}

interface RepositoryInstallDialogProps {
  repository: RepositoryCandidateWire;
  inspection: RepositoryInspectionWire | null;
  loading: boolean;
  error: string | null;
  avatarUrl: string | null;
  media: ResolvedInspectionMedia[];
  selectedMediaId: string | null;
  installedSkillPaths: Set<string>;
  selectedSkillPaths: Set<string>;
  riskAssessments: Map<string, SkillRiskAssessmentWire>;
  installingSkillPaths: Set<string>;
  installResults: Map<string, { ok: boolean; message: string }>;
  confirmHighRiskInstall: boolean;
  onClose(): void;
  onRetry(): void;
  onSelectMedia(id: string): void;
  onMediaError(id: string): void;
  onToggle(path: string, selected: boolean): void;
  onSelectAll(selected: boolean): void;
  onInstall(): void;
}

function RepositoryInstallDialog(props: RepositoryInstallDialogProps) {
  const skills = props.inspection?.skills ?? [];
  const selectable = skills.filter((skill) => (
    skill.installable && !props.installedSkillPaths.has(skill.path)
  ));
  const selectedCount = selectable.filter((skill) => props.selectedSkillPaths.has(skill.path)).length;
  const selectedRisksReady = selectable.filter((skill) => props.selectedSkillPaths.has(skill.path))
    .every((skill) => {
      const assessment = props.riskAssessments.get(skill.path);
      return assessment !== undefined && assessment.risk !== "unknown";
    });
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const anyInstalling = props.installingSkillPaths.size > 0;
  const activeMedia = props.media.find((media) => media.id === props.selectedMediaId) ?? props.media[0] ?? null;
  const repository = props.inspection === null ? props.repository : {
    ...props.inspection.repository,
    trend: props.repository.trend
  };
  const dialog = (
    <div className="dsm-modal-backdrop">
      <section className="dsm-install-dialog" role="dialog" aria-modal="true" aria-labelledby="dsm-inspection-title">
      <header className="dsm-dialog-header">
        <div>
          <h3 id="dsm-inspection-title">{repository.fullName}</h3>
          <p>{props.loading
            ? "项目信息已显示；安装内容正在后台准备并验证。"
            : props.inspection !== null
              ? "仓库内容与 Skill 结构已验证，可以选择安装。"
              : "项目信息已显示；仓库内容检查失败，可在卡片内重试。"}</p>
        </div>
        <button className="dsm-icon-button" type="button" aria-label="关闭安装确认" onClick={props.onClose}>
          <IconCloseOutline16 aria-hidden="true" />
        </button>
      </header>

      <div className="dsm-dialog-scroll">
        <div className="dsm-publisher">
        {props.avatarUrl ? <img className="dsm-repository-avatar" src={props.avatarUrl} alt="" /> : (
          <div className="dsm-repository-avatar" aria-hidden="true">{repository.owner.slice(0, 1).toLocaleUpperCase()}</div>
        )}
        <div>
          <strong>{repository.owner}</strong>
          <span>{repository.ownerType === "Organization" ? "GitHub 组织" : "GitHub 发布者"}</span>
        </div>
        <div className="dsm-market-meta">
          {repository.stars > 0 ? <span>★ {formatMetric(repository.stars)}</span> : null}
          {repository.repositoryId > 0 ? <span>{formatMetric(repository.forks)} forks</span> : null}
        </div>
        </div>
        <p className="dsm-dialog-description">{repository.description ?? "仓库未提供简介"}</p>
        <div className="dsm-tags" aria-label={`${repository.fullName} 详情 Topics`}>
          {repository.topics.slice(0, 8).map((topic) => <span key={topic}>{topic}</span>)}
          <span>{classificationLabel(repository.classification.primaryCategory)}</span>
        </div>
        <div className="dsm-market-meta dsm-dialog-repository-meta">
          {repository.repositoryId > 0 ? <span>创建 {formatRelativeDate(repository.createdAt)}</span> : null}
          {repository.repositoryId > 0 ? <span>更新 {formatRelativeDate(repository.updatedAt)}</span> : null}
          {repository.trend?.weeklyStars !== null && repository.trend?.weeklyStars !== undefined
            ? <span>本周 +{formatMetric(repository.trend.weeklyStars)}</span> : null}
          {repository.trend?.monthlyStars !== null && repository.trend?.monthlyStars !== undefined
            ? <span>本月 +{formatMetric(repository.trend.monthlyStars)}</span> : null}
          <a href={repository.url} target="_blank" rel="noreferrer">GitHub 来源 ↗</a>
        </div>

        {activeMedia ? <div className="dsm-inspection-gallery">
          <img
            className="dsm-inspection-cover"
            src={activeMedia.asset.dataUrl}
            alt={`${repository.fullName} 仓库预览`}
            onError={() => props.onMediaError(activeMedia.id)}
          />
          {props.media.length > 1 ? (
            <div className="dsm-inspection-thumbnails" role="group" aria-label="仓库图片">
              {props.media.map((media, index) => (
                <button
                  key={media.id}
                  type="button"
                  aria-label={`查看仓库图片 ${index + 1}`}
                  aria-pressed={media.id === activeMedia.id}
                  onClick={() => props.onSelectMedia(media.id)}
                >
                  <img src={media.asset.dataUrl} alt="" onError={() => props.onMediaError(media.id)} />
                </button>
              ))}
            </div>
          ) : null}
        </div> : (
          <div className="dsm-dialog-cover-fallback" aria-label="仓库未提供可用预览图"><SkillFileIcon /></div>
        )}

        {props.loading ? (
          <div className="dsm-dialog-state" role="status"><span className="dsm-dialog-spinner" aria-hidden="true" /><strong>正在准备仓库内容</strong><p>正在固定 commit、准备仓库快照并验证 SKILL.md；项目信息仍可查看。</p></div>
        ) : props.inspection === null && props.error ? (
          <div className="dsm-dialog-state dsm-dialog-state-error">
            <strong>无法检查这个 GitHub 仓库</strong>
            <p>{props.error}</p>
            <button className="dsm-row-button" type="button" onClick={props.onRetry}>重试</button>
          </div>
        ) : props.inspection !== null ? (
          <>
          {props.error ? <div className="dsm-inspection-warning">{props.error}</div> : null}
          <div className="dsm-market-meta">
            <span>结构已验证 · {props.inspection.inspectionCommit.slice(0, 7)}</span>
            <span>{props.inspection.skills.length} 个 Skill</span>
          </div>

      {props.inspection.warnings.length > 0 ? (
        <div className="dsm-inspection-warning">{props.inspection.warnings.join("；")}</div>
      ) : null}

      <div className="dsm-inspection-actions">
        <label>
          <input type="checkbox" checked={allSelected} disabled={selectable.length === 0 || anyInstalling}
            onChange={(event) => props.onSelectAll(event.currentTarget.checked)} />
          选择全部可安装 Skill
        </label>
        <span>{selectedCount} / {selectable.length} 已选择</span>
      </div>

      <ul className="dsm-inspection-skills" aria-label="仓库 Skill 列表">
        {skills.map((skill) => {
          const installed = props.installedSkillPaths.has(skill.path);
          const assessment = props.riskAssessments.get(skill.path);
          const result = props.installResults.get(skill.path);
          const installing = props.installingSkillPaths.has(skill.path);
          return (
            <li key={skill.skillKey}>
              <label className="dsm-inspection-select">
                <input type="checkbox" checked={!installed && props.selectedSkillPaths.has(skill.path)}
                  disabled={!skill.installable || installed || installing || anyInstalling}
                  onChange={(event) => props.onToggle(skill.path, event.currentTarget.checked)} />
                <SkillFileIcon />
              </label>
              <div className="dsm-skill-copy">
                <div className="dsm-skill-heading">
                  <strong>{skill.name}</strong>
                  <span>{skill.path}</span>
                  <span>{installed ? "已安装" : skill.installable ? "结构已验证" : "不可安装"}</span>
                </div>
                <p title={skill.description}>{skill.description}</p>
                <div className="dsm-tags" aria-label={`${skill.name} 分类标签`}>
                  <span>{classificationLabel(skill.classification.primaryCategory)}</span>
                  {skill.classification.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {skill.classification.evidence.length > 0 ? <small className="dsm-classification-evidence">分类依据：{skill.classification.evidence.map((evidence) => evidence.value).slice(0, 3).join("、")}</small> : null}
                <div className="dsm-integrity-risk">
                  <span className="dsm-integrity-ok">结构证据：固定检查 commit · SKILL.md 已解析</span>
                  <span>安装完整性：Host 安装时重新解析并验证完整 bundle</span>
                  <span data-risk={assessment?.risk ?? "unknown"}>内容风险：{riskLabel(assessment?.risk ?? "unknown")}</span>
                </div>
                {assessment && assessment.findings.length > 0 ? (
                  <ul className="dsm-risk-findings">
                    {assessment.findings.slice(0, 4).map((finding) => (
                      <li key={`${finding.code}:${finding.file}`}>{finding.title} · {finding.file}</li>
                    ))}
                  </ul>
                ) : null}
                {skill.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                {result ? <small data-result={result.ok ? "success" : "failure"}>{result.message}</small> : null}
              </div>
            </li>
          );
        })}
      </ul>

      {props.inspection.readme ? (
        <details className="dsm-readme">
          <summary>仓库说明 README</summary>
          <pre>{props.inspection.readme.content.slice(0, 12_000)}</pre>
        </details>
      ) : null}
          </>
        ) : null}
      </div>

      <footer className="dsm-dialog-footer">
        <p>{props.confirmHighRiskInstall
          ? "所选 Skill 含高风险提示，请再次确认。"
          : !selectedRisksReady && selectedCount > 0
            ? "正在完成内容风险检查；检查完成前不会写入 Skill 库。"
            : "远程 Skill 可能包含第三方脚本；安装不会执行脚本。"}</p>
        <div>
          <button className="dsm-dialog-cancel" type="button" disabled={anyInstalling} onClick={props.onClose}>取消</button>
          <button className="dsm-dialog-confirm" type="button" disabled={props.inspection === null || selectedCount === 0 || anyInstalling || !selectedRisksReady} onClick={props.onInstall}>
            {anyInstalling ? "安装中" : !selectedRisksReady && selectedCount > 0 ? "风险检查中" : props.confirmHighRiskInstall ? `确认安装 (${selectedCount})` : `安装所选 (${selectedCount})`}
          </button>
        </div>
      </footer>
      </section>
    </div>
  );
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

function riskLabel(risk: SkillRiskAssessmentWire["risk"]): string {
  switch (risk) {
    case "low": return "低";
    case "medium": return "中";
    case "high": return "高，需要二次确认";
    case "unknown": return "正在扫描或不可用";
  }
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function defaultMaintenanceSettings(): MaintenanceSettings {
  return {
    autoMatch: { enabled: false, lastRunAt: null },
    autoCheck: { enabled: false, lastRunAt: null },
    autoUpdate: { enabled: false, lastRunAt: null }
  };
}

function readMaintenanceSettings(): MaintenanceSettings {
  const defaults = defaultMaintenanceSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const value = JSON.parse(window.localStorage.getItem(MAINTENANCE_STORAGE_KEY) ?? "null") as unknown;
    if (!isClientRecord(value)) return defaults;
    for (const key of ["autoCheck", "autoUpdate"] as const) {
      const setting = value[key];
      if (!isClientRecord(setting) || typeof setting.enabled !== "boolean") return defaults;
      const lastRunAt = setting.lastRunAt;
      if (lastRunAt !== null && (typeof lastRunAt !== "string" || Number.isNaN(Date.parse(lastRunAt)))) return defaults;
      defaults[key] = { enabled: setting.enabled, lastRunAt };
    }
    defaults.autoMatch = { enabled: false, lastRunAt: null };
    return defaults;
  } catch {
    return defaults;
  }
}

function writeMaintenanceSettings(settings: MaintenanceSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function maintenanceDue(lastRunAt: string | null): boolean {
  return lastRunAt === null || Date.now() - Date.parse(lastRunAt) >= MAINTENANCE_INTERVAL_MS;
}

function isClientRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatTrashExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1_000)));
  return `${formatRelativeDate(value)}（剩余 ${days} 天）`;
}

function externalCandidateKey(candidate: ExternalSkillCandidateWire): string {
  return `${candidate.target}:${candidate.name}`;
}

function uniqueCandidatesByName(candidates: ExternalSkillCandidateWire[]): ExternalSkillCandidateWire[] {
  const unique = new Map<string, ExternalSkillCandidateWire>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.name)) unique.set(candidate.name, candidate);
  }
  return [...unique.values()];
}

function importableCandidateCount(
  candidates: ExternalSkillCandidateWire[],
  skills: ManagedSkillWire[]
): number {
  return uniqueCandidatesByName(candidates.filter((candidate) => (
    !skills.some((skill) => skill.name === candidate.name)
  ))).length;
}

function selectedVisibleCount(
  candidates: ExternalSkillCandidateWire[],
  selected: Set<string>,
  skills: ManagedSkillWire[]
): number {
  return uniqueCandidatesByName(candidates.filter((candidate) => (
    selected.has(externalCandidateKey(candidate))
    && !skills.some((skill) => skill.name === candidate.name)
  ))).length;
}

const MARKET_CATEGORY_LABELS: Readonly<Record<SkillCategoryIdWire, string>> = {
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

function classificationLabel(category: SkillCategoryIdWire): string {
  return MARKET_CATEGORY_LABELS[category] ?? "通用";
}

function marketplaceTitle(searched: boolean, sort: RepositorySortWire): string {
  if (searched) return "GitHub 搜索结果";
  if (isTrendingSort(sort)) return "GitHub 近期热度 Skill 候选";
  if (sort === "latest") return "最近 60 天创建的 GitHub Skill 仓库";
  return "历史热门 GitHub 仓库";
}

function isTrendingSort(sort: RepositorySortWire): sort is "trend-weekly" | "trend-monthly" {
  return sort === "trend-weekly" || sort === "trend-monthly";
}

function contentTags(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLocaleLowerCase();
  const tags = MARKET_TAG_RULES
    .filter((rule) => rule.terms.some((term) => matchesMarketTerm(text, term)))
    .map((rule) => rule.label)
    .slice(0, 3);
  return tags.length > 0 ? tags : ["通用"];
}

const MARKET_TAG_RULES = [
  { label: "代码", terms: ["code", "coding", "developer", "program", "typescript", "python", "react", "代码", "开发"] },
  { label: "设计", terms: ["design", "ui", "ux", "figma", "visual", "设计", "视觉"] },
  { label: "创作", terms: ["writing", "creative", "content", "story", "创作", "写作"] },
  { label: "小说", terms: ["novel", "fiction", "character", "小说", "角色"] },
  { label: "游戏", terms: ["game", "gaming", "unity", "unreal", "游戏"] },
  { label: "电商", terms: ["commerce", "ecommerce", "shop", "product listing", "电商", "商品"] },
  { label: "数据", terms: ["data", "analytics", "spreadsheet", "数据", "分析"] },
  { label: "研究", terms: ["research", "paper", "academic", "研究", "论文"] }
] as const;

function matchesMarketTerm(text: string, term: string): boolean {
  if (/[^\x00-\x7f]/u.test(term)) return text.includes(term);
  return text.split(/[^a-z0-9]+/u).includes(term);
}

function remoteErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Skill Manager 暂时不可用";
}

function provenanceStatusLabel(status: ProvenanceDisplayStatus): string {
  switch (status) {
    case "matched": return "GitHub 来源已匹配";
    case "no-match": return "未找到相同的 GitHub Skill";
    case "custom": return "用户自设，未找到唯一相同的 GitHub Skill";
    case "ambiguous": return "找到多个相同候选，无法自动确认";
    case "ineligible": return "本地内容已变化，暂不核验来源";
    case "unavailable": return "GitHub 来源核验暂时不可用";
  }
}

function updateStatusLabel(status: SkillUpdateCheckWire["status"]): string {
  switch (status) {
    case "unsupported": return "不支持远程更新";
    case "local-modified": return "本地已修改";
    case "source-moved": return "来源路径已变化";
    case "up-to-date": return "已是最新";
    case "update-available": return "可更新";
  }
}

function backupVersion(backup: SkillBackupWire): string {
  return backup.snapshot?.commitSha.slice(0, 7) ?? backup.contentHash.slice(0, 7);
}

function backupReasonLabel(reason: SkillBackupWire["reason"]): string {
  return reason === "update" ? "更新前" : "回滚前";
}

function formatBackupDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function withoutValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  next.delete(value);
  return next;
}

function withoutValues(values: Set<string>, removed: readonly string[]): Set<string> {
  const next = new Set(values);
  for (const value of removed) next.delete(value);
  return next;
}

function withStatuses<Value>(
  values: Map<string, Value>,
  names: readonly string[],
  status: Value
): Map<string, Value> {
  const next = new Map(values);
  for (const name of names) next.set(name, status);
  return next;
}

function withoutMapKeys<Key, Value>(values: Map<Key, Value>, keys: readonly Key[]): Map<Key, Value> {
  const next = new Map(values);
  for (const key of keys) next.delete(key);
  return next;
}

function withMapValues<Key, Value>(
  values: Map<Key, Value>,
  keys: readonly Key[],
  value: Value
): Map<Key, Value> {
  const next = new Map(values);
  for (const key of keys) next.set(key, value);
  return next;
}

function formatProvenanceSummary(summary: ProvenanceMatchSummary): string {
  return `重匹配完成：匹配 ${summary.matched}，自设 ${summary.custom}，歧义 ${summary.ambiguous}，本地已修改 ${summary.ineligible}，不可用 ${summary.unavailable}`;
}

function incrementProvenanceSummary(
  summary: ProvenanceMatchSummary,
  status: Exclude<ProvenanceDisplayStatus, "unavailable">
): void {
  if (status === "no-match") summary.custom += 1;
  else summary[status] += 1;
}

function chunk<Value>(values: readonly Value[], size: number): Value[][] {
  const batches: Value[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

function withoutMapKey<Key, Value>(values: Map<Key, Value>, key: Key): Map<Key, Value> {
  const next = new Map(values);
  next.delete(key);
  return next;
}

function setUpdateStatus(
  checks: Map<string, SkillUpdateCheckWire>,
  name: string,
  status: SkillUpdateCheckWire["status"]
): Map<string, SkillUpdateCheckWire> {
  const next = new Map(checks);
  const previous = next.get(name);
  if (previous) next.set(name, { ...previous, status });
  return next;
}

function prependBackup(
  backupsByName: Map<string, SkillBackupWire[]>,
  backup: SkillBackupWire
): Map<string, SkillBackupWire[]> {
  if (!backupsByName.has(backup.name)) return backupsByName;
  const next = new Map(backupsByName);
  const current = next.get(backup.name) ?? [];
  next.set(backup.name, [backup, ...current.filter((candidate) => candidate.id !== backup.id)]);
  return next;
}

const CLIENT_CSS = `
.dsm-panel,
.dsm-modal-backdrop {
  --dsm-bg-base: var(--dsw-alias-bg-base, #ffffff);
  --dsm-bg-layer-1: var(--dsw-alias-bg-layer-1, #f7f7f7);
  --dsm-bg-layer-2: var(--dsw-alias-bg-layer-2, #efefef);
  --dsm-module: var(--dsw-alias-bg-module-platform, #f1f1f1);
  --dsm-hover: var(--dsw-alias-interactive-bg-hover, #e8e8e8);
  --dsm-border-1: var(--dsw-alias-border-l1, #d4d4d4);
  --dsm-border-2: var(--dsw-alias-border-l2, #e4e4e4);
  --dsm-label-primary: var(--dsw-alias-label-primary, #202020);
  --dsm-label-secondary: var(--dsw-alias-label-secondary, var(--dsw-alias-label-tertiary, #6f6f6f));
  --dsm-label-tertiary: var(--dsw-alias-label-tertiary, #8a8a8a);
  --dsm-accent: var(--dsw-alias-brand-primary, var(--dsw-alias-state-business-primary, #247a5c));
  --dsm-accent-label: var(--dsw-alias-label-primary-inverted, #fff);
  --dsm-error: var(--dsw-alias-state-error-primary, #c05c3b);
  --dsm-error-bg: var(--dsw-alias-state-error-secondary, #f8e8e3);
}
.dsm-panel {
  box-sizing: border-box;
  width: min(100%, 780px);
  margin: 0 auto;
  padding: 20px 20px 40px;
  color: var(--dsm-label-primary);
  font: inherit;
}
.dsm-panel * { box-sizing: border-box; }
.dsm-primary-tabs {
  display: inline-flex;
  gap: 18px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-primary-tabs button {
  position: relative;
  min-height: 34px;
  padding: 0 2px 9px;
  border: 0;
  background: transparent;
  color: var(--dsm-label-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsm-primary-tabs button[aria-selected="true"] { color: var(--dsm-label-primary); }
.dsm-primary-tabs button[aria-selected="true"]::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--dsm-accent);
}
.dsm-primary-tabs button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-tabs {
  width: min(100%, 320px);
  display: grid;
  grid-template-columns: repeat(3, minmax(70px, 1fr));
  gap: 2px;
  margin-top: 14px;
  padding: 3px;
  border: 1px solid var(--dsm-border-2);
  border-radius: 6px;
  background: var(--dsm-bg-layer-1);
}
.dsm-tabs button {
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsm-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsm-tabs button[aria-selected="true"] {
  background: var(--dsm-hover);
  color: var(--dsm-label-primary);
}
.dsm-tabs button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 1px; }
.dsm-market-controls {
  padding: 8px 0 4px;
  border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-market-source-bar,
.dsm-market-category-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dsm-market-source-bar { padding-bottom: 6px; }
.dsm-market-category-bar {
  padding-top: 6px;
  border-top: 1px solid var(--dsm-border-2);
}
.dsm-source-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.dsm-source-filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 6px;
  background: transparent;
  color: var(--dsm-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dsm-source-filters button[aria-pressed="true"] {
  border-color: var(--dsm-accent);
  color: var(--dsm-accent);
  background: var(--dsm-bg-layer-2);
}
.dsm-source-filters button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 1px; }
.dsm-source-warning { margin: 0; color: var(--dsm-label-secondary); font-size: 11px; text-align: right; }
.dsm-market-empty {
  min-height: 210px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px;
  text-align: center;
  color: var(--dsm-label-secondary);
}
.dsm-market-empty .dsm-skill-file-icon { width: 32px; height: 37px; }
.dsm-market-ranking {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 0 8px; border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-market-ranking strong { color: var(--dsm-label-primary); font-size: 12px; }
.dsm-market-ranking span { color: var(--dsm-label-tertiary); font-size: 11px; }
.dsm-market-more { display: flex; justify-content: center; padding: 16px 0 4px; }
.dsm-market-more button {
  min-height: 30px; padding: 0 12px; border: 1px solid var(--dsm-border-1);
  border-radius: 6px; background: var(--dsm-module); color: var(--dsm-label-secondary);
  font: inherit; font-size: 12px; cursor: pointer;
}
.dsm-market-more button:disabled { cursor: default; opacity: .5; }
.dsm-market-empty strong { color: var(--dsm-label-primary); font-size: 14px; }
.dsm-market-empty p { max-width: 460px; margin: 0; font-size: 12px; line-height: 1.6; }
.dsm-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsm-title-row h2 { margin: 0; font-size: 18px; line-height: 1.3; letter-spacing: 0; }
.dsm-count {
  min-width: 24px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dsm-border-1);
  border-radius: 6px;
  color: var(--dsm-label-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.dsm-toolbar { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; min-width: 0; }
.dsm-market-search { min-width: 0; display: flex; align-items: center; gap: 8px; }
.dsm-search {
  width: min(240px, 42vw);
  height: 36px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 6px;
  background: var(--dsm-module);
  color: var(--dsm-label-secondary);
}
.dsm-search:focus-within { border-color: var(--dsm-accent); outline: 2px solid color-mix(in srgb, var(--dsm-accent) 24%, transparent); }
.dsm-search input {
  width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit;
}
.dsm-search input { color: var(--dsm-label-primary); }
.dsm-search input::placeholder { color: var(--dsm-label-tertiary); }
.dsm-icon-button, .dsm-command-button, .dsm-update-check, .dsm-row-button {
  height: 36px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 6px;
  background: var(--dsm-module);
  color: var(--dsm-label-primary);
  font: inherit;
  cursor: pointer;
}
.dsm-icon-button {
  width: 36px;
  flex: 0 0 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dsm-icon-button-primary { background: var(--dsm-accent); border-color: var(--dsm-accent); color: var(--dsm-accent-label); }
.dsm-command-button { min-width: 72px; padding: 0 14px; background: var(--dsm-accent); border-color: var(--dsm-accent); color: var(--dsm-accent-label); }
.dsm-update-check { min-width: 76px; padding: 0 10px; font-size: 12px; white-space: nowrap; }
.dsm-icon-button:not(.dsm-icon-button-primary):hover:not(:disabled), .dsm-update-check:hover:not(:disabled),
.dsm-row-button:hover:not(:disabled) { background: var(--dsm-hover); }
.dsm-command-button:hover:not(:disabled), .dsm-icon-button-primary:hover:not(:disabled) { filter: brightness(1.08); }
.dsm-icon-button:focus-visible, .dsm-command-button:focus-visible,
.dsm-update-check:focus-visible, .dsm-row-button:focus-visible,
.dsm-create input:focus-visible, .dsm-switch input:focus-visible + .dsm-switch-track {
  outline: 2px solid var(--dsm-accent);
  outline-offset: 2px;
}
.dsm-icon-button:disabled, .dsm-command-button:disabled,
.dsm-update-check:disabled, .dsm-row-button:disabled { cursor: default; opacity: .5; }
.dsm-create {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding: 14px 0;
  border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-field-grid { display: grid; grid-template-columns: minmax(160px, .65fr) minmax(220px, 1.35fr); gap: 10px; }
.dsm-field-grid label { min-width: 0; display: grid; gap: 5px; color: var(--dsm-label-secondary); font-size: 12px; }
.dsm-field-grid input {
  width: 100%; height: 36px; padding: 0 10px; border: 1px solid var(--dsm-border-1);
  border-radius: 6px; background: var(--dsm-module); color: var(--dsm-label-primary); font: inherit;
}
.dsm-create-actions { display: flex; align-items: center; gap: 8px; }
.dsm-status { min-height: 12px; }
.dsm-error {
  margin: 10px 0 0; padding: 9px 10px; border-left: 3px solid var(--dsm-error);
  background: var(--dsm-error-bg); color: var(--dsm-label-primary); font-size: 13px;
}
.dsm-notice {
  margin: 10px 0 0; padding: 6px 6px 6px 10px; border-left: 3px solid var(--dsm-accent);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: var(--dsm-bg-layer-2); color: var(--dsm-label-primary); font-size: 13px;
}
.dsm-notice span { min-width: 0; }
.dsm-notice-dismiss {
  width: 24px; height: 24px; flex: 0 0 24px; display: inline-grid; place-items: center;
  padding: 0; border: 0; background: transparent; color: var(--dsm-label-secondary); cursor: pointer;
}
.dsm-notice-dismiss:hover { background: var(--dsm-bg-hover); color: var(--dsm-label-primary); }
.dsm-local-tools { border-bottom: 1px solid var(--dsm-border-2); }
.dsm-maintenance, .dsm-trash { padding: 10px 0; }
.dsm-trash { border-top: 1px solid var(--dsm-border-2); }
.dsm-utility-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsm-utility-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.dsm-utility-heading h3 { margin: 0; color: var(--dsm-label-primary); font-size: 12px; }
.dsm-utility-heading p { margin: 3px 0 0; color: var(--dsm-label-tertiary); font-size: 10px; }
.dsm-maintenance-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.dsm-maintenance-options label {
  min-width: 0; display: grid; grid-template-columns: 15px minmax(0, 1fr); align-items: start; gap: 7px;
  padding: 7px 8px; border: 1px solid var(--dsm-border-2); border-radius: 6px; background: var(--dsm-bg-layer-1); cursor: pointer;
}
.dsm-maintenance-options input { width: 14px; height: 14px; margin: 1px 0 0; accent-color: var(--dsm-accent); }
.dsm-maintenance-options strong, .dsm-maintenance-options small { display: block; }
.dsm-maintenance-options strong { color: var(--dsm-label-primary); font-size: 11px; font-weight: 500; }
.dsm-maintenance-options small { margin-top: 2px; color: var(--dsm-label-tertiary); font-size: 9px; line-height: 1.4; }
.dsm-provenance-error { display: block; min-width: 0; overflow: hidden; color: var(--dsm-error); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dsm-trash-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0;
  border: 0; background: transparent; color: var(--dsm-label-secondary); text-align: left; font: inherit; cursor: pointer;
}
.dsm-trash-toggle > span:first-child { min-width: 0; }
.dsm-trash-toggle strong, .dsm-trash-toggle small { display: block; }
.dsm-trash-toggle strong { color: var(--dsm-label-primary); font-size: 12px; }
.dsm-trash-toggle small { margin-top: 3px; color: var(--dsm-label-tertiary); font-size: 10px; }
.dsm-trash-toggle > span:last-child { flex: 0 0 auto; font-size: 11px; }
.dsm-trash-toggle:focus-visible, .dsm-trash button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-trash ul { margin: 8px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--dsm-border-2); }
.dsm-trash li { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--dsm-border-2); }
.dsm-trash li > div { min-width: 0; }
.dsm-trash li strong, .dsm-trash li small, .dsm-trash li time { display: block; }
.dsm-trash li strong { color: var(--dsm-label-primary); font-size: 12px; }
.dsm-trash li small { max-width: 560px; margin-top: 2px; overflow: hidden; color: var(--dsm-label-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dsm-trash li time { margin-top: 2px; color: var(--dsm-label-tertiary); font-size: 9px; }
.dsm-trash li button { height: 28px; padding: 0 10px; border: 1px solid var(--dsm-accent); border-radius: 6px; background: transparent; color: var(--dsm-accent); font: inherit; font-size: 11px; cursor: pointer; }
.dsm-trash li button:disabled { cursor: default; opacity: .5; }
.dsm-trash-empty { margin: 8px 0 0; color: var(--dsm-label-tertiary); font-size: 11px; }
.dsm-list { margin: 0; padding: 0; list-style: none; }
.dsm-skill-item { border-bottom: 1px solid var(--dsm-border-2); }
.dsm-row {
  min-height: 68px;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}
.dsm-skill-item > .dsm-row {
  grid-template-columns: 28px 28px minmax(0, 1fr) auto;
}
.dsm-skill-item > .dsm-row > .dsm-select { grid-column: 1; }
.dsm-skill-item > .dsm-row > .dsm-skill-icon { grid-column: 2; }
.dsm-skill-item > .dsm-row > .dsm-skill-copy { grid-column: 3; }
.dsm-skill-item > .dsm-row > .dsm-skill-actions { grid-column: 4; }
.dsm-market-row {
  min-height: 82px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid var(--dsm-border-2);
}
.dsm-repository-row { grid-template-columns: minmax(0, 1fr) auto; }
.dsm-repository-open {
  min-width: 0;
  width: 100%;
  align-self: stretch;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 8px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsm-repository-open:hover { background: var(--dsm-hover); }
.dsm-repository-open:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-repository-avatar {
  width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsm-border-1); border-radius: 50%; background: var(--dsm-bg-layer-1);
  color: var(--dsm-label-primary); font-size: 13px; font-weight: 600;
}
.dsm-market-actions { display: flex; align-items: center; gap: 6px; }
.dsm-installed-badge {
  display: inline-flex; align-items: center; min-height: 24px; padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--dsm-accent) 45%, transparent); border-radius: 999px;
  color: var(--dsm-accent); font-size: 10px; white-space: nowrap;
}
.dsm-market-install {
  min-width: 82px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--dsm-accent);
  border-radius: 6px;
  background: transparent;
  color: var(--dsm-accent);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsm-market-install:hover:not(:disabled) {
  background: var(--dsm-hover);
}
.dsm-market-install:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-market-install:disabled { cursor: default; opacity: .56; }
.dsm-repository-description { position: relative; }
.dsm-repository-description [role="tooltip"] {
  position: absolute;
  z-index: 15;
  right: 0;
  bottom: calc(100% + 7px);
  left: 0;
  display: none;
  width: min(430px, 100%);
  padding: 8px 10px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 7px;
  background: var(--dsm-bg-layer-2);
  color: var(--dsm-label-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .24);
  font-size: 11px;
  line-height: 1.5;
  white-space: normal;
}
.dsm-repository-description:hover [role="tooltip"],
.dsm-repository-open:focus-visible .dsm-repository-description [role="tooltip"] { display: block; }
.dsm-modal-backdrop {
  position: fixed;
  z-index: 2147483000;
  inset: 0;
  isolation: isolate;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 20px;
  background: rgba(0, 0, 0, .68);
  backdrop-filter: blur(2px);
  color: var(--dsm-label-primary);
  font: inherit;
}
.dsm-modal-backdrop * { box-sizing: border-box; }
.dsm-install-dialog {
  width: min(720px, calc(100vw - 40px));
  max-height: min(760px, calc(100vh - 40px));
  max-height: min(760px, calc(100dvh - 40px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsm-border-1);
  border-radius: 20px;
  background: var(--dsm-bg-base);
  color: var(--dsm-label-primary);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .46);
}
.dsm-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 12px;
}
.dsm-dialog-header h3 { margin: 0; color: var(--dsm-label-primary); font-size: 16px; line-height: 1.35; }
.dsm-dialog-header p { margin: 5px 0 0; color: var(--dsm-label-secondary); font-size: 11px; line-height: 1.5; }
.dsm-dialog-header .dsm-icon-button { width: 30px; height: 30px; flex-basis: 30px; border-color: transparent; background: transparent; }
.dsm-dialog-scroll { min-height: 0; overflow: auto; padding: 0 20px; }
.dsm-publisher { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.dsm-publisher strong { display: block; color: var(--dsm-label-primary); font-size: 12px; }
.dsm-publisher > div > span { display: block; margin-top: 2px; color: var(--dsm-label-tertiary); font-size: 10px; }
.dsm-publisher > .dsm-market-meta { justify-content: flex-end; margin: 0; }
.dsm-dialog-description { margin: 12px 0 0; color: var(--dsm-label-secondary); font-size: 12px; line-height: 1.55; }
.dsm-dialog-repository-meta { margin: 8px 0 12px; }
.dsm-dialog-repository-meta a { color: var(--dsm-accent); text-decoration: none; }
.dsm-dialog-repository-meta a:hover { text-decoration: underline; }
.dsm-inspection-gallery { min-width: 0; margin-top: 14px; }
.dsm-inspection-cover {
  width: 100%;
  height: clamp(150px, 25vh, 240px);
  border: 1px solid var(--dsm-border-2);
  border-radius: 10px;
  object-fit: contain;
  background: var(--dsm-bg-layer-1);
}
.dsm-inspection-thumbnails {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 72px;
  gap: 7px;
  margin-top: 8px;
  padding-bottom: 3px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}
.dsm-inspection-thumbnails button {
  width: 72px;
  height: 50px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid var(--dsm-border-2);
  border-radius: 6px;
  background: var(--dsm-bg-layer-1);
  cursor: pointer;
}
.dsm-inspection-thumbnails button[aria-pressed="true"] { border-color: var(--dsm-accent); }
.dsm-inspection-thumbnails button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 1px; }
.dsm-inspection-thumbnails img { width: 100%; height: 100%; display: block; object-fit: cover; }
.dsm-dialog-cover-fallback {
  height: 132px;
  display: grid;
  place-items: center;
  margin-top: 14px;
  border: 1px solid var(--dsm-border-2);
  border-radius: 10px;
  background: var(--dsm-bg-layer-1);
  color: var(--dsm-label-tertiary);
}
.dsm-dialog-cover-fallback .dsm-skill-file-icon { width: 42px; height: 49px; }
.dsm-dialog-state { display: grid; justify-items: center; gap: 7px; padding: 28px 16px; text-align: center; }
.dsm-dialog-state strong { font-size: 13px; }
.dsm-dialog-state p { max-width: 360px; margin: 0; color: var(--dsm-label-secondary); font-size: 11px; line-height: 1.55; }
.dsm-dialog-state-error strong { color: var(--dsm-error); }
.dsm-dialog-spinner { width: 20px; height: 20px; border: 2px solid var(--dsm-border-1); border-top-color: var(--dsm-accent); border-radius: 50%; animation: dsm-spin .8s linear infinite; }
@keyframes dsm-spin { to { transform: rotate(360deg); } }
.dsm-inspection-warning { margin-top: 10px; padding: 8px 10px; border-left: 3px solid var(--dsm-error); background: var(--dsm-error-bg); font-size: 12px; }
.dsm-inspection-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--dsm-border-2); }
.dsm-inspection-actions label { display: flex; align-items: center; gap: 7px; color: var(--dsm-label-secondary); font-size: 12px; }
.dsm-inspection-actions > span { color: var(--dsm-label-tertiary); font-size: 11px; }
.dsm-inspection-actions input, .dsm-inspection-select input { accent-color: var(--dsm-accent); }
.dsm-inspection-skills, .dsm-risk-findings { margin: 0; padding: 0; list-style: none; }
.dsm-inspection-skills > li { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--dsm-border-2); }
.dsm-inspection-select { display: flex; align-items: flex-start; justify-content: space-between; gap: 5px; }
.dsm-inspection-select .dsm-skill-file-icon { width: 22px; height: 26px; }
.dsm-integrity-risk { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 7px; font-size: 11px; color: var(--dsm-label-secondary); }
.dsm-integrity-ok { color: var(--dsm-accent); }
.dsm-integrity-risk [data-risk="high"] { color: var(--dsm-error); }
.dsm-risk-findings { margin-top: 5px; color: var(--dsm-label-secondary); font-size: 11px; }
.dsm-risk-findings li { padding: 2px 0; }
.dsm-inspection-skills small { display: block; margin-top: 4px; color: var(--dsm-label-secondary); font-size: 11px; }
.dsm-inspection-skills small[data-result="success"] { color: var(--dsm-accent); }
.dsm-inspection-skills small[data-result="failure"] { color: var(--dsm-error); }
.dsm-readme { margin-top: 14px; border: 1px solid var(--dsm-border-2); border-radius: 6px; background: var(--dsm-bg-layer-1); }
.dsm-readme summary { padding: 9px 10px; color: var(--dsm-label-primary); font-size: 12px; cursor: pointer; }
.dsm-readme pre { max-height: 360px; overflow: auto; margin: 0; padding: 12px; border-top: 1px solid var(--dsm-border-2); color: var(--dsm-label-secondary); white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.55 ui-monospace, Consolas, monospace; }
.dsm-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--dsm-border-2);
  background: var(--dsm-bg-base);
}
.dsm-dialog-footer p { max-width: 270px; margin: 0; color: var(--dsm-label-secondary); font-size: 10px; line-height: 1.45; }
.dsm-dialog-footer > div { display: flex; gap: 8px; }
.dsm-dialog-cancel, .dsm-dialog-confirm {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 18px;
  background: transparent;
  color: var(--dsm-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsm-dialog-confirm { border-color: var(--dsm-accent); background: var(--dsm-accent); color: var(--dsm-accent-label); }
.dsm-dialog-cancel:focus-visible, .dsm-dialog-confirm:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-dialog-cancel:disabled, .dsm-dialog-confirm:disabled { cursor: default; opacity: .5; }
.dsm-market-details {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsm-market-details p { min-width: 0; flex: 1 1 auto; }
.dsm-market-details button {
  flex: 0 0 auto;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--dsm-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dsm-market-details button:hover:not(:disabled) { text-decoration: underline; }
.dsm-market-details button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-market-details button:disabled { cursor: default; opacity: .56; }
.dsm-market-meta {
  min-width: 0;
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  color: var(--dsm-label-tertiary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dsm-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.dsm-tags span {
  padding: 2px 7px;
  border: 1px solid var(--dsm-border-2);
  border-radius: 999px;
  color: var(--dsm-label-secondary);
  background: var(--dsm-bg-layer-1);
  font-size: 10px;
}
.dsm-source-link {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--dsm-label-secondary);
}
.dsm-source-link:hover { background: var(--dsm-hover); color: var(--dsm-label-primary); }
.dsm-source-link:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-skill-icon {
  width: 28px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsm-label-secondary);
}
.dsm-skill-icon-market { width: 40px; height: 44px; }
.dsm-skill-icon-market .dsm-skill-file-icon { width: 32px; height: 37px; }
.dsm-skill-file-icon { width: 24px; height: 28px; overflow: visible; }
.dsm-skill-file-paper, .dsm-skill-file-fold {
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsm-skill-file-paper { fill: var(--dsm-bg-layer-1); stroke: currentColor; stroke-width: 1.4; }
.dsm-skill-file-fold { fill: var(--dsm-bg-layer-2); stroke: currentColor; stroke-width: 1.4; }
.dsm-skill-copy { min-width: 0; }
.dsm-skill-heading { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsm-skill-heading strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; letter-spacing: 0; }
.dsm-skill-heading span { flex: 0 0 auto; color: var(--dsm-label-secondary); font-size: 11px; }
.dsm-update-state {
  min-width: 0;
  padding-left: 8px;
  border-left: 1px solid var(--dsm-border-1);
  white-space: nowrap;
}
.dsm-update-state[data-status="update-available"] { color: var(--dsm-accent); }
.dsm-update-state[data-status="local-modified"] { color: var(--dsm-error); }
.dsm-skill-copy p {
  margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsm-label-secondary); font-size: 12px;
}
.dsm-provenance-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
  color: var(--dsm-label-secondary);
  font-size: 11px;
}
.dsm-provenance-state[data-status="matched"] { color: var(--dsm-accent); }
.dsm-provenance-state[data-status="unavailable"] { color: var(--dsm-error); }
.dsm-provenance-state button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dsm-provenance-state button:focus-visible { outline: 2px solid var(--dsm-accent); outline-offset: 2px; }
.dsm-skill-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
.dsm-row-button {
  min-width: 48px;
  height: 30px;
  padding: 0 9px;
  font-size: 12px;
}
.dsm-row-button-accent { border-color: var(--dsm-accent); color: var(--dsm-accent); }
.dsm-row-button-danger { border-color: var(--dsm-error); color: var(--dsm-error); }
.dsm-backups {
  margin: -2px 0 0 42px;
  padding: 0 0 10px 12px;
  border-left: 2px solid var(--dsm-accent);
}
.dsm-backups ul { margin: 0; padding: 0; list-style: none; }
.dsm-backups li {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--dsm-border-2);
}
.dsm-backups li:first-child { border-top: 0; }
.dsm-backups li > div { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 5px 10px; }
.dsm-backups strong { font-size: 12px; font-variant-numeric: tabular-nums; }
.dsm-backups span, .dsm-backups time {
  color: var(--dsm-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dsm-backup-empty { margin: 0; padding: 10px 0; color: var(--dsm-label-secondary); font-size: 12px; }
.dsm-switch { position: relative; width: 36px; height: 22px; display: block; }
.dsm-switch input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.dsm-switch-track {
  position: absolute; inset: 1px 0; border-radius: 10px;
  background: var(--dsm-module); transition: background-color 160ms ease;
}
.dsm-switch-track::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--dsm-bg-base); border: 1px solid var(--dsm-border-1); box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: transform 160ms ease;
}
.dsm-switch input:checked + .dsm-switch-track { background: var(--dsm-accent); }
.dsm-switch input:checked + .dsm-switch-track::after { transform: translateX(16px); }
.dsm-switch input:disabled + .dsm-switch-track { opacity: .52; }
.dsm-empty { margin: 0; padding: 36px 12px; text-align: center; color: var(--dsm-label-secondary); font-size: 13px; }
.dsm-sync section + section { margin-top: 18px; }
.dsm-sync h3 { margin: 8px 0 4px; color: var(--dsm-label-secondary); font-size: 12px; font-weight: 600; }
.dsm-sync-section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 8px; }
.dsm-sync-section-header h3 { margin: 0 0 4px; color: var(--dsm-label-primary); font-size: 13px; }
.dsm-sync-section-header p { margin: 0; color: var(--dsm-label-tertiary); font-size: 11px; }
.dsm-bulk-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.dsm-bulk-actions button {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--dsm-border-1);
  border-radius: 6px;
  background: var(--dsm-module);
  color: var(--dsm-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dsm-bulk-actions .dsm-bulk-primary { border-color: var(--dsm-accent); color: var(--dsm-accent); }
.dsm-bulk-actions button:disabled { cursor: default; opacity: .5; }
.dsm-sync-source-filters { padding: 10px 0 4px; }
.dsm-sync-row { border-bottom: 1px solid var(--dsm-border-2); }
.dsm-select { width: 28px; display: flex; justify-content: center; }
.dsm-select input { width: 15px; height: 15px; accent-color: var(--dsm-accent); }
.dsm-sync-managed { display: grid; grid-template-columns: 28px minmax(0, 1fr) minmax(280px, auto); gap: 10px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--dsm-border-2); }
.dsm-targets { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.dsm-target-toggle { min-width: 106px; display: grid; grid-template-columns: minmax(0, 1fr) 36px; align-items: center; column-gap: 8px; }
.dsm-target-toggle > span:first-child { font-size: 12px; }
.dsm-target-toggle small { grid-column: 1; color: var(--dsm-label-tertiary); font-size: 10px; white-space: nowrap; }
.dsm-target-toggle > .dsm-switch { grid-column: 2; grid-row: 1 / span 2; }
.dsm-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .dsm-panel { padding-inline: 14px; }
  .dsm-header { align-items: flex-start; flex-direction: column; }
  .dsm-primary-tabs { width: 100%; }
  .dsm-toolbar { width: 100%; }
  .dsm-search { width: auto; flex: 1 1 180px; }
  .dsm-update-check { flex: 0 0 auto; }
  .dsm-market-search { flex: 1 1 auto; }
  .dsm-market-search .dsm-search { min-width: 0; }
  .dsm-tabs { width: 100%; }
  .dsm-maintenance-options { grid-template-columns: 1fr; }
  .dsm-market-source-bar, .dsm-market-category-bar { align-items: flex-start; flex-direction: column; }
  .dsm-source-warning { text-align: left; }
  .dsm-create { grid-template-columns: 1fr; }
  .dsm-field-grid { grid-template-columns: 1fr; }
  .dsm-create-actions { justify-content: flex-end; }
  .dsm-row { grid-template-columns: 28px minmax(0, 1fr); padding: 10px 0; }
  .dsm-skill-item > .dsm-row { grid-template-columns: 28px 28px minmax(0, 1fr) auto; }
  .dsm-skill-item > .dsm-row > .dsm-skill-actions { grid-column: 4; justify-content: flex-end; flex-wrap: wrap; }
  .dsm-sync-row > .dsm-row-button { grid-column: 2; justify-self: start; }
  .dsm-sync-managed { grid-template-columns: 28px minmax(0, 1fr); }
  .dsm-sync-section-header { align-items: flex-start; flex-direction: column; }
  .dsm-bulk-actions { justify-content: flex-start; }
  .dsm-targets { grid-column: 2; justify-content: flex-start; }
  .dsm-backups { margin-left: 38px; }
  .dsm-backups li { align-items: flex-start; flex-direction: column; padding: 9px 0; }
  .dsm-repository-row { grid-template-columns: minmax(0, 1fr); padding: 10px 0; }
  .dsm-repository-open { grid-template-columns: 34px minmax(0, 1fr); }
  .dsm-repository-row .dsm-market-actions { grid-column: 1; justify-content: flex-start; padding-left: 46px; }
  .dsm-inspection-actions { align-items: flex-start; flex-direction: column; }
  .dsm-modal-backdrop { padding: 12px; }
  .dsm-install-dialog { width: min(100%, 480px); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); border-radius: 16px; }
  .dsm-dialog-header { padding: 16px 16px 10px; }
  .dsm-dialog-scroll { padding: 0 16px; }
  .dsm-publisher { grid-template-columns: 36px minmax(0, 1fr); }
  .dsm-publisher > .dsm-market-meta { grid-column: 2; justify-content: flex-start; }
  .dsm-dialog-footer { align-items: stretch; flex-direction: column; padding: 12px 16px 16px; }
  .dsm-dialog-footer p { max-width: none; }
  .dsm-dialog-footer > div { justify-content: flex-end; }
}
@media (max-width: 520px) {
  .dsm-skill-item > .dsm-row {
    grid-template-columns: 28px 28px minmax(0, 1fr);
    grid-template-areas:
      "select icon copy"
      ". . actions";
    align-items: start;
  }
  .dsm-skill-item > .dsm-row > .dsm-select { grid-area: select; align-self: center; }
  .dsm-skill-item > .dsm-row > .dsm-skill-icon { grid-area: icon; }
  .dsm-skill-item > .dsm-row > .dsm-skill-copy { grid-area: copy; }
  .dsm-skill-item > .dsm-row > .dsm-skill-actions { grid-area: actions; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .dsm-switch-track, .dsm-switch-track::after { transition: none; }
  .dsm-dialog-spinner { animation: none; }
}
`;
