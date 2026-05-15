import { createPgQueryClient } from "../sync/postgres-client.ts";
import { runRecordedSyncJob } from "../sync/job-runs.ts";
import { reconcileStockTransferEvents } from "../sync/reconciliation.ts";

const connectionString = process.env.DATABASE_URL;
const limit = Number(process.env.RECONCILE_LIMIT ?? "100");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL transfer reconciliation.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("RECONCILE_LIMIT must be a positive integer when provided.");
}

const pg = await createPgQueryClient(connectionString);

try {
  const summary = await runRecordedSyncJob(
    pg.client,
    { jobType: "transfer_reconciliation", jobName: "Reconcile stock transfer lifecycle projections" },
    () => reconcileStockTransferEvents(pg.client, limit)
  );
  console.log("PostgreSQL transfer reconciliation completed.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pg.close();
}
