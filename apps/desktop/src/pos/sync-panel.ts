import type { SqliteTransactionRunner } from "../db.ts";

interface SyncQueueSummaryRow {
  status: string;
  count: number;
}

export interface PosSyncPanelState {
  pending: number;
  processing: number;
  synced: number;
  failed: number;
  deadLetter: number;
  lastError?: string;
}

export function readSyncPanelState(db: SqliteTransactionRunner): PosSyncPanelState {
  const rows = db.query<SyncQueueSummaryRow>(
    `SELECT status, COUNT(*) AS count FROM sync_queue GROUP BY status`
  );
  const lastErrorRow = db.query<{ last_error: string | null }>(
    `SELECT last_error FROM sync_queue WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1`
  )[0];

  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]));
  return {
    pending: Number(counts.pending ?? 0),
    processing: Number(counts.processing ?? 0),
    synced: Number(counts.synced ?? 0),
    failed: Number(counts.failed ?? 0),
    deadLetter: Number(counts.dead_letter ?? 0),
    ...(lastErrorRow?.last_error ? { lastError: lastErrorRow.last_error } : {})
  };
}
