import assert from "node:assert/strict";
import test from "node:test";

import type { TransferSummary } from "./models.ts";
import { summarizeTransferDetail } from "./transfer-detail.ts";

const transfer: TransferSummary = {
  transferId: "transfer-1",
  requestNumber: "TRF-1",
  organizationId: "org-1",
  sourceType: "warehouse",
  sourceId: "wh-1",
  destinationType: "branch",
  destinationId: "branch-1",
  requestedByUserId: "user-1",
  approvedByUserId: "user-2",
  dispatchedByUserId: "user-3",
  receivedByUserId: "user-4",
  status: "partial_receipt",
  createdAt: "2026-05-15T10:00:00.000Z",
  lastUpdatedAt: "2026-05-15T10:05:00.000Z",
  events: [],
  notes: "Short one fitting on receipt",
  lines: [
    {
      transferItemId: "line-1",
      productId: "product-pipe",
      requestedQuantity: 12,
      approvedQuantity: 10,
      dispatchedQuantity: 10,
      receivedQuantity: 9
    },
    {
      transferItemId: "line-2",
      productId: "product-elbow",
      requestedQuantity: 8,
      approvedQuantity: 8,
      dispatchedQuantity: 8,
      receivedQuantity: 8
    }
  ]
};

test("summarizeTransferDetail computes totals and line-level shortfalls", () => {
  const detail = summarizeTransferDetail(transfer);

  assert.equal(detail.totals.requestedQuantity, 20);
  assert.equal(detail.totals.approvedQuantity, 18);
  assert.equal(detail.totals.dispatchedQuantity, 18);
  assert.equal(detail.totals.receivedQuantity, 17);
  assert.equal(detail.totals.approvalShortfallQuantity, 2);
  assert.equal(detail.totals.dispatchShortfallQuantity, 0);
  assert.equal(detail.totals.receiptShortfallQuantity, 1);
  assert.equal(detail.lines[0]?.hasReceiptShortfall, true);
  assert.equal(detail.lines[0]?.receiptShortfallQuantity, 1);
  assert.equal(detail.lines[1]?.hasReceiptShortfall, false);
});
