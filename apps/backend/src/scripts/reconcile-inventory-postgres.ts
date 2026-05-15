import { createPgQueryClient } from "../sync/postgres-client.ts";
import { runRecordedSyncJob } from "../sync/job-runs.ts";
import { reconcileInventoryLevelsForSaleEvents } from "../sync/reconciliation.ts";

const connectionString = process.env.DATABASE_URL;
const limit = Number(process.env.RECONCILE_LIMIT ?? "100");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL inventory reconciliation.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("RECONCILE_LIMIT must be a positive integer when provided.");
}

const pg = await createPgQueryClient(connectionString);

try {
  const summary = await runRecordedSyncJob(
    pg.client,
    {
      jobType: "inventory_reconciliation",
      jobName: "Reconcile inventory levels from SALE_CREATED events"
    },
    () => reconcileInventoryLevelsForSaleEvents(pg.client, limit)
  );
  console.log("PostgreSQL inventory reconciliation completed.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pg.close();
}
