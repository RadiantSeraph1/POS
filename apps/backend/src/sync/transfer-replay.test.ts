import assert from "node:assert/strict";
import test from "node:test";

import type { SyncEnvelope } from "../../../../packages/types/src/index.ts";
import {
  replayPendingStockTransferEvents,
  replayPendingStockTransferRequestedEvents,
  replayStockTransferApprovedEvent,
  replayStockTransferDispatchedEvent,
  replayStockTransferReceivedEvent,
  replayStockTransferRequestedEvent,
  type TransferReplayQueryClient
} from "./transfer-replay.ts";

class RecordingTransferReplayClient implements TransferReplayQueryClient {
  readonly calls: Array<{ text: string; params: ReadonlyArray<unknown> }> = [];
  private readonly acceptsReplay: boolean;

  constructor(acceptsReplay = true) {
    this.acceptsReplay = acceptsReplay;
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> {
    this.calls.push({ text, params });

    if (/INSERT INTO sync_replay_log/.test(text)) {
      return {
        rows: (this.acceptsReplay ? [{ event_id: params[0] }] : []) as unknown as T[]
      };
    }

    return { rows: [] as T[] };
  }
}

const transferEvent: SyncEnvelope = {
  eventId: "55555555-5555-4555-8555-555555555555",
  eventType: "STOCK_TRANSFER_REQUESTED",
  aggregateType: "stock_transfer",
  aggregateId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-05-14T10:00:00.000Z",
  payload: {
    transferId: "66666666-6666-4666-8666-666666666666",
    requestNumber: "TRF-000001",
    organizationId: "11111111-1111-4111-8111-111111111111",
    sourceType: "warehouse",
    sourceId: "77777777-7777-4777-8777-777777777777",
    destinationType: "branch",
    destinationId: "22222222-2222-4222-8222-222222222222",
    requestedByUserId: "44444444-4444-4444-8444-444444444444",
    items: [
      {
        transferItemId: "88888888-8888-4888-8888-888888888888",
        productId: "99999999-9999-4999-8999-999999999999",
        quantity: 12
      }
    ]
  }
};

const dispatchedEvent: SyncEnvelope = {
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventType: "STOCK_TRANSFER_DISPATCHED",
  aggregateType: "stock_transfer",
  aggregateId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-05-14T11:00:00.000Z",
  payload: {
    transferId: "66666666-6666-4666-8666-666666666666",
    dispatchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    warehouseId: "77777777-7777-4777-8777-777777777777",
    dispatchedByUserId: "44444444-4444-4444-8444-444444444444",
    dispatchedAt: "2026-05-14T11:00:00.000Z",
    items: [
      {
        transferItemId: "88888888-8888-4888-8888-888888888888",
        dispatchedQuantity: 10
      }
    ]
  }
};

const approvedEvent: SyncEnvelope = {
  eventId: "9999aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventType: "STOCK_TRANSFER_APPROVED",
  aggregateType: "stock_transfer",
  aggregateId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-05-14T10:30:00.000Z",
  payload: {
    transferId: "66666666-6666-4666-8666-666666666666",
    approvedByUserId: "44444444-4444-4444-8444-444444444444",
    approvedAt: "2026-05-14T10:30:00.000Z",
    items: [
      {
        transferItemId: "88888888-8888-4888-8888-888888888888",
        approvedQuantity: 10
      }
    ]
  }
};

const receivedEvent: SyncEnvelope = {
  eventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  eventType: "STOCK_TRANSFER_RECEIVED",
  aggregateType: "stock_transfer",
  aggregateId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-05-14T12:00:00.000Z",
  payload: {
    transferId: "66666666-6666-4666-8666-666666666666",
    receiptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    organizationId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    receivedByUserId: "44444444-4444-4444-8444-444444444444",
    receivedAt: "2026-05-14T12:00:00.000Z",
    notes: "Received at branch counter",
    items: [
      {
        transferItemId: "88888888-8888-4888-8888-888888888888",
        productId: "99999999-9999-4999-8999-999999999999",
        receivedQuantity: 9
      }
    ]
  }
};

test("replays STOCK_TRANSFER_REQUESTED into transfer and item projections", async () => {
  const client = new RecordingTransferReplayClient();

  const result = await replayStockTransferRequestedEvent(client, transferEvent);

  assert.deepEqual(result, {
    transferId: "66666666-6666-4666-8666-666666666666",
    items: 1,
    replayed: true
  });
  assert.match(client.calls[0]!.text, /BEGIN/);
  assert.match(client.calls[1]!.text, /INSERT INTO sync_replay_log/);
  assert.match(client.calls[2]!.text, /INSERT INTO stock_transfers/);
  assert.match(client.calls[3]!.text, /INSERT INTO transfer_items/);
  assert.match(client.calls.at(-1)!.text, /COMMIT/);
  assert.deepEqual(client.calls[2]!.params.slice(0, 8), [
    "66666666-6666-4666-8666-666666666666",
    "11111111-1111-4111-8111-111111111111",
    "warehouse",
    "77777777-7777-4777-8777-777777777777",
    "branch",
    "22222222-2222-4222-8222-222222222222",
    "TRF-000001",
    "requested"
  ]);
});

test("skips duplicate transfer replay attempts before projecting items", async () => {
  const client = new RecordingTransferReplayClient(false);

  const result = await replayStockTransferRequestedEvent(client, transferEvent);

  assert.deepEqual(result, {
    transferId: "66666666-6666-4666-8666-666666666666",
    items: 0,
    replayed: false
  });
  assert.equal(client.calls.filter((call) => /INSERT INTO stock_transfers/.test(call.text)).length, 0);
  assert.equal(client.calls.filter((call) => /INSERT INTO transfer_items/.test(call.text)).length, 0);
});

test("replays pending STOCK_TRANSFER_REQUESTED events from inventory_events", async () => {
  const client = new RecordingTransferReplayClient();
  const originalQuery = client.query.bind(client);

  client.query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> => {
    if (/FROM inventory_events/.test(text) && /STOCK_TRANSFER_REQUESTED/.test(text)) {
      return {
        rows: [
          {
            id: transferEvent.eventId,
            event_type: transferEvent.eventType,
            aggregate_type: transferEvent.aggregateType,
            aggregate_id: transferEvent.aggregateId,
            payload_json: transferEvent.payload,
            local_created_at: transferEvent.createdAt
          }
        ] as unknown as T[]
      };
    }

    return originalQuery<T>(text, params);
  };

  const summary = await replayPendingStockTransferRequestedEvents(client, 10);

  assert.deepEqual(summary, {
    scanned: 1,
    replayed: 1,
    skipped: 0,
    failed: 0
  });
});

test("replays STOCK_TRANSFER_APPROVED into approved transfer state and quantities", async () => {
  const client = new RecordingTransferReplayClient();

  const result = await replayStockTransferApprovedEvent(client, approvedEvent);

  assert.deepEqual(result, {
    transferId: "66666666-6666-4666-8666-666666666666",
    items: 1,
    replayed: true
  });
  assert.match(client.calls[2]!.text, /UPDATE stock_transfers/);
  assert.match(client.calls[2]!.text, /CASE/);
  assert.match(client.calls[3]!.text, /UPDATE transfer_items/);
  assert.deepEqual(client.calls[2]!.params.slice(0, 3), [
    "66666666-6666-4666-8666-666666666666",
    "2026-05-14T10:30:00.000Z",
    "44444444-4444-4444-8444-444444444444"
  ]);
});

test("replays STOCK_TRANSFER_DISPATCHED into dispatch and dispatched quantities", async () => {
  const client = new RecordingTransferReplayClient();

  const result = await replayStockTransferDispatchedEvent(client, dispatchedEvent);

  assert.deepEqual(result, {
    transferId: "66666666-6666-4666-8666-666666666666",
    items: 1,
    replayed: true
  });
  assert.match(client.calls[2]!.text, /UPDATE stock_transfers/);
  assert.match(client.calls[3]!.text, /INSERT INTO warehouse_dispatches/);
  assert.match(client.calls[4]!.text, /UPDATE transfer_items/);
  assert.deepEqual(client.calls[2]!.params.slice(0, 3), [
    "66666666-6666-4666-8666-666666666666",
    "2026-05-14T11:00:00.000Z",
    "44444444-4444-4444-8444-444444444444"
  ]);
});

test("replays STOCK_TRANSFER_RECEIVED into receipt, received quantities, and destination inventory", async () => {
  const client = new RecordingTransferReplayClient();

  const result = await replayStockTransferReceivedEvent(client, receivedEvent);

  assert.deepEqual(result, {
    transferId: "66666666-6666-4666-8666-666666666666",
    items: 1,
    replayed: true
  });
  assert.match(client.calls[2]!.text, /UPDATE stock_transfers/);
  assert.match(client.calls[3]!.text, /INSERT INTO warehouse_receipts/);
  assert.match(client.calls[4]!.text, /UPDATE transfer_items/);
  assert.match(client.calls[5]!.text, /INSERT INTO inventory_levels/);
  assert.match(client.calls[5]!.text, /sellable_quantity = inventory_levels\.sellable_quantity \+ EXCLUDED\.sellable_quantity/);
});

test("replays pending transfer lifecycle events in received order", async () => {
  const client = new RecordingTransferReplayClient();
  const originalQuery = client.query.bind(client);

  client.query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> => {
    if (/FROM inventory_events/.test(text) && /STOCK_TRANSFER_REQUESTED/.test(text) && /STOCK_TRANSFER_RECEIVED/.test(text)) {
      return {
        rows: [
          {
            id: transferEvent.eventId,
            event_type: transferEvent.eventType,
            aggregate_type: transferEvent.aggregateType,
            aggregate_id: transferEvent.aggregateId,
            payload_json: transferEvent.payload,
            local_created_at: transferEvent.createdAt
          },
          {
            id: approvedEvent.eventId,
            event_type: approvedEvent.eventType,
            aggregate_type: approvedEvent.aggregateType,
            aggregate_id: approvedEvent.aggregateId,
            payload_json: approvedEvent.payload,
            local_created_at: approvedEvent.createdAt
          },
          {
            id: dispatchedEvent.eventId,
            event_type: dispatchedEvent.eventType,
            aggregate_type: dispatchedEvent.aggregateType,
            aggregate_id: dispatchedEvent.aggregateId,
            payload_json: dispatchedEvent.payload,
            local_created_at: dispatchedEvent.createdAt
          },
          {
            id: receivedEvent.eventId,
            event_type: receivedEvent.eventType,
            aggregate_type: receivedEvent.aggregateType,
            aggregate_id: receivedEvent.aggregateId,
            payload_json: receivedEvent.payload,
            local_created_at: receivedEvent.createdAt
          }
        ] as unknown as T[]
      };
    }

    return originalQuery<T>(text, params);
  };

  const summary = await replayPendingStockTransferEvents(client, 10);

  assert.deepEqual(summary, {
    scanned: 4,
    replayed: 4,
    skipped: 0,
    failed: 0
  });
});
