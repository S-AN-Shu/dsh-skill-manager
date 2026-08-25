import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "packages", "plugin", "preview");
const output = resolve(root, "output", "playwright", "current-visual-preview");

await mkdir(output, { recursive: true });
await Promise.all([
  rm(resolve(output, "index.html"), { force: true }),
  rm(resolve(output, "preview.css"), { force: true }),
  rm(resolve(output, "preview.js"), { force: true })
]);
await Promise.all([
  cp(resolve(source, "index.html"), resolve(output, "index.html")),
  cp(resolve(source, "preview.css"), resolve(output, "preview.css"))
]);

await build({
  entryPoints: [resolve(source, "main.tsx")],
  outfile: resolve(output, "preview.js"),
  bundle: true,
  platform: "browser",
  target: "chrome120",
  format: "esm",
  sourcemap: false,
  alias: {
    "@deepseek-ai/dsh-client-ui-primitives": resolve(source, "primitives.tsx")
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  }
});

console.log(`visual preview built at ${output}`);
