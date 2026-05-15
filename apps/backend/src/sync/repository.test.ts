import assert from "node:assert/strict";
import test from "node:test";

import {
  PostgresSyncEventRepository,
  type PostgresQueryClient,
  type StoredSyncEvent
} from "./repository.ts";

class RecordingPostgresClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; params: ReadonlyArray<unknown> }> = [];

  async query<T>(
    text: string,
    params: ReadonlyArray<unknown> = []
  ): Promise<{ rows: T[] }> {
    this.calls.push({ text, params });
    return { rows: [] };
  }
}

function storedEvent(payload: Record<string, unknown>, eventType: StoredSyncEvent["envelope"]["eventType"] = "STOCK_TRANSFER_REQUESTED"): StoredSyncEvent {
  return {
    branchId: "22222222-2222-4222-8222-222222222222",
    deviceId: "33333333-3333-4333-8333-333333333333",
    receivedAt: "2026-05-14T10:00:01.000Z",
    envelope: {
      eventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      eventType,
      aggregateType: "stock_transfer",
      aggregateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      createdAt: "2026-05-14T10:00:00.000Z",
      payload
    }
  };
}

test("uses requestedByUserId as actor for stock transfer request events", async () => {
  const client = new RecordingPostgresClient();
  const repository = new PostgresSyncEventRepository(client);

  await repository.save(
    storedEvent({
      organizationId: "11111111-1111-4111-8111-111111111111",
      requestedByUserId: "44444444-4444-4444-8444-444444444444"
    })
  );

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]!.params[6], "44444444-4444-4444-8444-444444444444");
});

test("uses dispatchedByUserId as actor for stock transfer dispatch events", async () => {
  const client = new RecordingPostgresClient();
  const repository = new PostgresSyncEventRepository(client);

  await repository.save(
    storedEvent(
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        dispatchedByUserId: "44444444-4444-4444-8444-444444444444"
      },
      "STOCK_TRANSFER_DISPATCHED"
    )
  );

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]!.params[6], "44444444-4444-4444-8444-444444444444");
});

test("uses approvedByUserId as actor for stock transfer approval events", async () => {
  const client = new RecordingPostgresClient();
  const repository = new PostgresSyncEventRepository(client);

  await repository.save(
    storedEvent(
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        approvedByUserId: "44444444-4444-4444-8444-444444444444"
      },
      "STOCK_TRANSFER_APPROVED"
    )
  );

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]!.params[6], "44444444-4444-4444-8444-444444444444");
});

test("uses receivedByUserId as actor for stock transfer receipt events", async () => {
  const client = new RecordingPostgresClient();
  const repository = new PostgresSyncEventRepository(client);

  await repository.save(
    storedEvent(
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        receivedByUserId: "44444444-4444-4444-8444-444444444444"
      },
      "STOCK_TRANSFER_RECEIVED"
    )
  );

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]!.params[6], "44444444-4444-4444-8444-444444444444");
});
