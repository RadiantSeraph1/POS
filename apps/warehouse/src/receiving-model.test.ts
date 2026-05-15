import assert from "node:assert/strict";
import test from "node:test";

import type { WarehouseDashboardState } from "./models.ts";
import { deriveReceivingQueue } from "./receiving-model.ts";

const dashboard: WarehouseDashboardState = {
  generatedAt: "2026-05-15T09:00:00.000Z",
  totalTransfers: 3,
  requestedTransfers: 0,
  approvedTransfers: 0,
  dispatchedTransfers: 1,
  receivedTransfers: 1,
  partialReceiptTransfers: 1,
  transfers: [
    {
      transferId: "transfer-dispatched",
      requestNumber: "TX-1",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "dispatched",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:10:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-1",
          productId: "product-1",
          requestedQuantity: 12,
          approvedQuantity: 10,
          dispatchedQuantity: 10,
          receivedQuantity: 0
        }
      ]
    },
    {
      transferId: "transfer-partial",
      requestNumber: "TX-2",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "partial_receipt",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:11:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-2",
          productId: "product-2",
          requestedQuantity: 8,
          approvedQuantity: 8,
          dispatchedQuantity: 8,
          receivedQuantity: 5
        }
      ]
    },
    {
      transferId: "transfer-received",
      requestNumber: "TX-3",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "received",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:12:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-3",
          productId: "product-3",
          requestedQuantity: 4,
          approvedQuantity: 4,
          dispatchedQuantity: 4,
          receivedQuantity: 4
        }
      ]
    }
  ]
};

test("deriveReceivingQueue returns only actionable inbound transfers", () => {
  const queue = deriveReceivingQueue(dashboard);

  assert.equal(queue.totalTransfers, 2);
  assert.deepEqual(
    queue.transfers.map((transfer) => transfer.transferId),
    ["transfer-partial", "transfer-dispatched"]
  );
});

test("deriveReceivingQueue computes outstanding receiving quantities per line", () => {
  const queue = deriveReceivingQueue(dashboard);
  const partialTransfer = queue.transfers.find((transfer) => transfer.transferId === "transfer-partial");

  assert.ok(partialTransfer);
  assert.equal(partialTransfer.totalOutstandingQuantity, 3);
  assert.equal(partialTransfer.lines[0]?.outstandingQuantity, 3);
});
