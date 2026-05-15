import assert from "node:assert/strict";
import test from "node:test";

import type { SyncEnvelope } from "../../../../packages/types/src/index.ts";
import {
  replayPendingSaleCreatedEvents,
  replaySaleCreatedEvent,
  type ReplayQueryClient
} from "./sale-replay.ts";

class RecordingReplayClient implements ReplayQueryClient {
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

const saleEvent: SyncEnvelope = {
  eventId: "12345678-1234-4234-8234-123456789abc",
  eventType: "SALE_CREATED",
  aggregateType: "sale",
  aggregateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  createdAt: "2026-05-12T08:00:00.000Z",
  payload: {
    saleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    saleNumber: "POS-TEST-001",
    organizationId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    deviceId: "33333333-3333-4333-8333-333333333333",
    cashierUserId: "44444444-4444-4444-8444-444444444444",
    currencyCode: "GHS",
    subtotalMinor: 1000,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 1000,
    items: [
      {
        saleItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        productId: "99999999-9999-4999-8999-999999999999",
        quantity: 2,
        unitPriceMinor: 500,
        discountMinor: 0,
        taxMinor: 0,
        lineTotalMinor: 1000
      }
    ],
    payments: [
      {
        paymentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        method: "cash",
        amountMinor: 1000,
        status: "completed",
        paidAt: "2026-05-12T08:00:00.000Z"
      }
    ]
  }
};

test("replays SALE_CREATED into sale, item, and payment projections", async () => {
  const client = new RecordingReplayClient();

  const result = await replaySaleCreatedEvent(client, saleEvent);

  assert.deepEqual(result, {
    saleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    saleItems: 1,
    payments: 1,
    replayed: true
  });
  assert.match(client.calls[0]!.text, /BEGIN/);
  assert.match(client.calls[1]!.text, /INSERT INTO sync_replay_log/);
  assert.match(client.calls[2]!.text, /INSERT INTO sales/);
  assert.match(client.calls[3]!.text, /INSERT INTO sale_items/);
  assert.ok(client.calls.some((call) => /INSERT INTO payments/.test(call.text)));
  assert.match(client.calls.at(-1)!.text, /COMMIT/);
  assert.match(client.calls[2]!.text, /ON CONFLICT \(id\) DO NOTHING/);
});

test("replays SALE_CREATED into branch inventory projections", async () => {
  const client = new RecordingReplayClient();

  await replaySaleCreatedEvent(client, saleEvent);

  const inventoryCalls = client.calls.filter((call) =>
    /INSERT INTO inventory_levels/.test(call.text)
  );

  assert.equal(inventoryCalls.length, 1);
  assert.match(inventoryCalls[0]!.text, /ON CONFLICT \(/);
  assert.match(inventoryCalls[0]!.text, /COALESCE\(product_variant_id/);
  assert.match(inventoryCalls[0]!.text, /sellable_quantity = inventory_levels.sellable_quantity \+ EXCLUDED.sellable_quantity/);
  assert.deepEqual(inventoryCalls[0]!.params.slice(0, 6), [
    "11111111-1111-4111-8111-111111111111",
    "branch",
    "22222222-2222-4222-8222-222222222222",
    "99999999-9999-4999-8999-999999999999",
    null,
    -2
  ]);
});

test("skips duplicate replay attempts before projecting inventory", async () => {
  const client = new RecordingReplayClient(false);

  const result = await replaySaleCreatedEvent(client, saleEvent);

  assert.deepEqual(result, {
    saleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    saleItems: 0,
    payments: 0,
    replayed: false
  });
  assert.equal(client.calls.filter((call) => /INSERT INTO sales/.test(call.text)).length, 0);
  assert.equal(client.calls.filter((call) => /INSERT INTO inventory_levels/.test(call.text)).length, 0);
  assert.match(client.calls.at(-1)!.text, /COMMIT/);
});

test("replays pending SALE_CREATED events from inventory_events", async () => {
  const client = new RecordingReplayClient();
  const originalQuery = client.query.bind(client);

  client.query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> => {
    if (/FROM inventory_events/.test(text) && /sync_replay_log/.test(text)) {
      return {
        rows: [
          {
            id: saleEvent.eventId,
            branch_id: "22222222-2222-4222-8222-222222222222",
            device_id: "33333333-3333-4333-8333-333333333333",
            event_type: saleEvent.eventType,
            aggregate_type: saleEvent.aggregateType,
            aggregate_id: saleEvent.aggregateId,
            payload_json: saleEvent.payload,
            local_created_at: saleEvent.createdAt
          }
        ] as unknown as T[]
      };
    }

    return originalQuery<T>(text, params);
  };

  const summary = await replayPendingSaleCreatedEvents(client, 10);

  assert.deepEqual(summary, {
    scanned: 1,
    replayed: 1,
    skipped: 0,
    failed: 0
  });
});

test("records event-level replay failure details", async () => {
  const client = new RecordingReplayClient();
  const originalQuery = client.query.bind(client);

  client.query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> => {
    if (/FROM inventory_events/.test(text) && /sync_replay_log/.test(text)) {
      return {
        rows: [
          {
            id: saleEvent.eventId,
            event_type: saleEvent.eventType,
            aggregate_type: saleEvent.aggregateType,
            aggregate_id: saleEvent.aggregateId,
            payload_json: {
              ...saleEvent.payload,
              items: "not-an-array"
            },
            local_created_at: saleEvent.createdAt
          }
        ] as unknown as T[]
      };
    }

    return originalQuery<T>(text, params);
  };

  const summary = await replayPendingSaleCreatedEvents(client, 10);
  const failureCalls = client.calls.filter((call) =>
    /INSERT INTO sync_replay_failures/.test(call.text)
  );

  assert.deepEqual(summary, {
    scanned: 1,
    replayed: 0,
    skipped: 0,
    failed: 1
  });
  assert.equal(failureCalls.length, 1);
  assert.deepEqual(failureCalls[0]!.params.slice(0, 4), [
    saleEvent.eventId,
    saleEvent.eventType,
    saleEvent.aggregateType,
    saleEvent.aggregateId
  ]);
  assert.match(String(failureCalls[0]!.params[4]), /items/);
});
