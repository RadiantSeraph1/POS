import assert from "node:assert/strict";
import test from "node:test";

import type { TransferSummary } from "./models.ts";
import {
  buildApproveTransferEnvelope,
  buildDispatchTransferEnvelope
} from "./transfer-actions.ts";

const requestedTransfer: TransferSummary = {
  transferId: "transfer-requested-1",
  requestNumber: "TRF-REQ-1",
  organizationId: "org-1",
  sourceType: "warehouse",
  sourceId: "wh-1",
  destinationType: "branch",
  destinationId: "branch-1",
  requestedByUserId: "user-1",
  status: "requested",
  createdAt: "2026-05-16T08:00:00.000Z",
  lastUpdatedAt: "2026-05-16T08:01:00.000Z",
  events: [],
  lines: [
    {
      transferItemId: "line-1",
      productId: "product-1",
      requestedQuantity: 12,
      approvedQuantity: 0,
      dispatchedQuantity: 0,
      receivedQuantity: 0
    },
    {
      transferItemId: "line-2",
      productId: "product-2",
      requestedQuantity: 8,
      approvedQuantity: 0,
      dispatchedQuantity: 0,
      receivedQuantity: 0
    }
  ]
};

const approvedTransfer: TransferSummary = {
  ...requestedTransfer,
  transferId: "transfer-approved-1",
  requestNumber: "TRF-APP-1",
  status: "approved",
  approvedByUserId: "user-2",
  lines: [
    {
      transferItemId: "line-1",
      productId: "product-1",
      requestedQuantity: 12,
      approvedQuantity: 10,
      dispatchedQuantity: 0,
      receivedQuantity: 0
    },
    {
      transferItemId: "line-2",
      productId: "product-2",
      requestedQuantity: 8,
      approvedQuantity: 8,
      dispatchedQuantity: 0,
      receivedQuantity: 0
    }
  ]
};

test("buildApproveTransferEnvelope returns approved line quantities", () => {
  const envelope = buildApproveTransferEnvelope({
    transfer: requestedTransfer,
    approvedByUserId: "user-2",
    approvedAt: "2026-05-16T08:05:00.000Z",
    quantitiesByTransferItemId: {
      "line-1": 10,
      "line-2": 8
    }
  });

  assert.equal(envelope.eventType, "STOCK_TRANSFER_APPROVED");
  assert.equal(envelope.aggregateId, requestedTransfer.transferId);
  assert.deepEqual(envelope.payload, {
    transferId: requestedTransfer.transferId,
    approvedByUserId: "user-2",
    approvedAt: "2026-05-16T08:05:00.000Z",
    items: [
      {
        transferItemId: "line-1",
        approvedQuantity: 10
      },
      {
        transferItemId: "line-2",
        approvedQuantity: 8
      }
    ]
  });
});

test("buildApproveTransferEnvelope rejects quantities above requested", () => {
  assert.throws(
    () =>
      buildApproveTransferEnvelope({
        transfer: requestedTransfer,
        approvedByUserId: "user-2",
        approvedAt: "2026-05-16T08:05:00.000Z",
        quantitiesByTransferItemId: {
          "line-1": 13,
          "line-2": 8
        }
      }),
    /cannot exceed requested quantity/i
  );
});

test("buildDispatchTransferEnvelope returns dispatched line quantities", () => {
  const envelope = buildDispatchTransferEnvelope({
    transfer: approvedTransfer,
    dispatchId: "dispatch-1",
    warehouseId: "wh-1",
    dispatchedByUserId: "user-3",
    dispatchedAt: "2026-05-16T08:10:00.000Z",
    quantitiesByTransferItemId: {
      "line-1": 10,
      "line-2": 6
    }
  });

  assert.equal(envelope.eventType, "STOCK_TRANSFER_DISPATCHED");
  assert.deepEqual(envelope.payload, {
    transferId: approvedTransfer.transferId,
    dispatchId: "dispatch-1",
    warehouseId: "wh-1",
    dispatchedByUserId: "user-3",
    dispatchedAt: "2026-05-16T08:10:00.000Z",
    items: [
      {
        transferItemId: "line-1",
        dispatchedQuantity: 10
      },
      {
        transferItemId: "line-2",
        dispatchedQuantity: 6
      }
    ]
  });
});

test("buildDispatchTransferEnvelope rejects quantities above approved", () => {
  assert.throws(
    () =>
      buildDispatchTransferEnvelope({
        transfer: approvedTransfer,
        dispatchId: "dispatch-1",
        warehouseId: "wh-1",
        dispatchedByUserId: "user-3",
        dispatchedAt: "2026-05-16T08:10:00.000Z",
        quantitiesByTransferItemId: {
          "line-1": 11,
          "line-2": 6
        }
      }),
    /cannot exceed approved quantity/i
  );
});
