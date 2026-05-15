import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

await import("./build-desktop.mjs");

const electronCli = resolve(
  projectRoot,
  "node_modules",
  "electron",
  "cli.js"
);

const child = spawn(process.execPath, [electronCli, "."], {
  cwd: projectRoot,
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
