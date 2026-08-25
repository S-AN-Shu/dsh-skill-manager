import { strict as assert } from "node:assert";
import {
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_DESKTOP_VERSION = "0.3.8";
const EXPECTED_DSH_VERSION = "0.1.0-rc.6";
const PLUGIN_NAME = "dsh-skill-manager";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [command, ...args] = process.argv.slice(2);
if (command !== "stage" && command !== "verify") {
  fail("usage: node scripts/dsh-desktop-v038.mjs <stage|verify> --desktop <dsh-desktop-directory>");
}

const desktopArgument = option(args, "--desktop");
if (desktopArgument === undefined) fail("--desktop is required");
const desktopRoot = resolve(desktopArgument);

await verifyDesktopBaseline(desktopRoot);
if (command === "stage") {
  await stageBundle(desktopRoot);
  await patchDesktopSources(desktopRoot);
}
await verifyDesktopAdapter(desktopRoot);
console.log(`verified DSH Desktop v${EXPECTED_DESKTOP_VERSION} adapter at ${desktopRoot}`);

async function verifyDesktopBaseline(root) {
  const manifest = await readJson(join(root, "package.json"));
  assert.equal(
    manifest.version,
    EXPECTED_DESKTOP_VERSION,
    `expected DSH Desktop ${EXPECTED_DESKTOP_VERSION}, received ${String(manifest.version)}`
  );
  assert.equal(
    manifest.dependencies?.["@deepseek-ai/dsh"],
    EXPECTED_DSH_VERSION,
    `expected @deepseek-ai/dsh ${EXPECTED_DSH_VERSION}`
  );
  await assertFile(join(root, "main.js"));
  await assertFile(join(root, "scripts", "sync-companion-plugins.js"));
}

async function stageBundle(root) {
  const source = join(projectRoot, "packages", "plugin");
  const target = join(root, "assets", "plugins", PLUGIN_NAME);
  const temporary = `${target}.staging-${process.pid}`;
  const backup = `${target}.backup-${process.pid}`;

  await assertFile(join(source, "dist", "index.js"));
  await assertFile(join(source, "dist", "client.js"));
  await assertFile(join(source, "dist", "typert.host.js"));
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  await cp(join(source, "dist"), join(temporary, "dist"), { recursive: true });
  await cp(join(source, "package.json"), join(temporary, "package.json"));
  await cp(join(source, "cordis.patch.yml"), join(temporary, "cordis.patch.yml"));
  await cp(join(projectRoot, "LICENSE"), join(temporary, "LICENSE"));
  await cp(join(projectRoot, "README.md"), join(temporary, "README.md"));

  let replaced = false;
  try {
    if (await exists(target)) {
      const current = await readJson(join(target, "package.json"));
      assert.equal(current.name, PLUGIN_NAME, `refusing to replace non-${PLUGIN_NAME} asset directory`);
      await rm(backup, { recursive: true, force: true });
      await rename(target, backup);
      replaced = true;
    }
    await rename(temporary, target);
    if (replaced) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (replaced && !(await exists(target)) && await exists(backup)) await rename(backup, target);
    throw error;
  }
}

async function patchDesktopSources(root) {
  const mainPath = join(root, "main.js");
  const syncPath = join(root, "scripts", "sync-companion-plugins.js");
  const dependencyPatchPath = join(root, "scripts", "patch-deps.js");
  let main = await readFile(mainPath, "utf8");
  let sync = await readFile(syncPath, "utf8");
  let dependencyPatch = await readFile(dependencyPatchPath, "utf8");

  main = insertCompanion(main, "main.js");
  if (!main.includes("for (const sub of ['lib', 'assets', 'src', 'dist']) {")) {
    main = replaceExactlyOnce(
      main,
      "for (const sub of ['lib', 'assets', 'src']) {",
      "for (const sub of ['lib', 'assets', 'src', 'dist']) {",
      "main.js recursive plugin directory list"
    );
  }

  sync = insertCompanion(sync, "scripts/sync-companion-plugins.js");
  const lineEnding = sync.includes("\r\n") ? "\r\n" : "\n";
  const syncCopyAnchor = [
    "    for (const f of PLUGIN_FILES) {",
    "      const sf = path.join(src, f);",
    "      if (fs.existsSync(sf)) fs.copyFileSync(sf, path.join(dest, f));",
    "    }"
  ].join(lineEnding);
  const syncRecursiveCopy = [
    syncCopyAnchor,
    "    for (const sub of ['lib', 'assets', 'src', 'dist']) {",
    "      const sdir = path.join(src, sub);",
    "      if (fs.existsSync(sdir)) {",
    "        fs.cpSync(sdir, path.join(dest, sub), { recursive: true, force: true });",
    "      }",
    "    }"
  ].join(lineEnding);
  if (!sync.includes("for (const sub of ['lib', 'assets', 'src', 'dist']) {")) {
    sync = replaceExactlyOnce(
      sync,
      syncCopyAnchor,
      syncRecursiveCopy,
      "sync companion recursive plugin copy"
    );
  }

  dependencyPatch = patchLeadingSlashDependency(dependencyPatch);

  await writeFile(mainPath, main, "utf8");
  await writeFile(syncPath, sync, "utf8");
  await writeFile(dependencyPatchPath, dependencyPatch, "utf8");
}

async function verifyDesktopAdapter(root) {
  const asset = join(root, "assets", "plugins", PLUGIN_NAME);
  const manifest = await readJson(join(asset, "package.json"));
  assert.equal(manifest.name, PLUGIN_NAME);
  assert.equal(manifest.main, "dist/index.js");
  assert.equal(manifest.dsh?.bundle?.patch, "./cordis.patch.yml");
  assert.equal(manifest.dsh?.client?.platform, "web");
  assert.equal(
    manifest.exports?.["./package.json"],
    "./package.json",
    "v0.3.8 client modules resolve dsh.client through the package manifest export"
  );
  await assertFile(join(asset, "dist", "index.js"));
  await assertFile(join(asset, "dist", "client.js"));
  await assertFile(join(asset, "dist", "typert.host.js"));
  await assertFile(join(asset, "cordis.patch.yml"));

  const main = await readFile(join(root, "main.js"), "utf8");
  const sync = await readFile(join(root, "scripts", "sync-companion-plugins.js"), "utf8");
  const dependencyPatch = await readFile(join(root, "scripts", "patch-deps.js"), "utf8");
  const companion = `{ id: 'skill-manager', name: '${PLUGIN_NAME}' }`;
  assert.equal(count(main, companion), 1, "main.js must register the companion exactly once");
  assert.equal(count(sync, companion), 1, "sync script must register the companion exactly once");
  assert.equal(
    count(main, "for (const sub of ['lib', 'assets', 'src', 'dist']) {"),
    1,
    "main.js must recursively copy dist"
  );
  assert.equal(
    count(sync, "for (const sub of ['lib', 'assets', 'src', 'dist']) {"),
    1,
    "sync script must recursively copy dist"
  );
  assert.equal(
    count(dependencyPatch, "function patchLeadingSlashPrefix() {"),
    1,
    "patch-deps.js must define the leading slash patch exactly once"
  );
  assert.equal(
    count(dependencyPatch, "patchLeadingSlashPrefix();"),
    1,
    "patch-deps.js must apply the leading slash patch exactly once"
  );
  assert.equal(
    count(dependencyPatch, "leadingSlashHitOk(draft, raw.span.start, this.leadingPrefixNames"),
    1,
    "patch-deps.js must gate chained slashes through observed command/Skill names"
  );
  assert.equal(
    count(dependencyPatch, "this.prefixCandidateNames.set(source, new Set"),
    1,
    "patch-deps.js must cache official candidate names per session controller"
  );
  assert.equal(
    count(dependencyPatch, "  '\\t\\t\\t\\tthis.prefixCandidateNames.delete(source);',"),
    1,
    "patch-deps.js must clear names when an official candidate source is removed"
  );
  assert.equal(
    count(dependencyPatch, "'source.name === \"command\" && !launched'"),
    1,
    "patch-deps.js must require launcher-aware command claim deferral"
  );
}

function patchLeadingSlashDependency(source) {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const functionAnchor = "function main() {";
  const invocationAnchor = "main();";
  const definitionStart = "const slashTriggerTarget = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-input-trigger'";
  const block = [
    "const slashTriggerTarget = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-input-trigger', 'lib', 'client.js');",
    "const slashTriggerManifest = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-input-trigger', 'package.json');",
    "const SLASH_PREFIX_MARKER = 'prefixCandidateNames = /* @__PURE__ */ new Map();';",
    "const SLASH_PREFIX_LEGACY_MARKER = 'function leadingSlashHitOk(draft, index, names) {';",
    "const SLASH_PREFIX_REQUIRED_MARKERS = [",
    "  'this.leadingPrefixNames(\"/\")',",
    "  'this.prefixCandidateNames.delete(source);',",
    "  'this.prefixCandidateNames.clear();',",
    "  'hit.query === \"\" && hit.position === \"leading\"',",
    "  'execute(outcome, span, source, launched)',",
    "  'const sourcePosition = hit.trigger === \"/\" && hit.position === \"inline\" ? \"leading\" : hit.position;',",
    "  'source.name === \"command\" && !launched',",
    "  'this.execute(outcome, hit.span, src, false)'",
    "];",
    "const SLASH_PREFIX_OLD_LINES = [",
    "  '\\t\\tfunction boundaryOk(draft, index, char) {',",
    "  '\\t\\t\\tif (index === 0) return true;',",
    "  '\\t\\t\\tconst prev = draft.charAt(index - 1);',",
    "  '\\t\\t\\tif (WHITESPACE.test(prev)) return true;',",
    "  '\\t\\t\\tif (WORD_CHAR.test(prev)) return false;',",
    "  '\\t\\t\\tif (char === \"/\") {',",
    "  '\\t\\t\\t\\tif (prev === \"/\") return false;',",
    "  '\\t\\t\\t\\tif (prev === \":\" && index >= 2 && !WHITESPACE.test(draft.charAt(index - 2))) return false;',",
    "  '\\t\\t\\t}',",
    "  '\\t\\t\\treturn true;',",
    "  '\\t\\t}'",
    "];",
    "const SLASH_PREFIX_HELPER_LINES = [",
    "  '\\t\\tfunction leadingSlashHitOk(draft, index, names) {',",
    "  '\\t\\t\\tconst prefix = draft.slice(0, index);',",
    "  '\\t\\t\\tif (!/^\\\\s*(?:\\\\/[\\\\p{L}\\\\p{N}_-]+\\\\s+)*$/u.test(prefix)) return false;',",
    "  '\\t\\t\\tfor (const match of prefix.matchAll(/\\\\/([\\\\p{L}\\\\p{N}_-]+)\\\\s+/gu)) {',",
    "  '\\t\\t\\t\\tif (!names.includes(match[1] ?? \"\")) return false;',",
    "  '\\t\\t\\t}',",
    "  '\\t\\t\\treturn true;',",
    "  '\\t\\t}',",
    "  ''",
    "];",
    "const SLASH_TRACK_OLD_LINES = [",
    "  '\\t\\t\\t\\tconst raw = detectTrigger(draft, caret, guard);'",
    "];",
    "const SLASH_TRACK_LEGACY_LINES = [",
    "  '\\t\\t\\t\\tlet raw = detectTrigger(draft, caret, guard);',",
    "  '\\t\\t\\t\\tif (raw?.trigger === \"/\" && !leadingSlashHitOk(draft, raw.span.start, this.lexicon.getSnapshot().get(\"/\") ?? [])) raw = null;'",
    "];",
    "const SLASH_TRACK_NEW_LINES = [",
    "  '\\t\\t\\t\\tlet raw = detectTrigger(draft, caret, guard);',",
    "  '\\t\\t\\t\\tif (raw?.trigger === \"/\" && !leadingSlashHitOk(draft, raw.span.start, this.leadingPrefixNames(\"/\"))) raw = null;'",
    "];",
    "const SLASH_CACHE_FIELD_OLD_LINES = [",
    "  '\\t\\t\\tlexiconOffs = /* @__PURE__ */ new Map();'",
    "];",
    "const SLASH_CACHE_FIELD_NEW_LINES = [",
    "  ...SLASH_CACHE_FIELD_OLD_LINES,",
    "  '\\t\\t\\tprefixCandidateNames = /* @__PURE__ */ new Map();'",
    "];",
    "const SLASH_SOURCE_REMOVE_OLD_LINES = [",
    "  '\\t\\t\\t\\tthis.lexiconOffs.delete(source);',",
    "  '\\t\\t\\t\\tthis.refreshLexicon();'",
    "];",
    "const SLASH_SOURCE_REMOVE_NEW_LINES = [",
    "  '\\t\\t\\t\\tthis.lexiconOffs.delete(source);',",
    "  '\\t\\t\\t\\tthis.prefixCandidateNames.delete(source);',",
    "  '\\t\\t\\t\\tthis.refreshLexicon();'",
    "];",
    "const SLASH_DISPOSE_OLD_LINES = [",
    "  '\\t\\t\\t\\tfor (const off of this.lexiconOffs.values()) off();',",
    "  '\\t\\t\\t\\tthis.lexiconOffs.clear();'",
    "];",
    "const SLASH_DISPOSE_NEW_LINES = [",
    "  ...SLASH_DISPOSE_OLD_LINES,",
    "  '\\t\\t\\t\\tthis.prefixCandidateNames.clear();'",
    "];",
    "const SLASH_PREFIX_METHOD_ANCHOR = '\\t\\t\\t/** Re-poll every lexicon-bearing source and publish the aggregated rolls (see the store doc). */';",
    "const SLASH_PREFIX_METHOD_LINES = [",
    "  '\\t\\t\\tleadingPrefixNames(trigger) {',",
    "  '\\t\\t\\t\\tconst names = new Set(this.lexicon.getSnapshot().get(trigger) ?? []);',",
    "  '\\t\\t\\t\\tfor (const [source, cached] of this.prefixCandidateNames) {',",
    "  '\\t\\t\\t\\t\\tif (source.trigger !== trigger) continue;',",
    "  '\\t\\t\\t\\t\\tfor (const name of cached) names.add(name);',",
    "  '\\t\\t\\t\\t}',",
    "  '\\t\\t\\t\\treturn [...names];',",
    "  '\\t\\t\\t}',",
    "  ''",
    "];",
    "const SLASH_FETCH_SETTLED_OLD_LINES = [",
    "  '\\t\\t\\t\\t}).then((items) => {',",
    "  '\\t\\t\\t\\t\\tif (controller.signal.aborted) return;',",
    "  '\\t\\t\\t\\t\\tthis.reduce({'",
    "];",
    "const SLASH_FETCH_SETTLED_NEW_LINES = [",
    "  '\\t\\t\\t\\t}).then((items) => {',",
    "  '\\t\\t\\t\\t\\tif (controller.signal.aborted) return;',",
    "  '\\t\\t\\t\\t\\tconst names = items.map((item) => item.name).filter((name) => typeof name === \"string\" && name !== \"\");',",
    "  '\\t\\t\\t\\t\\tconst previous = hit.query === \"\" && hit.position === \"leading\" ? void 0 : this.prefixCandidateNames.get(source);',",
    "  '\\t\\t\\t\\t\\tthis.prefixCandidateNames.set(source, new Set(previous === void 0 ? names : [...previous, ...names]));',",
    "  '\\t\\t\\t\\t\\tthis.reduce({'",
    "];",
    "const SLASH_FETCH_POSITION_OLD_LINES = [",
    "  '\\t\\t\\t\\tconst projection = this.project();',",
    "  '\\t\\t\\t\\tfor (const source of roster) source.candidates(projection, {',",
    "  '\\t\\t\\t\\t\\tquery: hit.query,',",
    "  '\\t\\t\\t\\t\\tposition: hit.position,'",
    "];",
    "const SLASH_FETCH_POSITION_NEW_LINES = [",
    "  '\\t\\t\\t\\tconst projection = this.project();',",
    "  '\\t\\t\\t\\tconst sourcePosition = hit.trigger === \"/\" && hit.position === \"inline\" ? \"leading\" : hit.position;',",
    "  '\\t\\t\\t\\tfor (const source of roster) source.candidates(projection, {',",
    "  '\\t\\t\\t\\t\\tquery: hit.query,',",
    "  '\\t\\t\\t\\t\\tposition: sourcePosition,'",
    "];",
    "const SLASH_EXECUTE_CALL_OLD = 'this.execute(outcome, hit.span);';",
    "const SLASH_EXECUTE_CALL_NEW = 'this.execute(outcome, hit.span, src);';",
    "const SLASH_EXECUTE_SIGNATURE_OLD = 'execute(outcome, span) {';",
    "const SLASH_EXECUTE_SIGNATURE_NEW = 'execute(outcome, span, source) {';",
    "const SLASH_CLAIM_EXECUTE_OLD_LINES = [",
    "  '\t\t\t\tif (\"claim\" in outcome) return actx.bail(actx, \"slash/input-begin-command\", {',",
    "  '\t\t\t\t\tclaim: outcome.claim,',",
    "  '\t\t\t\t\tspan',",
    "  '\t\t\t\t}) === true;'",
    "];",
    "const SLASH_CLAIM_EXECUTE_GENERAL_LINES = [",
    "  '\t\t\t\tif (\"claim\" in outcome) return actx.bail(actx, \"slash/input-insert-text\", {',",
    "  '\t\t\t\t\ttext: outcome.claim.token,',",
    "  '\t\t\t\t\tspan',",
    "  '\t\t\t\t}) === true;'",
    "];",
    "const SLASH_CLAIM_EXECUTE_SCOPED_LINES = [",
    "  '\t\t\t\tif (\"claim\" in outcome && source.trigger === \"/\" && source.name === \"command\") return actx.bail(actx, \"slash/input-insert-text\", {',",
    "  '\t\t\t\t\ttext: outcome.claim.token,',",
    "  '\t\t\t\t\tspan',",
    "  '\t\t\t\t}) === true;',",
    "  ...SLASH_CLAIM_EXECUTE_OLD_LINES",
    "];",
    "const SLASH_LAUNCHER_PICK_OLD_LINES = [",
    "  '\t\t\t\tthis.stopFetch();',",
    "  '\t\t\t\tthis.reduce({ type: \"close\" });',",
    "  '\t\t\t\tthis.execute(outcome, hit.span, src);'",
    "];",
    "const SLASH_LAUNCHER_PICK_NEW_LINES = [",
    "  '\t\t\t\tconst launched = this.launcher.getSnapshot() !== null;',",
    "  '\t\t\t\tthis.stopFetch();',",
    "  '\t\t\t\tthis.reduce({ type: \"close\" });',",
    "  '\t\t\t\tthis.execute(outcome, hit.span, src, launched);'",
    "];",
    "const SLASH_LAUNCHER_SPACE_OLD = 'return this.execute(outcome, hit.span, src);';",
    "const SLASH_LAUNCHER_SPACE_NEW = 'return this.execute(outcome, hit.span, src, false);';",
    "const SLASH_LAUNCHER_SIGNATURE_OLD = 'execute(outcome, span, source) {';",
    "const SLASH_LAUNCHER_SIGNATURE_NEW = 'execute(outcome, span, source, launched) {';",
    "const SLASH_LAUNCHER_CLAIM_OLD = 'if (\"claim\" in outcome && source.trigger === \"/\" && source.name === \"command\") return actx.bail';",
    "const SLASH_LAUNCHER_CLAIM_NEW = 'if (\"claim\" in outcome && source.trigger === \"/\" && source.name === \"command\" && !launched) return actx.bail';",
    "",
    "function patchLeadingSlashPrefix() {",
    "  if (!fs.existsSync(slashTriggerTarget) || !fs.existsSync(slashTriggerManifest)) {",
    "    throw new Error('[patch-deps] missing dsh-client-ui-input-trigger 0.1.0-rc.6');",
    "  }",
    "  const manifest = JSON.parse(fs.readFileSync(slashTriggerManifest, 'utf8'));",
    "  if (manifest.version !== '0.1.0-rc.6') {",
    "    throw new Error(`[patch-deps] expected dsh-client-ui-input-trigger 0.1.0-rc.6, received ${String(manifest.version)}`);",
    "  }",
    "  let src = fs.readFileSync(slashTriggerTarget, 'utf8');",
    "  const lineEnding = src.includes('\\r\\n') ? '\\r\\n' : '\\n';",
    "  const oldClaim = SLASH_CLAIM_EXECUTE_OLD_LINES.join(lineEnding);",
    "  const generalClaim = SLASH_CLAIM_EXECUTE_GENERAL_LINES.join(lineEnding);",
    "  const scopedClaim = SLASH_CLAIM_EXECUTE_SCOPED_LINES.join(lineEnding);",
    "  if (src.includes(SLASH_PREFIX_MARKER)) {",
    "    src = patchLeadingPrefixCandidatePosition(src, lineEnding);",
    "    src = patchCommandClaimDeferral(src, oldClaim, generalClaim, scopedClaim);",
    "    src = patchCommandLauncherIsolation(src, lineEnding);",
    "    const missing = SLASH_PREFIX_REQUIRED_MARKERS.filter((marker) => !src.includes(marker));",
    "    if (missing.length > 0) throw new Error(`[patch-deps] incomplete leading slash prefix patch: ${missing.join(', ')}`);",
    "    fs.writeFileSync(slashTriggerTarget, src);",
    "    console.log('[patch-deps] leading command/Skill prefix authoring patch already applied');",
    "    return;",
    "  }",
    "  const legacy = src.includes(SLASH_PREFIX_LEGACY_MARKER);",
    "  if (!legacy) {",
    "    const oldBoundary = SLASH_PREFIX_OLD_LINES.join(lineEnding);",
    "    const boundaryOccurrences = src.split(oldBoundary).length - 1;",
    "    if (boundaryOccurrences !== 1) {",
    "      throw new Error(`[patch-deps] expected one rc.6 slash boundary, received ${boundaryOccurrences}`);",
    "    }",
    "    src = src.replace(oldBoundary, SLASH_PREFIX_HELPER_LINES.join(lineEnding) + oldBoundary);",
    "  }",
    "  const oldTrack = (legacy ? SLASH_TRACK_LEGACY_LINES : SLASH_TRACK_OLD_LINES).join(lineEnding);",
    "  const trackOccurrences = src.split(oldTrack).length - 1;",
    "  if (trackOccurrences !== 1) {",
    "    throw new Error(`[patch-deps] expected one rc.6 trigger track call, received ${trackOccurrences}`);",
    "  }",
    "  src = src.replace(oldTrack, SLASH_TRACK_NEW_LINES.join(lineEnding));",
    "  const replacements = [",
    "    [SLASH_CACHE_FIELD_OLD_LINES, SLASH_CACHE_FIELD_NEW_LINES, 'candidate cache field'],",
    "    [SLASH_SOURCE_REMOVE_OLD_LINES, SLASH_SOURCE_REMOVE_NEW_LINES, 'source removal cache cleanup'],",
    "    [SLASH_DISPOSE_OLD_LINES, SLASH_DISPOSE_NEW_LINES, 'controller cache cleanup'],",
    "    [SLASH_FETCH_SETTLED_OLD_LINES, SLASH_FETCH_SETTLED_NEW_LINES, 'candidate cache update'],",
    "    [SLASH_FETCH_POSITION_OLD_LINES, SLASH_FETCH_POSITION_NEW_LINES, 'leading-prefix candidate position']",
    "  ];",
    "  for (const [beforeLines, afterLines, label] of replacements) {",
    "    const before = beforeLines.join(lineEnding);",
    "    const occurrences = src.split(before).length - 1;",
    "    if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 ${label}, received ${occurrences}`);",
    "    src = src.replace(before, afterLines.join(lineEnding));",
    "  }",
    "  const methodOccurrences = src.split(SLASH_PREFIX_METHOD_ANCHOR).length - 1;",
    "  if (methodOccurrences !== 1) {",
    "    throw new Error(`[patch-deps] expected one rc.6 prefix method anchor, received ${methodOccurrences}`);",
    "  }",
    "  src = src.replace(SLASH_PREFIX_METHOD_ANCHOR, SLASH_PREFIX_METHOD_LINES.join(lineEnding) + SLASH_PREFIX_METHOD_ANCHOR);",
    "  src = patchCommandClaimDeferral(src, oldClaim, generalClaim, scopedClaim);",
    "  src = patchCommandLauncherIsolation(src, lineEnding);",
    "  const missing = SLASH_PREFIX_REQUIRED_MARKERS.filter((marker) => !src.includes(marker));",
    "  if (missing.length > 0) throw new Error(`[patch-deps] incomplete leading slash prefix patch: ${missing.join(', ')}`);",
    "  fs.writeFileSync(slashTriggerTarget, src);",
    "  console.log('[patch-deps] patched leading command/Skill prefix authoring');",
    "}",
    "function patchLeadingPrefixCandidatePosition(src, lineEnding) {",
    "  const before = SLASH_FETCH_POSITION_OLD_LINES.join(lineEnding);",
    "  const after = SLASH_FETCH_POSITION_NEW_LINES.join(lineEnding);",
    "  if (src.includes(after)) return src;",
    "  const occurrences = src.split(before).length - 1;",
    "  if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 leading-prefix candidate position, received ${occurrences}`);",
    "  return src.replace(before, after);",
    "}",
    "function patchCommandClaimDeferral(src, oldClaim, generalClaim, scopedClaim) {",
    "  if (src.includes(SLASH_LAUNCHER_SIGNATURE_NEW) && src.includes(SLASH_LAUNCHER_CLAIM_NEW)) return src;",
    "  if (!src.includes(SLASH_EXECUTE_CALL_NEW)) {",
    "    const callOccurrences = src.split(SLASH_EXECUTE_CALL_OLD).length - 1;",
    "    if (callOccurrences !== 2) throw new Error(`[patch-deps] expected two rc.6 outcome execute calls, received ${callOccurrences}`);",
    "    src = src.split(SLASH_EXECUTE_CALL_OLD).join(SLASH_EXECUTE_CALL_NEW);",
    "  }",
    "  if (!src.includes(SLASH_EXECUTE_SIGNATURE_NEW)) {",
    "    const signatureOccurrences = src.split(SLASH_EXECUTE_SIGNATURE_OLD).length - 1;",
    "    if (signatureOccurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 outcome execute signature, received ${signatureOccurrences}`);",
    "    src = src.replace(SLASH_EXECUTE_SIGNATURE_OLD, SLASH_EXECUTE_SIGNATURE_NEW);",
    "  }",
    "  if (!src.includes(scopedClaim)) {",
    "    const before = src.includes(generalClaim) ? generalClaim : oldClaim;",
    "    const claimOccurrences = src.split(before).length - 1;",
    "    if (claimOccurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 command claim executor, received ${claimOccurrences}`);",
    "    src = src.replace(before, scopedClaim);",
    "  }",
    "  return src;",
    "}",
    "function patchCommandLauncherIsolation(src, lineEnding) {",
    "  const oldPick = SLASH_LAUNCHER_PICK_OLD_LINES.join(lineEnding);",
    "  const newPick = SLASH_LAUNCHER_PICK_NEW_LINES.join(lineEnding);",
    "  if (!src.includes(newPick)) {",
    "    const occurrences = src.split(oldPick).length - 1;",
    "    if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 launcher pick executor, received ${occurrences}`);",
    "    src = src.replace(oldPick, newPick);",
    "  }",
    "  if (!src.includes(SLASH_LAUNCHER_SPACE_NEW)) {",
    "    const occurrences = src.split(SLASH_LAUNCHER_SPACE_OLD).length - 1;",
    "    if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 Space executor, received ${occurrences}`);",
    "    src = src.replace(SLASH_LAUNCHER_SPACE_OLD, SLASH_LAUNCHER_SPACE_NEW);",
    "  }",
    "  if (!src.includes(SLASH_LAUNCHER_SIGNATURE_NEW)) {",
    "    const occurrences = src.split(SLASH_LAUNCHER_SIGNATURE_OLD).length - 1;",
    "    if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 launcher-aware execute signature, received ${occurrences}`);",
    "    src = src.replace(SLASH_LAUNCHER_SIGNATURE_OLD, SLASH_LAUNCHER_SIGNATURE_NEW);",
    "  }",
    "  if (!src.includes(SLASH_LAUNCHER_CLAIM_NEW)) {",
    "    const occurrences = src.split(SLASH_LAUNCHER_CLAIM_OLD).length - 1;",
    "    if (occurrences !== 1) throw new Error(`[patch-deps] expected one rc.6 command claim condition, received ${occurrences}`);",
    "    src = src.replace(SLASH_LAUNCHER_CLAIM_OLD, SLASH_LAUNCHER_CLAIM_NEW);",
    "  }",
    "  return src;",
    "}",
    ""
  ].join(lineEnding);

  const existingStart = source.indexOf(definitionStart);
  let patched = source;
  if (existingStart >= 0) {
    const existingEnd = source.indexOf(functionAnchor, existingStart);
    assert.notEqual(existingEnd, -1, "patch-deps.js existing leading slash block must end before main");
    patched = source.slice(0, existingStart) + block + source.slice(existingEnd);
  } else {
    patched = replaceExactlyOnce(
      source,
      functionAnchor,
      `${block}${functionAnchor}`,
      "patch-deps.js leading slash patch definition"
    );
  }
  if (!patched.includes("patchLeadingSlashPrefix();")) {
    patched = replaceExactlyOnce(
      patched,
      invocationAnchor,
      `patchLeadingSlashPrefix();${lineEnding}${invocationAnchor}`,
      "patch-deps.js leading slash patch invocation"
    );
  }
  return patched;
}

function insertCompanion(source, label) {
  const entry = `  { id: 'skill-manager', name: '${PLUGIN_NAME}' },`;
  if (source.includes(entry)) return source;
  const anchor = "  { id: 'plugin-market', name: 'zat-dsh-engine' },";
  return replaceExactlyOnce(source, anchor, `${anchor}\n${entry}`, `${label} companion list`);
}

function replaceExactlyOnce(source, before, after, label) {
  const occurrences = count(source, before);
  assert.equal(occurrences, 1, `${label}: expected one baseline marker, received ${occurrences}`);
  return source.replace(before, after);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function option(values, name) {
  const index = values.indexOf(name);
  return index < 0 ? undefined : values[index + 1];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertFile(path) {
  assert.equal((await stat(path)).isFile(), true, `expected file ${path}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
