export interface WarehouseAppConfig {
  baseUrl: string;
  writeToken?: string;
  readToken?: string;
}

export function parseWarehouseAppConfig(env: NodeJS.ProcessEnv): WarehouseAppConfig {
  const writeToken = env.PIPEFLOW_SYNC_WRITE_TOKEN ?? env.PIPEFLOW_SYNC_ADMIN_TOKEN;
  const readToken = env.PIPEFLOW_SYNC_READ_TOKEN ?? env.PIPEFLOW_SYNC_ADMIN_TOKEN;

  return {
    baseUrl: (env.PIPEFLOW_SYNC_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    ...(writeToken ? { writeToken } : {}),
    ...(readToken ? { readToken } : {})
  };
}
