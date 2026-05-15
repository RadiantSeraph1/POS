export interface SyncHealthSnapshot {
  queueDepth: number;
  failedCount: number;
  deadLetterCount: number;
  lastSuccessfulSyncAt?: string;
  online: boolean;
}

export const syncEngineNotes = [
  "Process local events in deterministic order",
  "Use idempotent cloud ingestion",
  "Retry transient failures with backoff",
  "Escalate dead-letter events for manual review"
];

