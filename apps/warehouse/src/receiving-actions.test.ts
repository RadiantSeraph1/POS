import assert from "node:assert/strict";
import test from "node:test";

import type { ReceivingTransferSummary } from "./receiving-model.ts";
import { buildReceiveTransferInput, buildReceiveTransferPayload } from "./receiving-actions.ts";

const transfer: ReceivingTransferSummary = {
  transferId: "transfer-1",
  requestNumber: "TX-1",
  sourceType: "warehouse",
  sourceId: "wh-1",
  destinationType: "branch",
  destinationId: "branch-1",
  status: "dispatched",
  totalOutstandingQuantity: 13,
  lastUpdatedAt: "2026-05-15T10:00:00.000Z",
  lines: [
    {
      transferItemId: "line-1",
      productId: "product-1",
      requestedQuantity: 12,
      approvedQuantity: 10,
      dispatchedQuantity: 10,
      receivedQuantity: 0,
      outstandingQuantity: 10
    },
    {
      transferItemId: "line-2",
      productId: "product-2",
      productVariantId: "variant-1",
      requestedQuantity: 8,
      approvedQuantity: 8,
      dispatchedQuantity: 8,
      receivedQuantity: 5,
      outstandingQuantity: 3
    }
  ]
};

test("buildReceiveTransferPayload returns receive lines for submitted quantities", () => {
  const input = buildReceiveTransferInput(transfer, {
    receiptId: "receipt-1",
    organizationId: "org-1",
    branchId: "branch-1",
    deviceId: "device-1",
    receivedByUserId: "user-1",
    receivedAt: "2026-05-15T10:05:00.000Z",
    notes: "Short pipe receipt",
    quantitiesByTransferItemId: {
      "line-1": 9,
      "line-2": 3
    }
  });

  const payload = buildReceiveTransferPayload(input);
  assert.equal(payload.transferId, "transfer-1");
  assert.equal(payload.items.length, 2);
  assert.deepEqual(payload.items[0], {
    transferItemId: "line-1",
    productId: "product-1",
    receivedQuantity: 9
  });
});

test("buildReceiveTransferPayload rejects over-receipt quantities", () => {
  assert.throws(
    () =>
      buildReceiveTransferPayload(
        buildReceiveTransferInput(transfer, {
          receiptId: "receipt-1",
          organizationId: "org-1",
          branchId: "branch-1",
          deviceId: "device-1",
          receivedByUserId: "user-1",
          receivedAt: "2026-05-15T10:05:00.000Z",
          quantitiesByTransferItemId: {
            "line-1": 11
          }
        })
      ),
    /exceeds remaining dispatched quantity/i
  );
});
