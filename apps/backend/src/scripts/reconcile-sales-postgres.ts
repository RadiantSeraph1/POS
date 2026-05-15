import { createPgQueryClient } from "../sync/postgres-client.ts";
import { runRecordedSyncJob } from "../sync/job-runs.ts";
import { reconcileSaleCreatedEvents } from "../sync/reconciliation.ts";

const connectionString = process.env.DATABASE_URL;
const limit = Number(process.env.RECONCILE_LIMIT ?? "100");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL sale reconciliation.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("RECONCILE_LIMIT must be a positive integer when provided.");
}

const pg = await createPgQueryClient(connectionString);

try {
  const summary = await runRecordedSyncJob(
    pg.client,
    { jobType: "sale_reconciliation", jobName: "Reconcile SALE_CREATED projections" },
    () => reconcileSaleCreatedEvents(pg.client, limit)
  );
  console.log("PostgreSQL sale reconciliation completed.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pg.close();
}
