import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileInventoryLevelsForSaleEvents,
  reconcileSaleCreatedEvents,
  reconcileStockTransferEvents,
  type ReconciliationQueryClient
} from "./reconciliation.ts";

class ReconciliationClient implements ReconciliationQueryClient {
  private readonly rows: Array<Record<string, unknown>>;

  constructor(rows: Array<Record<string, unknown>>) {
    this.rows = rows;
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<{ rows: T[] }> {
    return { rows: this.rows as unknown as T[] };
  }
}

test("reports no drift when sale event projections match payload totals", async () => {
  const result = await reconcileSaleCreatedEvents(
    new ReconciliationClient([
      {
        event_id: "event-1",
        sale_id: "sale-1",
        expected_total_minor: 1000,
        projected_total_minor: 1000,
        expected_item_count: 1,
        projected_item_count: 1,
        expected_payment_count: 1,
        projected_payment_count: 1,
        expected_payment_total_minor: 1000,
        projected_payment_total_minor: 1000,
        replayed: true
      }
    ])
  );

  assert.deepEqual(result, {
    checked: 1,
    healthy: 1,
    drifted: 0,
    unreplayed: 0,
    issues: []
  });
});

test("reports drift when sale projection totals do not match payload totals", async () => {
  const result = await reconcileSaleCreatedEvents(
    new ReconciliationClient([
      {
        event_id: "event-1",
        sale_id: "sale-1",
        expected_total_minor: 1000,
        projected_total_minor: 900,
        expected_item_count: 2,
        projected_item_count: 1,
        expected_payment_count: 1,
        projected_payment_count: 1,
        expected_payment_total_minor: 1000,
        projected_payment_total_minor: 900,
        replayed: true
      }
    ])
  );

  assert.equal(result.checked, 1);
  assert.equal(result.healthy, 0);
  assert.equal(result.drifted, 1);
  assert.equal(result.unreplayed, 0);
  assert.deepEqual(result.issues[0], {
    eventId: "event-1",
    saleId: "sale-1",
    status: "drifted",
    messages: [
      "Sale total mismatch: expected 1000, projected 900.",
      "Sale item count mismatch: expected 2, projected 1.",
      "Payment total mismatch: expected 1000, projected 900."
    ]
  });
});

test("reports unreplayed sale events separately from drift", async () => {
  const result = await reconcileSaleCreatedEvents(
    new ReconciliationClient([
      {
        event_id: "event-1",
        sale_id: "sale-1",
        expected_total_minor: 1000,
        projected_total_minor: null,
        expected_item_count: 1,
        projected_item_count: 0,
        expected_payment_count: 1,
        projected_payment_count: 0,
        expected_payment_total_minor: 1000,
        projected_payment_total_minor: 0,
        replayed: false
      }
    ])
  );

  assert.equal(result.checked, 1);
  assert.equal(result.healthy, 0);
  assert.equal(result.drifted, 0);
  assert.equal(result.unreplayed, 1);
  assert.deepEqual(result.issues[0], {
    eventId: "event-1",
    saleId: "sale-1",
    status: "unreplayed",
    messages: ["Sale event has not been replayed into projections."]
  });
});

test("reports healthy inventory projection when sold quantity matches projected stock movement", async () => {
  const result = await reconcileInventoryLevelsForSaleEvents(
    new ReconciliationClient([
      {
        organization_id: "org-1",
        branch_id: "branch-1",
        product_id: "product-1",
        product_variant_id: null,
        expected_quantity_delta: -2,
        projected_quantity_delta: -2
      }
    ])
  );

  assert.deepEqual(result, {
    checked: 1,
    healthy: 1,
    drifted: 0,
    issues: []
  });
});

test("reports inventory drift when projected stock movement differs from sale events", async () => {
  const result = await reconcileInventoryLevelsForSaleEvents(
    new ReconciliationClient([
      {
        organization_id: "org-1",
        branch_id: "branch-1",
        product_id: "product-1",
        product_variant_id: null,
        expected_quantity_delta: -2,
        projected_quantity_delta: -1
      }
    ])
  );

  assert.deepEqual(result, {
    checked: 1,
    healthy: 0,
    drifted: 1,
    issues: [
      {
        organizationId: "org-1",
        branchId: "branch-1",
        productId: "product-1",
        productVariantId: null,
        expectedQuantityDelta: -2,
        projectedQuantityDelta: -1,
        message: "Inventory quantity mismatch: expected -2, projected -1."
      }
    ]
  });
});

test("reports healthy stock transfer lifecycle projections", async () => {
  const result = await reconcileStockTransferEvents(
    new ReconciliationClient([
      {
        transfer_id: "transfer-1",
        request_event_id: "request-event-1",
        dispatched_event_id: "dispatch-event-1",
        received_event_id: "receipt-event-1",
        request_replayed: true,
        dispatch_replayed: true,
        receipt_replayed: true,
        expected_requested_quantity: 12,
        projected_requested_quantity: 12,
        expected_approved_quantity: 10,
        projected_approved_quantity: 10,
        expected_dispatched_quantity: 10,
        projected_dispatched_quantity: 10,
        expected_received_quantity: 9,
        projected_received_quantity: 9,
        projected_status: "received"
      }
    ])
  );

  assert.deepEqual(result, {
    checked: 1,
    healthy: 1,
    drifted: 0,
    unreplayed: 0,
    issues: []
  });
});

test("reports unreplayed stock transfer lifecycle events", async () => {
  const result = await reconcileStockTransferEvents(
    new ReconciliationClient([
      {
        transfer_id: "transfer-1",
        request_event_id: "request-event-1",
        dispatched_event_id: "dispatch-event-1",
        received_event_id: null,
        request_replayed: true,
        dispatch_replayed: false,
        receipt_replayed: false,
        expected_requested_quantity: 12,
        projected_requested_quantity: 12,
        expected_approved_quantity: 0,
        projected_approved_quantity: null,
        expected_dispatched_quantity: 10,
        projected_dispatched_quantity: null,
        expected_received_quantity: 0,
        projected_received_quantity: null,
        projected_status: "requested"
      }
    ])
  );

  assert.equal(result.checked, 1);
  assert.equal(result.healthy, 0);
  assert.equal(result.drifted, 0);
  assert.equal(result.unreplayed, 1);
  assert.deepEqual(result.issues[0], {
    transferId: "transfer-1",
    status: "unreplayed",
    messages: ["Transfer dispatch event has not been replayed into projections."]
  });
});

test("reports unreplayed stock transfer approval events", async () => {
  const result = await reconcileStockTransferEvents(
    new ReconciliationClient([
      {
        transfer_id: "transfer-1",
        request_event_id: "request-event-1",
        approved_event_id: "approval-event-1",
        dispatched_event_id: null,
        received_event_id: null,
        request_replayed: true,
        approval_replayed: false,
        dispatch_replayed: false,
        receipt_replayed: false,
        expected_requested_quantity: 12,
        projected_requested_quantity: 12,
        expected_approved_quantity: 10,
        projected_approved_quantity: null,
        expected_dispatched_quantity: 0,
        projected_dispatched_quantity: null,
        expected_received_quantity: 0,
        projected_received_quantity: null,
        projected_status: "requested"
      }
    ])
  );

  assert.equal(result.checked, 1);
  assert.equal(result.healthy, 0);
  assert.equal(result.drifted, 0);
  assert.equal(result.unreplayed, 1);
  assert.deepEqual(result.issues[0], {
    transferId: "transfer-1",
    status: "unreplayed",
    messages: ["Transfer approval event has not been replayed into projections."]
  });
});

test("reports stock transfer quantity drift", async () => {
  const result = await reconcileStockTransferEvents(
    new ReconciliationClient([
      {
        transfer_id: "transfer-1",
        request_event_id: "request-event-1",
        dispatched_event_id: "dispatch-event-1",
        received_event_id: "receipt-event-1",
        request_replayed: true,
        dispatch_replayed: true,
        receipt_replayed: true,
        expected_requested_quantity: 12,
        projected_requested_quantity: 12,
        expected_approved_quantity: 10,
        projected_approved_quantity: 8,
        expected_dispatched_quantity: 10,
        projected_dispatched_quantity: 8,
        expected_received_quantity: 9,
        projected_received_quantity: 7,
        projected_status: "dispatched"
      }
    ])
  );

  assert.equal(result.checked, 1);
  assert.equal(result.healthy, 0);
  assert.equal(result.drifted, 1);
  assert.equal(result.unreplayed, 0);
  assert.deepEqual(result.issues[0], {
    transferId: "transfer-1",
    status: "drifted",
    messages: [
      "Approved quantity mismatch: expected 10, projected 8.",
      "Dispatched quantity mismatch: expected 10, projected 8.",
      "Received quantity mismatch: expected 9, projected 7.",
      "Transfer status mismatch: expected received, projected dispatched."
    ]
  });
});
