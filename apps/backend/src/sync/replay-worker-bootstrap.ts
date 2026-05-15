import type { ReplayWorkerConfig } from "../server-config.ts";

import { runRecordedSyncJob } from "./job-runs.ts";
import type { PostgresQueryClient } from "./repository.ts";
import { SaleReplayWorker } from "./replay-worker.ts";
import { replayPendingSaleCreatedEvents } from "./sale-replay.ts";

export interface SaleReplayWorkerBootstrapOptions {
  config: ReplayWorkerConfig;
  queryClient?: PostgresQueryClient;
}

export function createSaleReplayWorkerFromConfig(
  options: SaleReplayWorkerBootstrapOptions
): SaleReplayWorker | null {
  if (!options.config.enabled) {
    return null;
  }

  if (!options.queryClient) {
    throw new Error("SYNC_REPLAY_WORKER requires PostgreSQL repository mode.");
  }

  return new SaleReplayWorker({
    intervalMs: options.config.intervalMs,
    limit: options.config.limit,
    replay: (limit) =>
      runRecordedSyncJob(
        options.queryClient!,
        { jobType: "sale_replay", jobName: "Replay pending SALE_CREATED events" },
        () => replayPendingSaleCreatedEvents(options.queryClient!, limit)
      )
  });
}
