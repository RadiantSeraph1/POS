import { createPgQueryClient } from "../sync/postgres-client.ts";
import { runRecordedSyncJob } from "../sync/job-runs.ts";
import { replayPendingSaleCreatedEvents } from "../sync/sale-replay.ts";

const connectionString = process.env.DATABASE_URL;
const limit = Number(process.env.REPLAY_LIMIT ?? "100");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL sale replay.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("REPLAY_LIMIT must be a positive integer when provided.");
}

const pg = await createPgQueryClient(connectionString);

try {
  const summary = await runRecordedSyncJob(
    pg.client,
    { jobType: "sale_replay", jobName: "Replay pending SALE_CREATED events" },
    () => replayPendingSaleCreatedEvents(pg.client, limit)
  );
  console.log("PostgreSQL sale replay completed.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pg.close();
}
