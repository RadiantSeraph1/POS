import type {
  SyncBatchRequest,
  SyncEnvelope,
  SyncEventAcknowledgement
} from "../../../../packages/types/src/index.ts";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface StoredSyncEvent {
  branchId: string;
  deviceId: string;
  envelope: SyncEnvelope;
  receivedAt: string;
}

export interface SyncEventRepository {
  initialize?(): Promise<void>;
  has(eventId: string): Promise<boolean>;
  save(input: StoredSyncEvent): Promise<void>;
  list(): Promise<StoredSyncEvent[]>;
  close?(): Promise<void>;
}

export interface PostgresQueryResultRow {
  [key: string]: unknown;
}

export interface PostgresQueryClient {
  query<T extends PostgresQueryResultRow = PostgresQueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export class InMemorySyncEventRepository implements SyncEventRepository {
  private readonly events = new Map<string, StoredSyncEvent>();

  async has(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async save(input: StoredSyncEvent): Promise<void> {
    this.events.set(input.envelope.eventId, input);
  }

  async list(): Promise<StoredSyncEvent[]> {
    return [...this.events.values()];
  }
}

export class SqliteSyncEventRepository implements SyncEventRepository {
  private readonly db: DatabaseSync;

  constructor(databaseFile: string) {
    mkdirSync(dirname(databaseFile), { recursive: true });
    this.db = new DatabaseSync(databaseFile);
  }

  async initialize(): Promise<void> {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS sync_ingested_events (
        event_id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        received_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_ingested_events_received_at
        ON sync_ingested_events(received_at);
    `);
  }

  async has(eventId: string): Promise<boolean> {
    const row = this.db
      .prepare(
        `
          SELECT event_id
          FROM sync_ingested_events
          WHERE event_id = ?
          LIMIT 1
        `
      )
      .get(eventId) as { event_id?: string } | undefined;

    return Boolean(row?.event_id);
  }

  async save(input: StoredSyncEvent): Promise<void> {
    this.db
      .prepare(
        `
          INSERT INTO sync_ingested_events (
            event_id, branch_id, device_id, event_type, aggregate_type, aggregate_id,
            payload_json, created_at, received_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.envelope.eventId,
        input.branchId,
        input.deviceId,
        input.envelope.eventType,
        input.envelope.aggregateType,
        input.envelope.aggregateId,
        JSON.stringify(input.envelope.payload),
        input.envelope.createdAt,
        input.receivedAt
      );
  }

  async list(): Promise<StoredSyncEvent[]> {
    const rows = this.db
      .prepare(
        `
          SELECT
            event_id,
            branch_id,
            device_id,
            event_type,
            aggregate_type,
            aggregate_id,
            payload_json,
            created_at,
            received_at
          FROM sync_ingested_events
          ORDER BY received_at, event_id
        `
      )
      .all() as Array<{
        event_id: string;
        branch_id: string;
        device_id: string;
        event_type: SyncEnvelope["eventType"];
        aggregate_type: SyncEnvelope["aggregateType"];
        aggregate_id: string;
        payload_json: string;
        created_at: string;
        received_at: string;
      }>;

    return rows.map((row) => ({
      branchId: row.branch_id,
      deviceId: row.device_id,
      envelope: {
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        createdAt: row.created_at
      },
      receivedAt: row.received_at
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

type PostgresStoredEventRow = {
  id: string;
  branch_id: string | null;
  device_id: string | null;
  event_type: SyncEnvelope["eventType"];
  aggregate_type: SyncEnvelope["aggregateType"];
  aggregate_id: string;
  payload_json: Record<string, unknown>;
  local_created_at: string;
  received_at: string;
};

function mapPostgresRowToStoredEvent(row: PostgresStoredEventRow): StoredSyncEvent {
  return {
    branchId: row.branch_id ?? "unknown-branch",
    deviceId: row.device_id ?? "unknown-device",
    envelope: {
      eventId: row.id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: row.payload_json,
      createdAt: row.local_created_at
    },
    receivedAt: row.received_at
  };
}

export class PostgresSyncEventRepository implements SyncEventRepository {
  private readonly client: PostgresQueryClient;

  constructor(client: PostgresQueryClient) {
    this.client = client;
  }

  async has(eventId: string): Promise<boolean> {
    const result = await this.client.query<{ id: string }>(
      `
        SELECT id
        FROM inventory_events
        WHERE id = $1
        LIMIT 1
      `,
      [eventId]
    );

    return result.rows.length > 0;
  }

  async save(input: StoredSyncEvent): Promise<void> {
    await this.client.query(
      `
        INSERT INTO inventory_events (
          id,
          organization_id,
          branch_id,
          warehouse_id,
          aggregate_type,
          aggregate_id,
          event_type,
          actor_user_id,
          device_id,
          quantity_delta,
          payload_json,
          local_created_at,
          received_at,
          event_version
        )
        VALUES (
          $1,
          $2,
          $3,
          NULL,
          $4,
          $5::UUID,
          $6,
          $7::UUID,
          $8::UUID,
          NULL,
          $9::JSONB,
          $10::TIMESTAMPTZ,
          $11::TIMESTAMPTZ,
          1
        )
      `,
      [
        input.envelope.eventId,
        extractRequiredUuid(input.envelope.payload.organizationId, "organizationId"),
        input.branchId,
        input.envelope.aggregateType,
        input.envelope.aggregateId,
        input.envelope.eventType,
        extractActorUserId(input),
        input.deviceId,
        JSON.stringify(input.envelope.payload),
        input.envelope.createdAt,
        input.receivedAt
      ]
    );
  }

  async list(): Promise<StoredSyncEvent[]> {
    const result = await this.client.query<PostgresStoredEventRow>(
      `
        SELECT
          id,
          branch_id,
          device_id::TEXT,
          event_type,
          aggregate_type,
          aggregate_id::TEXT,
          payload_json,
          local_created_at::TEXT,
          received_at::TEXT
        FROM inventory_events
        ORDER BY received_at, id
      `
    );

    return result.rows.map(mapPostgresRowToStoredEvent);
  }
}

function extractRequiredUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required UUID field '${fieldName}' in sync payload.`);
  }

  return value;
}

function extractActorUserId(input: StoredSyncEvent): string {
  if (input.envelope.eventType === "STOCK_TRANSFER_REQUESTED") {
    return extractRequiredUuid(input.envelope.payload.requestedByUserId, "requestedByUserId");
  }

  if (input.envelope.eventType === "STOCK_TRANSFER_DISPATCHED") {
    return extractRequiredUuid(input.envelope.payload.dispatchedByUserId, "dispatchedByUserId");
  }

  if (input.envelope.eventType === "STOCK_TRANSFER_APPROVED") {
    return extractRequiredUuid(input.envelope.payload.approvedByUserId, "approvedByUserId");
  }

  if (input.envelope.eventType === "STOCK_TRANSFER_RECEIVED") {
    return extractRequiredUuid(input.envelope.payload.receivedByUserId, "receivedByUserId");
  }

  return extractRequiredUuid(input.envelope.payload.cashierUserId, "cashierUserId");
}

export function buildStoredEvent(
  request: SyncBatchRequest,
  envelope: SyncEnvelope,
  receivedAt: string
): StoredSyncEvent {
  return {
    branchId: request.branchId,
    deviceId: request.deviceId,
    envelope,
    receivedAt
  };
}

export function createDuplicateAcknowledgement(
  eventId: string,
  acknowledgedAt: string
): SyncEventAcknowledgement {
  return {
    eventId,
    status: "duplicate",
    acknowledgedAt,
    message: "Event already ingested."
  };
}

export function createAcceptedAcknowledgement(
  eventId: string,
  acknowledgedAt: string
): SyncEventAcknowledgement {
  return {
    eventId,
    status: "accepted",
    acknowledgedAt,
    message: "Event accepted for processing."
  };
}

export function createRejectedAcknowledgement(
  eventId: string,
  acknowledgedAt: string,
  message: string
): SyncEventAcknowledgement {
  return {
    eventId,
    status: "rejected",
    acknowledgedAt,
    message
  };
}
