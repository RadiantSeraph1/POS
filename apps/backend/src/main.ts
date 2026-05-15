import {
  SyncIngestionService,
  createBackendHttpServer,
  createSaleReplayWorkerFromConfig,
  createSyncRepositoryFromEnv
} from "./sync/index.ts";
import { parseAuthConfig, parseHttpPort, parseReplayWorkerConfig } from "./server-config.ts";

const repositoryBootstrap = await createSyncRepositoryFromEnv();
const repository = repositoryBootstrap.repository;
const syncService = new SyncIngestionService(repository);
const replayWorkerConfig = parseReplayWorkerConfig(process.env);
const authConfig = parseAuthConfig(process.env);
const replayWorker = createSaleReplayWorkerFromConfig({
  config: replayWorkerConfig,
  ...(repositoryBootstrap.queryClient ? { queryClient: repositoryBootstrap.queryClient } : {})
});
const server = createBackendHttpServer(syncService, {
  auth: authConfig,
  ...(replayWorker ? { replayWorker } : {})
});

const port = parseHttpPort(process.env.PORT);

replayWorker?.start();

server.listen(port, () => {
  console.log(`PipeFlow backend listening on http://localhost:${port}`);
  console.log("Available endpoints:");
  console.log("- GET /health");
  console.log("- GET /sync/health");
  console.log("- GET /sync/events");
  console.log("- POST /sync/events");
  console.log(`Repository kind: ${repositoryBootstrap.kind}`);
  console.log(`Repository: ${repositoryBootstrap.location}`);
  console.log(`Replay worker: ${replayWorker ? "enabled" : "disabled"}`);
  console.log(`Backend auth: ${authConfig.enabled ? "enabled" : "disabled"}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    replayWorker?.stop();
    server.close(async () => {
      await repositoryBootstrap.close();
      process.exit(0);
    });
  });
}
