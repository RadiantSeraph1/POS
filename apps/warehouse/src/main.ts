import { existsSync, rmSync } from "node:fs";
import type { Server } from "node:http";

import {
  SqliteSyncEventRepository,
  SyncIngestionService,
  createBackendHttpServer
} from "../../backend/src/sync/index.ts";
import { resolveProjectPath } from "../../desktop/src/db.ts";
import { WarehouseBackendClient } from "./backend-client.ts";
import { parseWarehouseAppConfig } from "./config.ts";
import { runWarehouseReceivingFlow } from "./dashboard.ts";

const config = parseWarehouseAppConfig(process.env);
const shouldUseExternalBackend = Boolean(process.env.PIPEFLOW_SYNC_BASE_URL);

let backendServer: Server | null = null;
let backendRepository: SqliteSyncEventRepository | null = null;
let baseUrl = config.baseUrl;

if (!shouldUseExternalBackend) {
  const backendRepositoryFile = resolveProjectPath("data", "warehouse", "sync-events.sqlite");
  if (existsSync(backendRepositoryFile)) {
    rmSync(backendRepositoryFile);
  }

  backendRepository = new SqliteSyncEventRepository(backendRepositoryFile);
  await backendRepository.initialize();
  const backendService = new SyncIngestionService(backendRepository);
  backendServer = createBackendHttpServer(backendService);
  const backendPort = 3103;

  await new Promise<void>((resolve, reject) => {
    backendServer!.listen(backendPort, () => resolve());
    backendServer!.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${backendPort}`;
}

const client = new WarehouseBackendClient({
  baseUrl,
  ...(config.writeToken ? { writeToken: config.writeToken } : {}),
  ...(config.readToken ? { readToken: config.readToken } : {})
});

try {
  await runWarehouseReceivingFlow(client);
} finally {
  if (backendServer) {
    await new Promise<void>((resolve, reject) => {
      backendServer!.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await backendRepository?.close?.();
}
