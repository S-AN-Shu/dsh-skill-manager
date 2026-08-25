import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const dist = new URL("../dist/", import.meta.url);
const distPath = fileURLToPath(dist);
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(
  manifest.exports?.["./package.json"],
  "./package.json",
  "DSH v0.3.8 client modules must be able to resolve the plugin manifest"
);
const entries = await readdir(dist);
for (const entry of entries) {
  if (!entry.endsWith(".js") && !entry.endsWith(".d.ts")) continue;
  const content = await readFile(new URL(entry, dist), "utf8");
  assert.equal(
    content.includes("@dsh-skill-manager/core"),
    false,
    `${entry} must not reference the private core package`
  );
}

const host = await import(`${pathToFileURL(join(distPath, "index.js")).href}?verify=${Date.now()}`);
const hostSource = await readFile(new URL("index.js", dist), "utf8");
assert.equal(
  /from\s+["']https-proxy-agent["']/u.test(hostSource),
  false,
  "standalone Host bundle must not import https-proxy-agent from the profile"
);
assert.equal(host.default.name, "DshSkillManagerService");
assert.deepEqual(host.skillManagerDescriptors.map((descriptor) => descriptor.method), [
  "list",
  "create",
  "setEnabled",
  "getCapabilities",
  "searchRepositories",
  "browseRepositories",
  "inspectRepository",
  "installSkill",
  "installRepository",
  "assessSkillRisk",
  "resolveMedia",
  "verifyProvenance",
  "verifyProvenanceBatch",
  "checkUpdates",
  "update",
  "listBackups",
  "rollback",
  "delete",
  "listTrash",
  "restoreTrash",
  "discoverExternal",
  "importExternal",
  "listTargetStates",
  "setTargetEnabled"
]);

let handoff;
const clientPath = new URL("client.js", dist);
vm.runInNewContext(await readFile(clientPath, "utf8"), {
  window: {
    __ModuleLoader__: {
      load(value) {
        handoff = value;
      }
    }
  }
});
assert.equal(handoff.id, "dsh-skill-manager");

const require = createRequire(import.meta.url);
const icons = new Proxy({}, {
  get() {
    return function Icon() {
      return null;
    };
  }
});
const client = handoff.factory((id) =>
  id === "@deepseek-ai/dsh-client-ui-primitives" ? icons : require(id)
);
assert.deepEqual(Object.keys(client).sort(), [
  "SkillManagerPanel",
  "adaptTypertRemote",
  "apply",
  "ensureSkillManagerStyles",
  "inject"
]);
assert.deepEqual(Array.from(client.inject), ["slots", "remote"]);

const clientBytes = (await stat(clientPath)).size;
assert.ok(clientBytes < 180_000, `client bundle unexpectedly grew to ${clientBytes} bytes`);

console.log(`verified Host and client bundles (${clientBytes} client bytes)`);
