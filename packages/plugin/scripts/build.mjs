import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts", "src/rpc.ts", "src/typert.host.ts"],
  bundle: true,
  platform: "node",
  target: "es2022",
  format: "esm",
  outdir: "dist",
  external: [
    "@deepseek-ai/cordis",
    "@deepseek-ai/dsh-typert-protocol",
    "@deepseek-ai/schemastery",
    "yaml",
    "zod"
  ],
  banner: {
    js: "import { createRequire as __dsmCreateRequire } from 'node:module'; const require = __dsmCreateRequire(import.meta.url);"
  }
});

await build({
  entryPoints: { client: "src/client.tsx" },
  bundle: true,
  platform: "browser",
  target: "chrome120",
  format: "cjs",
  outfile: "dist/client.js",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-ui-primitives"
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production")
  },
  banner: {
    js: "window.__ModuleLoader__.load({ id: \"dsh-skill-manager\", factory: (require) => { var module = { exports: {} }; var exports = module.exports;"
  },
  footer: {
    js: "return module.exports; } });"
  }
});
