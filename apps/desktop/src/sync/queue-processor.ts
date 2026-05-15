import type {
  SyncBatchRequest,
  SyncBatchResponse,
  SyncEnvelope
} from "../../../../packages/types/src/index.ts";

import type { SqliteTransactionRunner } from "../db.ts";

interface SyncQueueRow {
  id: string;
  event_id: string;
  event_type: SyncEnvelope["eventType"];
  aggregate_type: SyncEnvelope["aggregateType"];
  aggregate_id: string;
  payload_json: string;
  retry_count: number;
  created_at: string;
}

interface SyncResultRow {
  eventId: string;
  status: "accepted" | "duplicate" | "rejected";
  acknowledgedAt: string;
  message?: string;
}

export interface SyncTransport {
  send(batch: SyncBatchRequest): Promise<SyncBatchResponse>;
}

export interface ProcessQueueResult {
  claimed: number;
  synced: number;
  failed: number;
}

export class MockSyncTransport implements SyncTransport {
  async send(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    for (const event of batch.events) {
      console.log(`Mock sync sent ${event.eventId} (${event.eventType})`);
    }

    const acknowledgedAt = new Date().toISOString();

    return {
      received: batch.events.length,
      accepted: batch.events.length,
      duplicates: 0,
      rejected: 0,
      results: batch.events.map((event) => ({
        eventId: event.eventId,
        status: "accepted",
        acknowledgedAt,
        message: "Mock transport accepted event."
      }))
    };
  }
}

export class SelectiveFailingSyncTransport implements SyncTransport {
  private readonly failedEventIds: Set<string>;

  constructor(eventIdsToFail: string[]) {
    this.failedEventIds = new Set(eventIdsToFail);
  }

  async send(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    const failingEvent = batch.events.find((event) => this.failedEventIds.has(event.eventId));
    if (failingEvent) {
      throw new Error(`Simulated transport failure for ${failingEvent.eventId}`);
    }

    for (const event of batch.events) {
      console.log(`Selective sync sent ${event.eventId} (${event.eventType})`);
    }

    const acknowledgedAt = new Date().toISOString();

    return {
      received: batch.events.length,
      accepted: batch.events.length,
      duplicates: 0,
      rejected: 0,
      results: batch.events.map((event) => ({
        eventId: event.eventId,
        status: "accepted",
        acknowledgedAt,
        message: "Selective transport accepted event."
      }))
    };
  }
}

export class HttpSyncTransport implements SyncTransport {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async send(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    const response = await fetch(`${this.baseUrl}/sync/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      throw new Error(`Sync HTTP request failed with status ${response.status}.`);
    }

    return (await response.json()) as SyncBatchResponse;
  }
}

function computeNextRetryAt(now: Date, retryCount: number): string {
  const baseDelaySeconds = Math.min(2 ** retryCount, 300);
  return new Date(now.getTime() + baseDelaySeconds * 1000).toISOString();
}

export class SyncQueueProcessor {
  private readonly db: SqliteTransactionRunner;
  private readonly transport: SyncTransport;
  private readonly deadLetterThreshold: number;

  constructor(db: SqliteTransactionRunner, transport: SyncTransport, deadLetterThreshold = 3) {
    this.db = db;
    this.transport = transport;
    this.deadLetterThreshold = deadLetterThreshold;
  }

  claimPendingEvents(limit: number, nowIso: string): SyncQueueRow[] {
    const rows = this.db.query<SyncQueueRow>(
      `
        SELECT id, event_id, event_type, aggregate_type, aggregate_id, payload_json, retry_count, created_at
        FROM sync_queue
        WHERE status IN ('pending', 'failed')
          AND (next_retry_at IS NULL OR next_retry_at <= ?)
          AND locked_at IS NULL
        ORDER BY created_at
        LIMIT ?
      `,
      [nowIso, limit]
    );

    for (const row of rows) {
      this.db.execute(
        `
          UPDATE sync_queue
          SET status = ?, locked_at = ?, updated_at = ?
          WHERE id = ?
        `,
        ["processing", nowIso, nowIso, row.id]
      );
    }

    return rows;
  }

  async processPending(limit = 20, now = new Date()): Promise<ProcessQueueResult> {
    const nowIso = now.toISOString();
    const claimedRows = this.claimPendingEvents(limit, nowIso);

    let synced = 0;
    let failed = 0;

    for (const row of claimedRows) {
      const event: SyncEnvelope = {
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        createdAt: row.created_at
      };

      try {
        const response = await this.transport.send({
          branchId: this.extractBranchId(event),
          deviceId: this.extractDeviceId(event),
          events: [event]
        });
        const result = response.results[0] as SyncResultRow | undefined;

        if (!result) {
          throw new Error(`No acknowledgement returned for ${event.eventId}.`);
        }

        if (result.status === "accepted" || result.status === "duplicate") {
          this.db.execute(
            `
              UPDATE sync_queue
              SET status = ?, locked_at = NULL, acknowledged_at = ?, updated_at = ?, last_error = NULL
              WHERE id = ?
            `,
            ["synced", result.acknowledgedAt, nowIso, row.id]
          );
          this.db.execute(
            `
              UPDATE inventory_events
              SET synced_at = ?
              WHERE id = ?
            `,
            [result.acknowledgedAt, row.event_id]
          );
          synced += 1;
          continue;
        }

        throw new Error(result.message ?? `Event ${event.eventId} was rejected by sync endpoint.`);
      } catch (error) {
        const nextRetryCount = row.retry_count + 1;
        const nextRetryAt = computeNextRetryAt(now, nextRetryCount);
        const message = error instanceof Error ? error.message : String(error);
        const nextStatus = nextRetryCount >= this.deadLetterThreshold ? "dead_letter" : "failed";
        this.db.execute(
          `
            UPDATE sync_queue
            SET status = ?, retry_count = retry_count + 1, last_error = ?, next_retry_at = ?, locked_at = NULL, updated_at = ?
            WHERE id = ?
          `,
          [nextStatus, message, nextRetryAt, nowIso, row.id]
        );
        failed += 1;
      }
    }

    return {
      claimed: claimedRows.length,
      synced,
      failed
    };
  }

  private extractBranchId(event: SyncEnvelope): string {
    const payloadBranchId =
      typeof event.payload.branchId === "string" ? event.payload.branchId : undefined;

    return payloadBranchId ?? "unknown-branch";
  }

  private extractDeviceId(event: SyncEnvelope): string {
    const payloadDeviceId =
      typeof event.payload.deviceId === "string" ? event.payload.deviceId : undefined;

    return payloadDeviceId ?? "unknown-device";
  }
}
