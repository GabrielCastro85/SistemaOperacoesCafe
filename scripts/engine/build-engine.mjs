// Monta o motor do app para rodar no servidor (sem Electron).
// "electron" e "electron-log" sao trocados por substitutos em server/engine.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
await build({
  entryPoints: [resolve(root, "server/engine/host.ts")],
  outfile: resolve(root, "dist-engine/host.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  packages: "external",
  alias: {
    electron: resolve(root, "server/engine/electronShim.ts"),
    "electron-log/main.js": resolve(root, "server/engine/electronLogShim.ts"),
    "electron-log/main": resolve(root, "server/engine/electronLogShim.ts"),
    "electron-log": resolve(root, "server/engine/electronLogShim.ts"),
    "electron-updater": resolve(root, "server/engine/electronUpdaterShim.ts")
  },
  banner: { js: "import { createRequire as __engineCreateRequire } from 'node:module'; const require = __engineCreateRequire(import.meta.url);" },
  logLevel: "warning"
});
