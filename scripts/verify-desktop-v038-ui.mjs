import { strict as assert } from "node:assert";
import { spawn, execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OVERALL_TIMEOUT_MS = 9 * 60_000;
const BOOT_TIMEOUT_MS = 180_000;
const COMMAND_TIMEOUT_MS = 30_000;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = resolve(option(process.argv.slice(2), "--desktop")
  ?? join(projectRoot, ".cache", "dsh-desktop-v038", "dsh-desktop"));
const probeOnly = process.argv.includes("--probe");
const mainPath = join(desktopRoot, "main.js");
const electronPath = join(desktopRoot, "node_modules", "electron", "dist", "electron.exe");
const nodePath = join(desktopRoot, "vendor", "node", "node.exe");
const clientRuntimePath = join(
  desktopRoot,
  "node_modules",
  "@deepseek-ai",
  "dsh-client-runtime",
  "lib",
  "client.js"
);
const adapterPath = join(projectRoot, "scripts", "dsh-desktop-v038.mjs");
const artifactRoot = join(projectRoot, "output", "desktop-v038-ui");
const overallController = new AbortController();
const overallTimer = setTimeout(() => overallController.abort(
  new Error(`DSH Desktop v0.3.8 UI gate exceeded ${OVERALL_TIMEOUT_MS} ms.`)
), OVERALL_TIMEOUT_MS);

let originalMain;
let originalClientRuntime;
let child;
let testRoot;
let controlSequence = 0;

try {
  await assertFile(electronPath, "Electron runtime; run npm ci and npm run electron:fetch in the v0.3.8 checkout");
  await assertFile(nodePath, "portable Node runtime; run npm run fetch-node in the v0.3.8 checkout");
  await run(process.execPath, [adapterPath, "stage", "--desktop", desktopRoot], projectRoot, 60_000);
  await run(process.execPath, [join(desktopRoot, "scripts", "patch-deps.js")], desktopRoot, 60_000);

  originalMain = await readFile(mainPath, "utf8");
  originalClientRuntime = await readFile(clientRuntimePath, "utf8");
  await writeFile(mainPath, patchMainForUiGate(originalMain), "utf8");
  await writeFile(
    clientRuntimePath,
    patchClientRuntimeForUiGate(originalClientRuntime),
    "utf8"
  );
  testRoot = await mkdtemp(join(tmpdir(), "dsm-v038-ui-"));
  const userData = join(testRoot, "userdata");
  const dshHome = join(testRoot, "dsh-home");
  await mkdir(userData, { recursive: true });
  await mkdir(dshHome, { recursive: true });
  const workspacePath = join(testRoot, "workspace");
  const agentsHome = join(testRoot, "agents-home");
  const externalSkillName = "external-review-helper";
  await mkdir(workspacePath, { recursive: true });
  await mkdir(agentsHome, { recursive: true });
  await prepareExternalSkill(agentsHome, externalSkillName);
  await mkdir(artifactRoot, { recursive: true });

  const environment = {
    ...process.env,
    HOME: agentsHome,
    USERPROFILE: agentsHome,
    DSH_HOME: dshHome,
    DSH_AGENTS_HOME: agentsHome,
    DSH_DESKTOP_USERDATA: userData,
    DSH_DESKTOP_SKIP_AUTO_UPDATE: "1",
    DSH_DESKTOP_SKIP_CLIENT_UPDATE: "1",
    DSH_DESKTOP_TEST: "1",
    DSH_DESKTOP_TEST_DIR: testRoot,
    DSH_DESKTOP_TEST_STABILITY_MS: "1000",
    DSH_DESKTOP_DEBUG: "1",
    DSM_V038_UI_GATE: "1"
  };
  delete environment.NODE_OPTIONS;
  delete environment.ELECTRON_RUN_AS_NODE;
  await launchDesktop(environment, userData, 1);
  await openSkillManager();
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === 'Skill 市场');
    if (!button) throw new Error('Skill 市场 tab not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `document.body.innerText.includes('GitHub 近期热度 Skill 候选') || Boolean(document.querySelector('.dsm-error'))`,
    30_000,
    "historical-popularity repository market home"
  );
  const marketControls = await evaluate(`(() => {
    const sortGroup = document.querySelector('[role="group"][aria-label="市场排序"]');
    const sortLabels = sortGroup ? Array.from(sortGroup.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '') : [];
    const installButton = document.querySelector('.dsm-market-install');
    const installBounds = installButton instanceof HTMLElement ? installButton.getBoundingClientRect() : null;
    return {
      sortLabels,
      installButton: installBounds ? { width: installBounds.width, height: installBounds.height } : null
    };
  })()`);
  assert.deepEqual(
    marketControls.sortLabels,
    ["近期热度榜", "历史热门", "最新", "相关度"],
    "market must expose the protocol 3 repository sorts"
  );
  if (marketControls.installButton !== null) {
    assert.ok(marketControls.installButton.width >= 82, "repository install action must expose a larger click target");
    assert.ok(marketControls.installButton.height >= 36, "repository install action must expose a larger click target");
  }
  const repositoryActionAvailable = await evaluate(`(() => {
    const install = document.querySelector('.dsm-market-install');
    if (!(install instanceof HTMLButtonElement)) return false;
    install.click();
    return true;
  })()`);
  if (repositoryActionAvailable) {
    await waitForRenderer(
      () => `Boolean(document.querySelector('.dsm-install-dialog'))`,
      5_000,
      "repository install dialog render"
    );
  }
  const repositoryDialog = repositoryActionAvailable ? await evaluate(`(() => {
    const dialog = document.querySelector('.dsm-install-dialog');
    const backdrop = dialog?.parentElement;
    if (!(dialog instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return { opened: false };
    const bounds = dialog.getBoundingClientRect();
    return {
      opened: true,
      portalParentIsBody: backdrop.parentElement === document.body,
      loadingVisible: backdrop.innerText.includes('正在检查仓库'),
      width: bounds.width,
      height: bounds.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    };
  })()`) : null;
  if (repositoryDialog !== null) {
    assert.equal(repositoryDialog.opened, true, "repository action must open its install dialog immediately");
    assert.equal(repositoryDialog.portalParentIsBody, true, "repository dialog must escape the settings container through document.body");
    assert.equal(repositoryDialog.loadingVisible, true, "repository dialog must show its loading state before Inspection finishes");
    assert.ok(repositoryDialog.width >= Math.min(640, repositoryDialog.viewportWidth - 40), "desktop repository dialog must use the enlarged review surface");
    await evaluate(`(() => {
      const close = document.querySelector('button[aria-label="关闭安装确认"]');
      if (close instanceof HTMLButtonElement) close.click();
      return true;
    })()`);
  }
  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="搜索 GitHub Skill 仓库"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Market search input not found');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'writing');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = input.closest('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('Market search form not found');
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    return true;
  })()`);
  const keywordSearchSettled = await settleOrRecord(
    () => `!document.body.innerText.includes('正在搜索仓库...') && (document.body.innerText.includes('GitHub 搜索结果') || document.body.innerText.includes('没有找到匹配的仓库') || Boolean(document.querySelector('.dsm-error')))` ,
    15_000,
    "GitHub repository keyword-search result"
  );
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '安全与合规');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Security category button not found');
    button.click();
    return true;
  })()`);
  const categorySearchSettled = await settleOrRecord(
    () => `!document.body.innerText.includes('正在搜索仓库...') && (document.body.innerText.includes('搜索: security compliance skill') || document.body.innerText.includes('该分类暂未搜到 Skill 仓库') || document.body.innerText.includes('当前趋势榜没有该分类候选') || Boolean(document.querySelector('.dsm-error')))` ,
    15_000,
    "GitHub repository category-search result"
  );
  const summary = await evaluate(`(async () => ({
    url: location.href,
    title: document.title,
    skillClientResponse: await fetch('/plugins/dsh-skill-manager/client.js').then(async (response) => ({
      status: response.status,
      contentType: response.headers.get('content-type'),
      prefix: (await response.text()).slice(0, 160)
    })).catch((error) => ({ error: String(error) })),
    skillResources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /skill-manager/iu.test(name)),
    bootEntries: window.__DSH_BOOT__?.entries || [],
    moduleLoaderKeys: Object.keys(window.__ModuleLoader__ || {}),
    moduleLoaderProperties: Object.getOwnPropertyNames(window.__ModuleLoader__ || {}),
    sidebarSkillIcon: (() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === 'Skill 管理');
      const icon = button?.querySelector('[data-dsh-skill-manager-sidebar-icon]');
      if (!(icon instanceof SVGElement)) return null;
      const style = getComputedStyle(icon);
      const bounds = icon.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height, cssWidth: style.width, cssHeight: style.height };
    })(),
    categorySearch: (() => {
      const security = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '安全与合规');
      return {
        selected: security?.getAttribute('aria-pressed') === 'true',
        resultCount: document.querySelectorAll('.dsm-repository-row').length,
        hasRemoteQuerySignal: document.body.innerText.includes('搜索: security compliance skill'),
        hasExplicitEmptyState: document.body.innerText.includes('该分类暂未搜到 Skill 仓库') || document.body.innerText.includes('当前趋势榜没有该分类候选'),
        error: document.querySelector('.dsm-error')?.textContent?.trim() ?? null,
        keywordSearchSettled: ${keywordSearchSettled ? "true" : "false"},
        categorySearchSettled: ${categorySearchSettled ? "true" : "false"}
      };
    })(),
    bodyText: document.body.innerText.slice(0, 12000),
    controls: Array.from(document.querySelectorAll('button, a, [role="tab"], input, textarea, [contenteditable="true"]')).slice(0, 300).map((element) => ({
      tag: element.tagName,
      role: element.getAttribute('role'),
      text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 180),
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      type: element.getAttribute('type'),
      className: typeof element.className === 'string' ? element.className.slice(0, 180) : ''
    }))
  }))()`);
  await writeFile(join(artifactRoot, "probe.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    url: summary.url,
    title: summary.title,
    skillClientResponse: summary.skillClientResponse,
    skillResources: summary.skillResources,
    skillBootEntry: summary.bootEntries.find((entry) => entry.id === "dsh-skill-manager"),
    moduleLoaderKeys: summary.moduleLoaderKeys,
    moduleLoaderProperties: summary.moduleLoaderProperties,
    sidebarSkillIcon: summary.sidebarSkillIcon,
    categorySearch: summary.categorySearch,
    controls: summary.controls,
    bodyText: summary.bodyText
  }, null, 2));
  if (!probeOnly) {
    assert.equal(summary.skillClientResponse.status, 200, "v0.3.8 must serve the Skill Manager client bundle");
    assert.ok(
      summary.bootEntries.some((entry) => entry.id === "dsh-skill-manager"),
      "v0.3.8 boot manifest must include the Skill Manager client"
    );
    assert.match(summary.bodyText, /Skill 管理/u, "real v0.3.8 shell must expose Skill Manager navigation");
    assert.match(summary.bodyText, /Skill 市场/u, "Skill Manager must expose the separate Market area");
    assert.ok(
      summary.controls.some((control) => control.placeholder === "搜索 GitHub Skill 仓库"),
      "Market area must expose a clearly labeled GitHub repository search input"
    );
    assert.match(summary.bodyText, /GitHub 元数据候选/u, "Skill Manager Market must expose the GitHub repository discovery boundary");
    assert.match(summary.bodyText, /全部分类/u, "Skill Manager Market must expose GitHub category controls");
    if (summary.categorySearch.categorySearchSettled) {
      assert.equal(summary.categorySearch.selected, true, "Security category must enter the selected state after user activation");
      assert.ok(
        summary.categorySearch.hasRemoteQuerySignal || summary.categorySearch.hasExplicitEmptyState || summary.categorySearch.error,
        "Security category must settle as a remote GitHub result, explicit empty result, or stable provider error"
      );
    } else {
      console.warn("[ui-gate] Skipping settled category assertions because the live GitHub request exceeded its bounded observation window.");
    }
    assert.deepEqual(summary.sidebarSkillIcon, {
      width: 16,
      height: 18,
      cssWidth: "16px",
      cssHeight: "18px"
    }, "Skill Manager settings row must keep the folded-file icon at 16 by 18 pixels");

    const skillName = "desktop-persistence-skill";
    const skillDescription = "Verify isolated Desktop restart persistence.";
    await createSelfAuthoredSkill(skillName, skillDescription);
    await setDshEnabled(skillName, true);
    const firstBootState = await inspectManagedState(dshHome, skillName);
    assert.equal(firstBootState.registryEnabled, true, "registry must persist DSH enablement before restart");
    assert.equal(firstBootState.activeResolvesToLibrary, true, "active DSH link must resolve to the managed library");

    await stopDesktop();
    await launchDesktop(environment, userData, 2);
    await openSkillManager();
    await waitForRenderer(
      () => `document.body.innerText.includes(${JSON.stringify(skillName)})`,
      30_000,
      "persisted Skill after restart"
    );
    const secondBootUi = await evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find((candidate) => candidate.textContent?.includes(${JSON.stringify(skillName)}));
      const checkbox = label?.querySelector('input[type="checkbox"]');
      return {
        bodyHasSkill: document.body.innerText.includes(${JSON.stringify(skillName)}),
        checkboxFound: Boolean(checkbox),
        checked: checkbox instanceof HTMLInputElement ? checkbox.checked : null
      };
    })()`);
    const secondBootState = await inspectManagedState(dshHome, skillName);
    assert.equal(secondBootUi.bodyHasSkill, true, "restarted Desktop must render the created Skill");
    assert.equal(secondBootUi.checkboxFound, true, "restarted Desktop must render the DSH enable switch");
    assert.equal(secondBootUi.checked, true, "restarted Desktop must restore the enabled switch state");
    assert.equal(secondBootState.registryEnabled, true, "registry must retain DSH enablement after restart");
    assert.equal(secondBootState.activeResolvesToLibrary, true, "active DSH link must survive restart");
    const denseList = await verifyDenseListAndUpdateStatus(skillName, skillDescription);
    await writeFile(join(artifactRoot, "persistence.json"), JSON.stringify({
      testRoot,
      skillName,
      firstBootState,
      secondBootUi,
      secondBootState,
      denseList
    }, null, 2) + "\n", "utf8");
    console.log(JSON.stringify({ persistence: { skillName, firstBootState, secondBootUi, secondBootState, denseList } }, null, 2));

    const synchronization = await verifySynchronization(agentsHome, dshHome, externalSkillName);
    await writeFile(
      join(artifactRoot, "synchronization.json"),
      JSON.stringify({ testRoot, externalSkillName, ...synchronization }, null, 2) + "\n",
      "utf8"
    );
    console.log(JSON.stringify({ synchronization }, null, 2));

    const deletionSkillName = "desktop-delete-skill";
    await createSelfAuthoredSkill(deletionSkillName, "Verify recoverable deletion in the isolated Desktop shell.");
    const deletion = await verifyRecoverableDeletion(dshHome, deletionSkillName);
    console.log(JSON.stringify({ deletion }, null, 2));

    const composer = await verifyComposer(workspacePath, skillName);
    await writeFile(
      join(artifactRoot, "composer.json"),
      JSON.stringify({ testRoot, workspacePath, skillName, ...composer }, null, 2) + "\n",
      "utf8"
    );
    console.log(JSON.stringify({ composer }, null, 2));

  }
} finally {
  clearTimeout(overallTimer);
  await stopDesktop();
  if (originalMain !== undefined) await writeFile(mainPath, originalMain, "utf8");
  if (originalClientRuntime !== undefined) {
    await writeFile(clientRuntimePath, originalClientRuntime, "utf8");
  }
}

async function launchDesktop(environment, userData, bootNumber) {
  assert.equal(child, undefined, "previous Desktop process must stop before restart");
  await Promise.all([
    rm(join(testRoot, "test-control.json"), { force: true }),
    rm(join(testRoot, "test-status.json"), { force: true })
  ]);
  const logPath = join(userData, "logs", "desktop.log");
  const logOffset = await fileSize(logPath);
  const output = [];
  child = spawn(electronPath, [mainPath, `--user-data-dir=${userData}`], {
    cwd: desktopRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => output.push(chunk));
  child.on("exit", () => writeFile(
    join(testRoot, `desktop-stdio-boot-${bootNumber}.log`),
    Buffer.concat(output)
  ).catch(() => undefined));
  console.log(`v0.3.8 UI gate boot=${bootNumber} pid=${child.pid} root=${testRoot}`);
  await waitForLogOccurrence(
    logPath,
    "boot-ready",
    1,
    logOffset,
    BOOT_TIMEOUT_MS
  );
}

async function stopDesktop() {
  const running = child;
  if (!running?.pid) {
    child = undefined;
    return;
  }
  try { await sendCommand("quit", undefined, 5_000); } catch {}
  await waitForExit(running, 5_000).catch(async () => {
    await killProcessTree(running.pid);
    await waitForExit(running, 5_000).catch(() => undefined);
  });
  child = undefined;
}

async function openSkillManager() {
  const alreadyOpen = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button[role="tab"]'))
      .find((candidate) => candidate.textContent?.trim() === 'Skill 管理');
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  })()`);
  if (alreadyOpen) {
    await waitForRenderer(
      () => `document.body.innerText.includes('Skill 管理') && document.body.innerText.includes('Skill 市场')`,
      10_000,
      "already-open Skill Manager views"
    );
    return;
  }
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '继续');
    if (button) button.click();
    return Boolean(button);
  })()`);
  await waitForRenderer(() => `Boolean(Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '设置'))`, 30_000, "settings trigger");
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '设置');
    if (!button) throw new Error('settings button not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(() => `document.body.innerText.includes('Skill 管理') || document.body.innerText.includes('通用设置')`, 30_000, "settings content");
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === 'Skill 管理');
    if (!button) throw new Error('Skill 管理 navigation entry not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `document.body.innerText.includes('Skill 管理') && document.body.innerText.includes('Skill 市场') && document.body.innerText.includes('全部') && document.body.innerText.includes('自设') && document.body.innerText.includes('同步')`,
    30_000,
    "Skill Manager views"
  );
}

async function createSelfAuthoredSkill(name, description) {
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.getAttribute('aria-label') === '新建 Skill');
    if (!button) throw new Error('new Skill button not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(() => `Boolean(document.querySelector('form.dsm-create input[name="name"]'))`, 10_000, "create Skill form");
  await evaluate(`(() => {
    const form = document.querySelector('form.dsm-create');
    const nameInput = form?.querySelector('input[name="name"]');
    const descriptionInput = form?.querySelector('input[name="description"]');
    if (!(form instanceof HTMLFormElement) || !(nameInput instanceof HTMLInputElement) || !(descriptionInput instanceof HTMLInputElement)) {
      throw new Error('create Skill inputs not found');
    }
    nameInput.value = ${JSON.stringify(name)};
    descriptionInput.value = ${JSON.stringify(description)};
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  await waitForRenderer(() => `document.body.innerText.includes(${JSON.stringify(name)})`, 30_000, "created Skill");
}

async function setDshEnabled(name, enabled) {
  await evaluate(`(() => {
    const label = Array.from(document.querySelectorAll('label')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(name)}));
    const checkbox = label?.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('DSH enable switch not found');
    if (checkbox.checked !== ${enabled}) checkbox.click();
    return checkbox.checked;
  })()`);
  await waitForRenderer(
    () => `(() => {
      const label = Array.from(document.querySelectorAll('label')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(name)}));
      const checkbox = label?.querySelector('input[type="checkbox"]');
      return checkbox instanceof HTMLInputElement && checkbox.checked === ${enabled};
    })()`,
    30_000,
    "DSH enable state"
  );
}

async function verifyDenseListAndUpdateStatus(name, description) {
  const row = await evaluate(`(() => {
    const item = Array.from(document.querySelectorAll('li')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(name)}));
    const copy = item?.querySelector('.dsm-skill-copy p');
    const copyRegion = item?.querySelector('.dsm-skill-copy');
    const icon = item?.querySelector('.dsm-skill-icon svg');
    const actions = item?.querySelector('.dsm-skill-actions');
    const checkbox = Array.from(item?.querySelectorAll('label') ?? [])
      .find((candidate) => candidate.textContent?.includes(${JSON.stringify(`在 DSH 中启用 ${name}`)}))
      ?.querySelector('input[type="checkbox"]');
    return {
      found: item instanceof HTMLLIElement,
      description: copy?.textContent?.trim() ?? null,
      title: copy?.getAttribute('title') ?? null,
      icon: icon instanceof SVGElement,
      toggle: checkbox instanceof HTMLInputElement,
      layout: (() => {
        if (!(copyRegion instanceof HTMLElement) || !(icon instanceof SVGElement) || !(actions instanceof HTMLElement)) return null;
        const copyBounds = copyRegion.getBoundingClientRect();
        const iconBounds = icon.getBoundingClientRect();
        const actionBounds = actions.getBoundingClientRect();
        return {
          copyWidth: copyBounds.width,
          copyLeft: copyBounds.left,
          copyRight: copyBounds.right,
          copyBottom: copyBounds.bottom,
          iconRight: iconBounds.right,
          iconTop: iconBounds.top,
          actionsLeft: actionBounds.left,
          actionsTop: actionBounds.top,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth
        };
      })()
    };
  })()`);
  const { layout, ...content } = row;
  assert.deepEqual(content, {
    found: true,
    description,
    title: description,
    icon: true,
    toggle: true
  }, "real v0.3.8 list must preserve the dense Skill row, full tooltip, shared file icon, and switch");
  assert.ok(layout, "real v0.3.8 list must expose measurable content and action regions");
  const actionsShareRow = Math.abs(layout.actionsTop - layout.iconTop) <= 36
    && layout.actionsLeft >= layout.copyRight - 1;
  const actionsAreDeliberatelyStacked = layout.actionsTop >= layout.copyBottom
    && layout.actionsLeft >= layout.copyLeft - 1;
  assert.ok(layout.copyWidth >= 180, `Skill copy region is unexpectedly narrow: ${JSON.stringify(layout)}`);
  assert.ok(layout.copyLeft >= layout.iconRight, `Skill copy overlaps its icon: ${JSON.stringify(layout)}`);
  assert.ok(actionsShareRow || actionsAreDeliberatelyStacked, `Skill actions overlap or occupy an unintended grid cell: ${JSON.stringify(layout)}`);
  assert.equal(layout.horizontalOverflow, 0, `Skill list must not create horizontal viewport overflow: ${JSON.stringify(layout)}`);
  const maintenanceControls = await evaluate(`(() => ({
    autoMatch: Array.from(document.querySelectorAll('label')).some((label) => label.textContent?.includes('自动匹配来源') && label.querySelector('input[type="checkbox"]')),
    autoCheck: Array.from(document.querySelectorAll('label')).some((label) => label.textContent?.includes('自动检查更新') && label.querySelector('input[type="checkbox"]')),
    autoUpdate: Array.from(document.querySelectorAll('label')).some((label) => label.textContent?.includes('自动更新') && label.querySelector('input[type="checkbox"]')),
    rematchAll: Boolean(document.querySelector('button[aria-label="一键全部重匹配"]')),
    synchronize: Boolean(document.querySelector('button[aria-label="同步到其他工具"]')),
    recentDeletion: Boolean(document.querySelector('.dsm-trash-toggle'))
  }))()`);
  assert.deepEqual(maintenanceControls, {
    autoMatch: false,
    autoCheck: true,
    autoUpdate: true,
    rematchAll: false,
    synchronize: true,
    recentDeletion: true
  }, "real v0.3.8 shell must hide local provenance matching while preserving trusted update maintenance, synchronization, and recent deletion");

  await evaluate(`(() => {
    const label = Array.from(document.querySelectorAll('label')).find((candidate) => candidate.textContent?.includes('自动检查更新'));
    const checkbox = label?.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('automatic update check option not found');
    checkbox.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `document.body.innerText.includes('不支持远程更新')`,
    30_000,
    "packaged update status"
  );
  const update = await evaluate(`(() => ({
    status: Array.from(document.querySelectorAll('.dsm-update-state')).find((candidate) => candidate.closest('li')?.textContent?.includes(${JSON.stringify(name)}))?.textContent?.trim() ?? null,
    updateButton: Boolean(document.querySelector(${JSON.stringify(`button[aria-label="更新 ${name}"]`)}))
  }))()`);
  assert.deepEqual(update, { status: "不支持远程更新", updateButton: false }, "local Skills must not expose an unsafe overwrite action after update checks");
  return { ...row, maintenanceControls, updateStatus: update.status, updateButton: update.updateButton };
}

async function verifyRecoverableDeletion(dshHome, name) {
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button[role="tab"]'))
      .find((candidate) => candidate.textContent?.trim() === '全部');
    if (!(button instanceof HTMLButtonElement)) throw new Error('All Skills tab not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `Boolean(document.querySelector(${JSON.stringify(`button[aria-label="删除 ${name}"]`)}))`,
    10_000,
    "delete action"
  );
  await evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(`button[aria-label="删除 ${name}"]`)});
    if (!(button instanceof HTMLButtonElement)) throw new Error('delete action not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `Boolean(document.querySelector(${JSON.stringify(`button[aria-label="确认删除 ${name}"]`)}))`,
    10_000,
    "delete confirmation"
  );
  await evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(`button[aria-label="确认删除 ${name}"]`)});
    if (!(button instanceof HTMLButtonElement)) throw new Error('delete confirmation not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `!Array.from(document.querySelectorAll('.dsm-skill-item')).some((item) => item.textContent?.includes(${JSON.stringify(name)}))`,
    30_000,
    "deleted Skill removal"
  );
  const registry = JSON.parse(await readFile(join(dshHome, "skill-manager", "registry.json"), "utf8"));
  assert.equal(registry.skills[name], undefined, "deleted Skill must leave the active registry");
  const trashRoot = join(dshHome, "skill-manager", "trash", name);
  const trashIds = await readdir(trashRoot);
  assert.equal(trashIds.length, 1, "deleted Skill must create one recoverable trash snapshot");
  const skillDocument = await readFile(join(trashRoot, trashIds[0], "bundle", "SKILL.md"), "utf8");
  assert.match(skillDocument, new RegExp(`name: ${name}`, "u"), "trash snapshot must preserve the complete Skill bundle");
  await evaluate(`(() => {
    const toggle = document.querySelector('.dsm-trash-toggle');
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('recent deletion toggle not found');
    toggle.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `Array.from(document.querySelectorAll('.dsm-trash li')).some((item) => item.textContent?.includes(${JSON.stringify(name)}))`,
    10_000,
    "recent deletion row"
  );
  await evaluate(`(() => {
    const item = Array.from(document.querySelectorAll('.dsm-trash li')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(name)}));
    const button = item?.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('restore deletion action not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `Array.from(document.querySelectorAll('.dsm-skill-item')).some((item) => item.textContent?.includes(${JSON.stringify(name)}))`,
    30_000,
    "restored Skill row"
  );
  const restoredRegistry = JSON.parse(await readFile(join(dshHome, "skill-manager", "registry.json"), "utf8"));
  assert.ok(restoredRegistry.skills[name], "restored Skill must return to the active registry");
  await access(join(dshHome, "skill-manager", "library", name, "SKILL.md"));
  return { name, trashId: trashIds[0], registryRemoved: true, bundlePreserved: true, restored: true };
}

async function prepareExternalSkill(agentsHome, name) {
  const codexRoot = join(agentsHome, ".codex", "skills");
  const source = join(codexRoot, name);
  await mkdir(join(source, "references"), { recursive: true });
  await writeFile(join(source, "SKILL.md"), [
    "---",
    `name: ${name}`,
    "description: Verify isolated external Skill import and synchronization.",
    "---",
    "",
    "# External review helper",
    ""
  ].join("\n"), "utf8");
  await writeFile(join(source, "references", "checklist.md"), "# Verified checklist\n", "utf8");
  await writeFile(join(codexRoot, "AGENTS.md"), "DO_NOT_IMPORT_ADJACENT_AGENT_INSTRUCTIONS\n", "utf8");
}

async function verifySynchronization(agentsHome, dshHome, name) {
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '同步');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Sync tab not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `Boolean(document.querySelector('button[aria-label="扫描本机 Skill"]'))`,
    10_000,
    "external Skill scan action"
  );
  await evaluate(`(() => {
    const button = document.querySelector('button[aria-label="扫描本机 Skill"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('external Skill scan action not found');
    button.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `document.body.innerText.includes(${JSON.stringify(name)})`,
    30_000,
    "external Skill candidate"
  );
  await evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(`button[aria-label="导入 ${name}"]`)});
    if (!(button instanceof HTMLButtonElement)) throw new Error('external Skill import action not found');
    button.click();
    return true;
  })()`);
  const claudeToggleLabel = `同步 ${name} 到 Claude Code`;
  await waitForRenderer(
    () => `Boolean(document.querySelector(${JSON.stringify(`input[aria-label="${claudeToggleLabel}"]`)}))`,
    30_000,
    "imported Skill target states"
  );
  await evaluate(`(() => {
    const checkbox = document.querySelector(${JSON.stringify(`input[aria-label="${claudeToggleLabel}"]`)});
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('Claude synchronization toggle not found');
    if (!checkbox.checked) checkbox.click();
    return true;
  })()`);
  await waitForRenderer(
    () => `(() => {
      const checkbox = document.querySelector(${JSON.stringify(`input[aria-label="${claudeToggleLabel}"]`)});
      return checkbox instanceof HTMLInputElement && checkbox.checked;
    })()`,
    30_000,
    "Claude synchronization state"
  );

  const libraryPath = join(dshHome, "skill-manager", "library", name);
  const claudePath = join(agentsHome, ".claude", "skills", name);
  const [libraryResolved, claudeResolved, importedDocument, importedReference, adjacentInstruction] = await Promise.all([
    realpath(libraryPath),
    realpath(claudePath),
    readFile(join(libraryPath, "SKILL.md"), "utf8"),
    readFile(join(libraryPath, "references", "checklist.md"), "utf8"),
    readFile(join(agentsHome, ".codex", "skills", "AGENTS.md"), "utf8")
  ]);
  const adjacentImported = await access(join(libraryPath, "AGENTS.md")).then(() => true, () => false);
  assert.equal(normalizePath(claudeResolved), normalizePath(libraryResolved), "Claude target must resolve to the canonical imported Skill");
  assert.equal(adjacentImported, false, "adjacent AGENTS.md must not enter the imported Skill bundle");
  assert.doesNotMatch(importedDocument, /DO_NOT_IMPORT_ADJACENT_AGENT_INSTRUCTIONS/u);
  assert.equal(importedReference, "# Verified checklist\n");

  return {
    name,
    imported: true,
    claudeLinked: true,
    adjacentInstructionPreserved: adjacentInstruction.trim() === "DO_NOT_IMPORT_ADJACENT_AGENT_INSTRUCTIONS",
    adjacentInstructionImported: adjacentImported
  };
}

async function inspectManagedState(dshHome, name) {
  const managerRoot = join(dshHome, "skill-manager");
  const libraryPath = join(managerRoot, "library", name);
  const activePath = join(dshHome, "skills", name);
  const registry = JSON.parse(await readFile(join(managerRoot, "registry.json"), "utf8"));
  const entry = registry.skills?.[name];
  assert.ok(entry, `registry entry ${name} must exist`);
  const [libraryResolved, activeResolved] = await Promise.all([
    realpath(libraryPath),
    realpath(activePath)
  ]);
  return {
    registryEnabled: entry.enabledTargets?.includes("dsh") === true,
    libraryPath,
    activePath,
    activeResolvesToLibrary: normalizePath(activeResolved) === normalizePath(libraryResolved)
  };
}

async function verifyComposer(workspacePath, skillName) {
  await evaluate(`(async () => {
    const close = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '关闭');
    close?.click();
    const runtime = globalThis.__DSM_V038_UI_GATE_RUNTIME__;
    if (!runtime?.workspaces || !runtime?.sessions) throw new Error('UI-gate runtime services not found');
    const workspace = await runtime.workspaces.create({ path: ${JSON.stringify(workspacePath)} });
    const sessionId = await runtime.workspaces.connectWorkspace(workspace.workspaceId);
    runtime.sessions.open(sessionId);
    return { workspaceId: workspace.workspaceId, sessionId };
  })()`);
  await waitForRenderer(
    () => `(() => {
      const textarea = document.querySelector('textarea');
      return textarea instanceof HTMLTextAreaElement && !textarea.disabled && textarea.getAttribute('placeholder') !== '选择一个工作区开始';
    })()`,
    30_000,
    "active composer textarea"
  );

  await setComposerDraft("");
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.getAttribute('aria-label') === '命令');
    if (!(button instanceof HTMLButtonElement)) throw new Error('command launcher not found');
    button.click();
    return true;
  })()`);
  await waitForSuggestion("goal", "command launcher suggestions");
  await evaluate(`(() => {
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const option = options.find((candidate) => candidate.textContent?.includes('goal'));
    if (!(option instanceof HTMLElement)) throw new Error('goal command launcher option not found');
    option.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0
    }));
    return true;
  })()`);
  await delay(500);
  const commandLauncher = await composerSnapshot();
  assert.deepEqual(
    { draft: commandLauncher.draft, phase: commandLauncher.phase },
    { draft: "/goal ", phase: "claimed" },
    `native command launcher must preserve its claim behavior; snapshot=${JSON.stringify({
      commandLauncher,
      suggestions: await suggestionSnapshot()
    })}`
  );

  const firstDraft = "/";
  await setComposerDraft(firstDraft);
  await waitForSuggestion(skillName, "initial Skill slash suggestions");
  const first = await waitForSuggestion("goal", "initial command slash suggestions");

  const chainedDraft = `/${skillName} /`;
  await setComposerDraft(chainedDraft);
  const chained = await waitForSuggestion(skillName, "chained Skill slash suggestions");

  await setComposerDraft("/goal");
  const commandSpace = await pressComposerKey(" ", "Space");
  const commandSlash = await pressComposerKey("/", "Slash");
  const commandChainedDraft = "/goal /";
  const commandDraftSnapshot = await composerSnapshot();
  assert.equal(commandDraftSnapshot.draft, commandChainedDraft, "real Space and slash keys must preserve the command prefix chain");
  const commandChained = await waitForSuggestion(
    skillName,
    "chained command slash suggestions"
  );
  const commandAfterCommand = await waitForSuggestion(
    "goal",
    "command after command slash suggestions"
  );

  const bodyDraft = `/${skillName} Explain C:/work/file.ts and /`;
  await setComposerDraft(bodyDraft);
  await delay(750);
  const body = await suggestionSnapshot();
  assert.equal(body.open, false, "a slash after ordinary body text must not open suggestions");

  await setComposerDraft("/goal clear");
  const commandEnterKey = await pressComposerKey("Enter", "Enter");
  assert.equal(commandEnterKey.defaultPrevented, true, "native command Enter must be handled by the composer");
  await waitForRenderer(
    () => `(() => {
      const textarea = document.querySelector('textarea');
      return textarea instanceof HTMLTextAreaElement && textarea.value === '' && textarea.dataset.phase === 'plain';
    })()`,
    30_000,
    "native command Enter completion"
  );
  const commandEnter = await composerSnapshot();

  return {
    commandLauncher,
    initial: { draft: firstDraft, ...first },
    chained: { draft: chainedDraft, ...chained },
    commandChained: {
      draft: commandChainedDraft,
      space: commandSpace,
      slash: commandSlash,
      phase: commandDraftSnapshot.phase,
      ...commandChained,
      commandMatchingOptions: commandAfterCommand.matchingOptions
    },
    body: { draft: bodyDraft, ...body },
    commandEnter: {
      submittedDraft: "/goal clear",
      key: commandEnterKey,
      settled: commandEnter
    }
  };
}

async function setComposerDraft(draft) {
  await evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('composer textarea not found');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('native textarea value setter not found');
    setter.call(textarea, ${JSON.stringify(draft)});
    textarea.focus();
    textarea.setSelectionRange(${draft.length}, ${draft.length});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return textarea.value;
  })()`);
}

async function pressComposerKey(key, code) {
  return evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('composer textarea not found');
    textarea.focus();
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const event = new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      code: ${JSON.stringify(code)},
      bubbles: true,
      cancelable: true
    });
    const dispatched = textarea.dispatchEvent(event);
    if (dispatched && !event.defaultPrevented) {
      const next = textarea.value.slice(0, start) + ${JSON.stringify(key)} + textarea.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) throw new Error('native textarea value setter not found');
      setter.call(textarea, next);
      textarea.setSelectionRange(start + 1, start + 1);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return {
      defaultPrevented: event.defaultPrevented,
      draft: textarea.value,
      phase: textarea.dataset.phase ?? null
    };
  })()`);
}

async function composerSnapshot() {
  return evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('composer textarea not found');
    return {
      draft: textarea.value,
      phase: textarea.dataset.phase ?? null,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd
    };
  })()`);
}

async function waitForSuggestion(skillName, label) {
  let lastSnapshot;
  try {
    return await waitFor(async () => {
    const snapshot = await suggestionSnapshot();
      lastSnapshot = snapshot;
      return snapshot.open && snapshot.options.some((option) => option.includes(skillName))
        ? compactSuggestionSnapshot(snapshot, skillName)
        : undefined;
    }, 30_000, label);
  } catch (error) {
    throw new Error(`${label} failed with ${JSON.stringify(lastSnapshot)}`, { cause: error });
  }
}

function compactSuggestionSnapshot(snapshot, skillName) {
  return {
    open: snapshot.open,
    groups: snapshot.groups,
    optionCount: snapshot.options.length,
    matchingOptions: snapshot.options.filter((option) => option.includes(skillName))
  };
}

async function suggestionSnapshot() {
  return evaluate(`(() => {
    const listbox = document.querySelector('[role="listbox"][aria-label="触发候选建议"], [role="listbox"][aria-label="Trigger suggestions"]');
    return {
      open: Boolean(listbox),
      phase: document.querySelector('textarea')?.getAttribute('data-phase') ?? null,
      groups: listbox ? Array.from(listbox.querySelectorAll('[data-source]')).map((item) => item.textContent?.trim() ?? '') : [],
      options: listbox ? Array.from(listbox.querySelectorAll('[role="option"]')).map((item) => item.textContent?.trim() ?? '') : []
    };
  })()`);
}

function normalizePath(value) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

async function evaluate(source) {
  assert.equal(typeof source, "string");
  assert.ok(source.length <= 20_000);
  const status = await sendCommand("eval-main", { source }, COMMAND_TIMEOUT_MS);
  assert.equal(status.ok, true, `renderer evaluation failed: ${JSON.stringify(status.detail)}`);
  return status.detail;
}

async function waitForRenderer(source, timeoutMs, label) {
  return waitFor(async () => {
    const result = await evaluate(`(() => (${source()}))()`);
    return result ? true : undefined;
  }, timeoutMs, label);
}

async function settleOrRecord(source, timeoutMs, label) {
  try {
    await waitForRenderer(source, timeoutMs, label);
    return true;
  } catch (error) {
    if (overallController.signal.aborted) throw error;
    console.warn(`[ui-gate] ${label} did not settle: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function sendCommand(command, args, timeoutMs) {
  assert.ok(testRoot, "test root is not initialized");
  const id = `${command}-${++controlSequence}-${Date.now()}`;
  const controlPath = join(testRoot, "test-control.json");
  const statusPath = join(testRoot, "test-status.json");
  await writeFile(controlPath, JSON.stringify({ id, cmd: command, args }), "utf8");
  return waitFor(async () => {
    try {
      const status = JSON.parse(await readFile(statusPath, "utf8"));
      return status.id === id ? status : undefined;
    } catch {
      return undefined;
    }
  }, timeoutMs, `test command ${command}`);
}

function patchMainForUiGate(source) {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  let patched = replaceExactlyOnce(
    source,
    "function applySettingsSectionGuard() {",
    `function applySettingsSectionGuard() {${lineEnding}  const home = effectiveDshHome() || path.join(os.homedir(), '.dsh');`,
    "known v0.3.8 settings guard home bug"
  );
  patched = replaceExactly(
    patched,
    "    createWindow();",
    "    createWindow({ startHidden: process.env.DSM_V038_UI_GATE === '1' });",
    2,
    "hidden UI-gate window"
  );
  patched = replaceExactlyOnce(
    patched,
    `  const pageConsoleThrottle = new Map();${lineEnding}`,
    [
      "  const pageConsoleThrottle = new Map();",
      "  win.webContents.on('console-message', (event, legacyLevel, legacyMessage, legacyLine, legacySourceId) => {",
      "    const details = event && typeof event === 'object' ? event : null;",
      "    const level = details && details.level !== undefined ? details.level : legacyLevel;",
      "    const message = details && details.message !== undefined ? details.message : legacyMessage;",
      "    const line = details && details.lineNumber !== undefined ? details.lineNumber : legacyLine;",
      "    const sourceId = details && details.sourceId ? details.sourceId : legacySourceId;",
      "    log('ui-gate-page', `[${String(level)}] ${String(message || '')} (${String(sourceId || 'unknown')}:${String(line || 0)})`);",
      "  });",
      ""
    ].join(lineEnding),
    "renderer console evidence"
  );
  patched = replaceExactlyOnce(
    patched,
    `  const commands = {${lineEnding}`,
    [
      "  const commands = {",
      "    'eval-main': ({ source }) => {",
      "      if (!mainWindow || mainWindow.isDestroyed()) throw new Error('no main window');",
      "      if (typeof source !== 'string' || source.length > 20000) throw new Error('invalid eval source');",
      "      return mainWindow.webContents.executeJavaScript(source, true);",
      "    },",
      ""
    ].join(lineEnding),
    "bounded renderer evaluation command"
  );
  return patched;
}

function patchClientRuntimeForUiGate(source) {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const anchor = "\t\t\tconst workspaces = new WorkspaceRuntime(ctx, connection.api, sessions);";
  return replaceExactlyOnce(
    source,
    anchor,
    [
      anchor,
      "\t\t\tglobalThis.__DSM_V038_UI_GATE_RUNTIME__ = { workspaces, sessions };",
      "\t\t\tctx.effect(() => () => {",
      "\t\t\t\tif (globalThis.__DSM_V038_UI_GATE_RUNTIME__?.workspaces === workspaces) delete globalThis.__DSM_V038_UI_GATE_RUNTIME__;",
      "\t\t\t}, \"runtime: isolated UI-gate access\");"
    ].join(lineEnding),
    "isolated client runtime access"
  );
}

async function waitForLogOccurrence(path, needle, expectedCount, offset, timeoutMs) {
  return waitFor(async () => {
    if (child?.exitCode !== null) throw new Error(`Electron exited before ${needle}: ${child.exitCode}`);
    try {
      const content = (await readFile(path)).subarray(offset).toString("utf8");
      if (/\[(?:fatal|crash)\]/u.test(content)) throw new Error(content.slice(-5000));
      return content.split(needle).length - 1 >= expectedCount ? true : undefined;
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  }, timeoutMs, needle);
}

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

async function waitFor(operation, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (overallController.signal.aborted) throw overallController.signal.reason;
    const result = await operation();
    if (result !== undefined) return result;
    await delay(150);
  }
  throw new Error(`${label} exceeded ${timeoutMs} ms.`);
}

function run(executable, args, cwd, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const process = spawn(executable, args, { cwd, stdio: "inherit", windowsHide: true });
    const timer = setTimeout(() => {
      killProcessTree(process.pid).finally(() => rejectPromise(new Error(`${args[0]} exceeded ${timeoutMs} ms.`)));
    }, timeoutMs);
    process.once("error", (error) => { clearTimeout(timer); rejectPromise(error); });
    process.once("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolvePromise() : rejectPromise(new Error(`${args[0]} exited with code ${code}.`));
    });
  });
}

function waitForExit(process, timeoutMs) {
  if (process.exitCode !== null) return Promise.resolve();
  return Promise.race([
    new Promise((resolvePromise) => process.once("exit", resolvePromise)),
    delay(timeoutMs).then(() => { throw new Error("Electron shutdown timed out."); })
  ]);
}

function killProcessTree(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return Promise.resolve();
  return new Promise((resolvePromise) => {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolvePromise());
  });
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function replaceExactlyOnce(source, before, after, label) {
  return replaceExactly(source, before, after, 1, label);
}

function replaceExactly(source, before, after, expected, label) {
  const count = source.split(before).length - 1;
  assert.equal(count, expected, `${label}: expected ${expected} anchors, received ${count}`);
  return source.split(before).join(after);
}

async function assertFile(path, label) {
  try {
    assert.equal((await stat(path)).isFile(), true);
  } catch (error) {
    throw new Error(`Missing ${label}: ${path}`, { cause: error });
  }
}

function option(values, name) {
  const index = values.indexOf(name);
  return index < 0 ? undefined : values[index + 1];
}
