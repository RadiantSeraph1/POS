export interface ReconciliationQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export type ReconciliationIssueStatus = "drifted" | "unreplayed";

export interface ReconciliationIssue {
  eventId: string;
  saleId: string;
  status: ReconciliationIssueStatus;
  messages: string[];
}

export interface ReconciliationSummary {
  checked: number;
  healthy: number;
  drifted: number;
  unreplayed: number;
  issues: ReconciliationIssue[];
}

export interface InventoryReconciliationIssue {
  organizationId: string;
  branchId: string;
  productId: string;
  productVariantId: string | null;
  expectedQuantityDelta: number;
  projectedQuantityDelta: number;
  message: string;
}

export interface InventoryReconciliationSummary {
  checked: number;
  healthy: number;
  drifted: number;
  issues: InventoryReconciliationIssue[];
}

export interface TransferReconciliationIssue {
  transferId: string;
  status: ReconciliationIssueStatus;
  messages: string[];
}

export interface TransferReconciliationSummary {
  checked: number;
  healthy: number;
  drifted: number;
  unreplayed: number;
  issues: TransferReconciliationIssue[];
}

interface SaleReconciliationRow extends Record<string, unknown> {
  event_id: string;
  sale_id: string;
  expected_total_minor: number;
  projected_total_minor: number | null;
  expected_item_count: number;
  projected_item_count: number;
  expected_payment_count: number;
  projected_payment_count: number;
  expected_payment_total_minor: number;
  projected_payment_total_minor: number;
  replayed: boolean;
}

interface InventoryReconciliationRow extends Record<string, unknown> {
  organization_id: string;
  branch_id: string;
  product_id: string;
  product_variant_id: string | null;
  expected_quantity_delta: number | string;
  projected_quantity_delta: number | string;
}

interface TransferReconciliationRow extends Record<string, unknown> {
  transfer_id: string;
  request_event_id: string | null;
  approved_event_id: string | null;
  dispatched_event_id: string | null;
  received_event_id: string | null;
  rejected_event_id: string | null;
  cancelled_event_id: string | null;
  request_replayed: boolean;
  approval_replayed: boolean;
  dispatch_replayed: boolean;
  receipt_replayed: boolean;
  rejection_replayed: boolean;
  cancellation_replayed: boolean;
  expected_requested_quantity: number | string;
  projected_requested_quantity: number | string | null;
  expected_approved_quantity: number | string;
  projected_approved_quantity: number | string | null;
  expected_dispatched_quantity: number | string;
  projected_dispatched_quantity: number | string | null;
  expected_received_quantity: number | string;
  projected_received_quantity: number | string | null;
  projected_status: string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return 0;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function buildIssue(row: SaleReconciliationRow): ReconciliationIssue | null {
  const eventId = String(row.event_id);
  const saleId = String(row.sale_id);

  if (!toBoolean(row.replayed)) {
    return {
      eventId,
      saleId,
      status: "unreplayed",
      messages: ["Sale event has not been replayed into projections."]
    };
  }

  const messages: string[] = [];
  const expectedTotal = toNumber(row.expected_total_minor);
  const projectedTotal =
    row.projected_total_minor === null ? null : toNumber(row.projected_total_minor);
  const expectedItemCount = toNumber(row.expected_item_count);
  const projectedItemCount = toNumber(row.projected_item_count);
  const expectedPaymentCount = toNumber(row.expected_payment_count);
  const projectedPaymentCount = toNumber(row.projected_payment_count);
  const expectedPaymentTotal = toNumber(row.expected_payment_total_minor);
  const projectedPaymentTotal = toNumber(row.projected_payment_total_minor);

  if (projectedTotal !== expectedTotal) {
    messages.push(`Sale total mismatch: expected ${expectedTotal}, projected ${projectedTotal}.`);
  }

  if (projectedItemCount !== expectedItemCount) {
    messages.push(
      `Sale item count mismatch: expected ${expectedItemCount}, projected ${projectedItemCount}.`
    );
  }

  if (projectedPaymentCount !== expectedPaymentCount) {
    messages.push(
      `Payment count mismatch: expected ${expectedPaymentCount}, projected ${projectedPaymentCount}.`
    );
  }

  if (projectedPaymentTotal !== expectedPaymentTotal) {
    messages.push(
      `Payment total mismatch: expected ${expectedPaymentTotal}, projected ${projectedPaymentTotal}.`
    );
  }

  if (messages.length === 0) {
    return null;
  }

  return {
    eventId,
    saleId,
    status: "drifted",
    messages
  };
}

function buildTransferIssue(row: TransferReconciliationRow): TransferReconciliationIssue | null {
  const transferId = String(row.transfer_id);
  const messages: string[] = [];

  if (!toBoolean(row.request_replayed)) {
    messages.push("Transfer request event has not been replayed into projections.");
  }

  if (row.approved_event_id != null && !toBoolean(row.approval_replayed)) {
    messages.push("Transfer approval event has not been replayed into projections.");
  }

  if (row.dispatched_event_id != null && !toBoolean(row.dispatch_replayed)) {
    messages.push("Transfer dispatch event has not been replayed into projections.");
  }

  if (row.received_event_id != null && !toBoolean(row.receipt_replayed)) {
    messages.push("Transfer receipt event has not been replayed into projections.");
  }

  if (row.rejected_event_id != null && !toBoolean(row.rejection_replayed)) {
    messages.push("Transfer rejection event has not been replayed into projections.");
  }

  if (row.cancelled_event_id != null && !toBoolean(row.cancellation_replayed)) {
    messages.push("Transfer cancellation event has not been replayed into projections.");
  }

  if (messages.length > 0) {
    return {
      transferId,
      status: "unreplayed",
      messages
    };
  }

  const expectedRequested = toNumber(row.expected_requested_quantity);
  const projectedRequested =
    row.projected_requested_quantity === null ? null : toNumber(row.projected_requested_quantity);
  const expectedApproved = toNumber(row.expected_approved_quantity);
  const projectedApproved =
    row.projected_approved_quantity === null ? null : toNumber(row.projected_approved_quantity);
  const expectedDispatched = toNumber(row.expected_dispatched_quantity);
  const projectedDispatched =
    row.projected_dispatched_quantity === null ? null : toNumber(row.projected_dispatched_quantity);
  const expectedReceived = toNumber(row.expected_received_quantity);
  const projectedReceived =
    row.projected_received_quantity === null ? null : toNumber(row.projected_received_quantity);

  if (projectedRequested !== expectedRequested) {
    messages.push(`Requested quantity mismatch: expected ${expectedRequested}, projected ${projectedRequested}.`);
  }

  if (projectedApproved !== expectedApproved) {
    messages.push(`Approved quantity mismatch: expected ${expectedApproved}, projected ${projectedApproved}.`);
  }

  if (projectedDispatched !== expectedDispatched) {
    messages.push(`Dispatched quantity mismatch: expected ${expectedDispatched}, projected ${projectedDispatched}.`);
  }

  if (projectedReceived !== expectedReceived) {
    messages.push(`Received quantity mismatch: expected ${expectedReceived}, projected ${projectedReceived}.`);
  }

  const expectedStatus =
    row.received_event_id != null || expectedReceived > 0
      ? "received"
      : row.cancelled_event_id != null
        ? "cancelled"
        : row.rejected_event_id != null
          ? "rejected"
      : expectedDispatched > 0
        ? "dispatched"
        : expectedApproved > 0
          ? "approved"
          : "requested";

  if (row.projected_status !== expectedStatus) {
    messages.push(`Transfer status mismatch: expected ${expectedStatus}, projected ${row.projected_status}.`);
  }

  if (messages.length === 0) {
    return null;
  }

  return {
    transferId,
    status: "drifted",
    messages
  };
}

export async function reconcileSaleCreatedEvents(
  client: ReconciliationQueryClient,
  limit = 100
): Promise<ReconciliationSummary> {
  const result = await client.query<SaleReconciliationRow>(
    `
      WITH sale_events AS (
        SELECT
          inventory_events.id AS event_id,
          inventory_events.payload_json,
          inventory_events.payload_json->>'saleId' AS sale_id,
          (inventory_events.payload_json->>'totalMinor')::BIGINT AS expected_total_minor,
          jsonb_array_length(inventory_events.payload_json->'items') AS expected_item_count,
          jsonb_array_length(inventory_events.payload_json->'payments') AS expected_payment_count,
          COALESCE((
            SELECT SUM((payment->>'amountMinor')::BIGINT)
            FROM jsonb_array_elements(inventory_events.payload_json->'payments') AS payment
          ), 0) AS expected_payment_total_minor,
          sync_replay_log.event_id IS NOT NULL AS replayed
        FROM inventory_events
        LEFT JOIN sync_replay_log
          ON sync_replay_log.event_id = inventory_events.id
        WHERE inventory_events.event_type = 'SALE_CREATED'
        ORDER BY inventory_events.received_at, inventory_events.id
        LIMIT $1
      )
      SELECT
        sale_events.event_id,
        sale_events.sale_id,
        sale_events.expected_total_minor,
        sales.total_minor AS projected_total_minor,
        sale_events.expected_item_count,
        COUNT(DISTINCT sale_items.id)::INTEGER AS projected_item_count,
        sale_events.expected_payment_count,
        COUNT(DISTINCT payments.id)::INTEGER AS projected_payment_count,
        sale_events.expected_payment_total_minor,
        COALESCE(SUM(DISTINCT payments.amount_minor), 0)::BIGINT AS projected_payment_total_minor,
        sale_events.replayed
      FROM sale_events
      LEFT JOIN sales
        ON sales.id = sale_events.sale_id::UUID
      LEFT JOIN sale_items
        ON sale_items.sale_id = sales.id
      LEFT JOIN payments
        ON payments.sale_id = sales.id
      GROUP BY
        sale_events.event_id,
        sale_events.sale_id,
        sale_events.expected_total_minor,
        sales.total_minor,
        sale_events.expected_item_count,
        sale_events.expected_payment_count,
        sale_events.expected_payment_total_minor,
        sale_events.replayed
      ORDER BY sale_events.event_id
    `,
    [limit]
  );

  const issues = result.rows
    .map((row) => buildIssue(row))
    .filter((issue): issue is ReconciliationIssue => issue !== null);
  const unreplayed = issues.filter((issue) => issue.status === "unreplayed").length;
  const drifted = issues.filter((issue) => issue.status === "drifted").length;

  return {
    checked: result.rows.length,
    healthy: result.rows.length - issues.length,
    drifted,
    unreplayed,
    issues
  };
}

export async function reconcileInventoryLevelsForSaleEvents(
  client: ReconciliationQueryClient,
  limit = 100
): Promise<InventoryReconciliationSummary> {
  const result = await client.query<InventoryReconciliationRow>(
    `
      WITH sold_lines AS (
        SELECT
          inventory_events.payload_json->>'organizationId' AS organization_id,
          inventory_events.payload_json->>'branchId' AS branch_id,
          item->>'productId' AS product_id,
          NULLIF(item->>'productVariantId', '') AS product_variant_id,
          SUM((item->>'quantity')::NUMERIC) * -1 AS expected_quantity_delta
        FROM inventory_events
        JOIN sync_replay_log
          ON sync_replay_log.event_id = inventory_events.id
        CROSS JOIN LATERAL jsonb_array_elements(inventory_events.payload_json->'items') AS item
        WHERE inventory_events.event_type = 'SALE_CREATED'
        GROUP BY
          inventory_events.payload_json->>'organizationId',
          inventory_events.payload_json->>'branchId',
          item->>'productId',
          NULLIF(item->>'productVariantId', '')
        ORDER BY
          inventory_events.payload_json->>'organizationId',
          inventory_events.payload_json->>'branchId',
          item->>'productId',
          NULLIF(item->>'productVariantId', '')
        LIMIT $1
      )
      SELECT
        sold_lines.organization_id,
        sold_lines.branch_id,
        sold_lines.product_id,
        sold_lines.product_variant_id,
        sold_lines.expected_quantity_delta,
        COALESCE(inventory_levels.sellable_quantity, 0) AS projected_quantity_delta
      FROM sold_lines
      LEFT JOIN inventory_levels
        ON inventory_levels.organization_id = sold_lines.organization_id::UUID
       AND inventory_levels.location_type = 'branch'
       AND inventory_levels.location_id = sold_lines.branch_id::UUID
       AND inventory_levels.product_id = sold_lines.product_id::UUID
       AND COALESCE(
          inventory_levels.product_variant_id,
          '00000000-0000-0000-0000-000000000000'::UUID
        ) = COALESCE(
          sold_lines.product_variant_id::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
    `,
    [limit]
  );

  const issues = result.rows.flatMap((row): InventoryReconciliationIssue[] => {
    const expectedQuantityDelta = toNumber(row.expected_quantity_delta);
    const projectedQuantityDelta = toNumber(row.projected_quantity_delta);

    if (expectedQuantityDelta === projectedQuantityDelta) {
      return [];
    }

    return [
      {
        organizationId: row.organization_id,
        branchId: row.branch_id,
        productId: row.product_id,
        productVariantId: row.product_variant_id,
        expectedQuantityDelta,
        projectedQuantityDelta,
        message: `Inventory quantity mismatch: expected ${expectedQuantityDelta}, projected ${projectedQuantityDelta}.`
      }
    ];
  });

  return {
    checked: result.rows.length,
    healthy: result.rows.length - issues.length,
    drifted: issues.length,
    issues
  };
}

export async function reconcileStockTransferEvents(
  client: ReconciliationQueryClient,
  limit = 100
): Promise<TransferReconciliationSummary> {
  const result = await client.query<TransferReconciliationRow>(
    `
      WITH transfer_events AS (
        SELECT
          inventory_events.id AS event_id,
          inventory_events.event_type,
          inventory_events.payload_json,
          inventory_events.payload_json->>'transferId' AS transfer_id,
          sync_replay_log.event_id IS NOT NULL AS replayed
        FROM inventory_events
        LEFT JOIN sync_replay_log
          ON sync_replay_log.event_id = inventory_events.id
        WHERE inventory_events.event_type IN (
          'STOCK_TRANSFER_REQUESTED',
          'STOCK_TRANSFER_APPROVED',
          'STOCK_TRANSFER_DISPATCHED',
          'STOCK_TRANSFER_RECEIVED',
          'STOCK_TRANSFER_REJECTED',
          'STOCK_TRANSFER_CANCELLED'
        )
        ORDER BY inventory_events.received_at, inventory_events.id
        LIMIT $1
      ),
      transfer_rollup AS (
        SELECT
          transfer_events.transfer_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_REQUESTED'
          ) AS request_event_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_APPROVED'
          ) AS approved_event_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_DISPATCHED'
          ) AS dispatched_event_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_RECEIVED'
          ) AS received_event_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_REJECTED'
          ) AS rejected_event_id,
          MAX(transfer_events.event_id::TEXT) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_CANCELLED'
          ) AS cancelled_event_id,
          BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_REQUESTED'
          ) AS request_replayed,
          COALESCE(BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_APPROVED'
          ), FALSE) AS approval_replayed,
          COALESCE(BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_DISPATCHED'
          ), FALSE) AS dispatch_replayed,
          COALESCE(BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_RECEIVED'
          ), FALSE) AS receipt_replayed,
          COALESCE(BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_REJECTED'
          ), FALSE) AS rejection_replayed,
          COALESCE(BOOL_OR(transfer_events.replayed) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_CANCELLED'
          ), FALSE) AS cancellation_replayed,
          COALESCE(SUM((request_item->>'quantity')::NUMERIC) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_REQUESTED'
          ), 0) AS expected_requested_quantity,
          COALESCE(SUM((approval_item->>'approvedQuantity')::NUMERIC) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_APPROVED'
          ), 0) AS expected_approved_quantity,
          COALESCE(SUM((dispatch_item->>'dispatchedQuantity')::NUMERIC) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_DISPATCHED'
          ), 0) AS expected_dispatched_quantity,
          COALESCE(SUM((receipt_item->>'receivedQuantity')::NUMERIC) FILTER (
            WHERE transfer_events.event_type = 'STOCK_TRANSFER_RECEIVED'
          ), 0) AS expected_received_quantity
        FROM transfer_events
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN transfer_events.event_type = 'STOCK_TRANSFER_REQUESTED'
            THEN transfer_events.payload_json->'items'
            ELSE '[]'::JSONB
          END
        ) AS request_item ON TRUE
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN transfer_events.event_type = 'STOCK_TRANSFER_APPROVED'
            THEN transfer_events.payload_json->'items'
            ELSE '[]'::JSONB
          END
        ) AS approval_item ON TRUE
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN transfer_events.event_type = 'STOCK_TRANSFER_DISPATCHED'
            THEN transfer_events.payload_json->'items'
            ELSE '[]'::JSONB
          END
        ) AS dispatch_item ON TRUE
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN transfer_events.event_type = 'STOCK_TRANSFER_RECEIVED'
            THEN transfer_events.payload_json->'items'
            ELSE '[]'::JSONB
          END
        ) AS receipt_item ON TRUE
        GROUP BY transfer_events.transfer_id
      )
      SELECT
        transfer_rollup.transfer_id,
        transfer_rollup.request_event_id,
        transfer_rollup.approved_event_id,
        transfer_rollup.dispatched_event_id,
        transfer_rollup.received_event_id,
        transfer_rollup.rejected_event_id,
        transfer_rollup.cancelled_event_id,
        COALESCE(transfer_rollup.request_replayed, FALSE) AS request_replayed,
        transfer_rollup.approval_replayed,
        transfer_rollup.dispatch_replayed,
        transfer_rollup.receipt_replayed,
        transfer_rollup.rejection_replayed,
        transfer_rollup.cancellation_replayed,
        transfer_rollup.expected_requested_quantity,
        COALESCE(SUM(transfer_items.requested_quantity), 0) AS projected_requested_quantity,
        transfer_rollup.expected_approved_quantity,
        COALESCE(SUM(transfer_items.approved_quantity), 0) AS projected_approved_quantity,
        transfer_rollup.expected_dispatched_quantity,
        COALESCE(SUM(transfer_items.dispatched_quantity), 0) AS projected_dispatched_quantity,
        transfer_rollup.expected_received_quantity,
        COALESCE(SUM(transfer_items.received_quantity), 0) AS projected_received_quantity,
        stock_transfers.status AS projected_status
      FROM transfer_rollup
      LEFT JOIN stock_transfers
        ON stock_transfers.id = transfer_rollup.transfer_id::UUID
      LEFT JOIN transfer_items
        ON transfer_items.stock_transfer_id = stock_transfers.id
      GROUP BY
        transfer_rollup.transfer_id,
        transfer_rollup.request_event_id,
        transfer_rollup.approved_event_id,
        transfer_rollup.dispatched_event_id,
        transfer_rollup.received_event_id,
        transfer_rollup.rejected_event_id,
        transfer_rollup.cancelled_event_id,
        transfer_rollup.request_replayed,
        transfer_rollup.approval_replayed,
        transfer_rollup.dispatch_replayed,
        transfer_rollup.receipt_replayed,
        transfer_rollup.rejection_replayed,
        transfer_rollup.cancellation_replayed,
        transfer_rollup.expected_requested_quantity,
        transfer_rollup.expected_approved_quantity,
        transfer_rollup.expected_dispatched_quantity,
        transfer_rollup.expected_received_quantity,
        stock_transfers.status
      ORDER BY transfer_rollup.transfer_id
    `,
    [limit]
  );

  const issues = result.rows
    .map((row) => buildTransferIssue(row))
    .filter((issue): issue is TransferReconciliationIssue => issue !== null);
  const unreplayed = issues.filter((issue) => issue.status === "unreplayed").length;
  const drifted = issues.filter((issue) => issue.status === "drifted").length;

  return {
    checked: result.rows.length,
    healthy: result.rows.length - issues.length,
    drifted,
    unreplayed,
    issues
  };
}
