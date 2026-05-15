import { mkdirSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const distRoot = join(projectRoot, "dist");
const uiDist = join(distRoot, "ui");
const electronDist = join(distRoot, "electron");

mkdirSync(uiDist, { recursive: true });
mkdirSync(electronDist, { recursive: true });

await build({
  entryPoints: [join(projectRoot, "src/ui/main.tsx")],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: join(uiDist, "main.js"),
  jsx: "automatic"
});

await build({
  entryPoints: [join(projectRoot, "src/electron/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(electronDist, "main.js"),
  external: ["electron"]
});

await build({
  entryPoints: [join(projectRoot, "src/electron/preload.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(electronDist, "preload.js"),
  external: ["electron"]
});

cpSync(join(projectRoot, "src/ui/index.html"), join(uiDist, "index.html"));
cpSync(join(projectRoot, "src/ui/styles.css"), join(uiDist, "styles.css"));
