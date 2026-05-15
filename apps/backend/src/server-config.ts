import { parseBackendAuthConfig, type BackendAuthConfig } from "./auth.ts";

export function parseHttpPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535.");
  }

  return port;
}

export interface ReplayWorkerConfig {
  enabled: boolean;
  intervalMs: number;
  limit: number;
}

interface ReplayWorkerEnv {
  SYNC_REPLAY_WORKER?: string;
  SYNC_REPLAY_WORKER_INTERVAL_MS?: string;
  SYNC_REPLAY_WORKER_LIMIT?: string;
}

interface AuthEnv {
  BACKEND_AUTH_MODE?: string;
  BACKEND_AUTH_TOKENS?: string;
}

function parsePositiveInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function parseReplayWorkerConfig(env: ReplayWorkerEnv): ReplayWorkerConfig {
  const workerMode = env.SYNC_REPLAY_WORKER?.trim().toLowerCase();

  return {
    enabled: workerMode === "enabled" || workerMode === "true" || workerMode === "1",
    intervalMs: parsePositiveInteger(
      env.SYNC_REPLAY_WORKER_INTERVAL_MS,
      "SYNC_REPLAY_WORKER_INTERVAL_MS",
      30000
    ),
    limit: parsePositiveInteger(env.SYNC_REPLAY_WORKER_LIMIT, "SYNC_REPLAY_WORKER_LIMIT", 100)
  };
}

export function parseAuthConfig(env: AuthEnv): BackendAuthConfig {
  return parseBackendAuthConfig(env);
}
