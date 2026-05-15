export interface WarehouseAppConfig {
  baseUrl: string;
  writeToken?: string;
  readToken?: string;
}

export function parseWarehouseAppConfig(env: NodeJS.ProcessEnv): WarehouseAppConfig {
  return {
    baseUrl: (env.PIPEFLOW_SYNC_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    writeToken: env.PIPEFLOW_SYNC_WRITE_TOKEN ?? env.PIPEFLOW_SYNC_ADMIN_TOKEN,
    readToken: env.PIPEFLOW_SYNC_READ_TOKEN ?? env.PIPEFLOW_SYNC_ADMIN_TOKEN
  };
}

