import { createPgQueryClient } from "../sync/postgres-client.ts";
import { runRecordedSyncJob } from "../sync/job-runs.ts";
import { replayPendingStockTransferEvents } from "../sync/transfer-replay.ts";

const connectionString = process.env.DATABASE_URL;
const limit = Number(process.env.REPLAY_LIMIT ?? "100");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL transfer replay.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("REPLAY_LIMIT must be a positive integer when provided.");
}

const pg = await createPgQueryClient(connectionString);

try {
  const summary = await runRecordedSyncJob(
    pg.client,
    { jobType: "transfer_replay", jobName: "Replay pending stock transfer lifecycle events" },
    () => replayPendingStockTransferEvents(pg.client, limit)
  );
  console.log("PostgreSQL transfer replay completed.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pg.close();
}
