import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const uiDist = join(projectRoot, "dist", "ui");
const port = Number(process.env.PIPEFLOW_WEB_PREVIEW_PORT ?? "4173");

await new Promise((resolveBuild, rejectBuild) => {
  const build = spawn(process.execPath, [join(projectRoot, "scripts", "build-desktop.mjs")], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  build.on("exit", (code) => {
    if (code === 0) {
      resolveBuild();
      return;
    }

    rejectBuild(new Error(`Desktop build failed with exit code ${code}`));
  });
});

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = createServer((request, response) => {
  const requestPath = request.url && request.url !== "/" ? request.url.split("?")[0] : "/index.html";
  const targetPath = resolve(uiDist, `.${requestPath}`);
  const safePath = targetPath.startsWith(uiDist) ? targetPath : join(uiDist, "index.html");
  const filePath = existsSync(safePath) ? safePath : join(uiDist, "index.html");
  const ext = extname(filePath);
  const body = readFileSync(filePath);

  response.writeHead(200, {
    "Content-Type": contentTypes[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store"
  });
  response.end(body);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`PipeFlow desktop web preview running at http://127.0.0.1:${port}\n`);
  process.stdout.write(`Serving ${uiDist}\n`);
});
