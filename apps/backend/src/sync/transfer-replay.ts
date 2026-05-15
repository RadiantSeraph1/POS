import type { SyncEnvelope } from "../../../../packages/types/src/index.ts";

export interface TransferReplayQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export interface TransferReplayResult {
  transferId: string;
  items: number;
  replayed: boolean;
}

export interface TransferReplayBatchSummary {
  scanned: number;
  replayed: number;
  skipped: number;
  failed: number;
}

interface TransferItemPayload {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  quantity: number;
}

interface StockTransferRequestedPayload {
  transferId: string;
  requestNumber: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  destinationType: string;
  destinationId: string;
  requestedByUserId: string;
  items: TransferItemPayload[];
}

interface TransferDispatchItemPayload {
  transferItemId: string;
  dispatchedQuantity: number;
}

interface TransferApprovalItemPayload {
  transferItemId: string;
  approvedQuantity: number;
}

interface StockTransferApprovedPayload {
  transferId: string;
  approvedByUserId: string;
  approvedAt: string;
  items: TransferApprovalItemPayload[];
}

interface StockTransferDispatchedPayload {
  transferId: string;
  dispatchId: string;
  warehouseId: string;
  dispatchedByUserId: string;
  dispatchedAt: string;
  items: TransferDispatchItemPayload[];
}

interface TransferReceiptItemPayload {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  receivedQuantity: number;
}

interface StockTransferReceivedPayload {
  transferId: string;
  receiptId: string;
  organizationId: string;
  branchId: string;
  receivedByUserId: string;
  receivedAt: string;
  notes?: string;
  items: TransferReceiptItemPayload[];
}

interface StockTransferRejectedPayload {
  transferId: string;
  rejectedByUserId: string;
  rejectedAt: string;
  reason: string;
}

interface StockTransferCancelledPayload {
  transferId: string;
  cancelledByUserId: string;
  cancelledAt: string;
  reason: string;
}

interface PendingTransferEventRow extends Record<string, unknown> {
  id: string;
  event_type: SyncEnvelope["eventType"];
  aggregate_type: SyncEnvelope["aggregateType"];
  aggregate_id: string;
  payload_json: Record<string, unknown>;
  local_created_at: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}

function asObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`STOCK_TRANSFER_REQUESTED payload field '${fieldName}' must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`STOCK_TRANSFER_REQUESTED payload field '${fieldName}' must be an array.`);
  }

  return value.map((entry) => asObject(entry, fieldName));
}

function requiredString(payload: Record<string, unknown>, fieldName: string): string {
  const value = payload[fieldName];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`STOCK_TRANSFER_REQUESTED payload is missing '${fieldName}'.`);
  }

  return value;
}

function optionalString(payload: Record<string, unknown>, fieldName: string): string | undefined {
  const value = payload[fieldName];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`STOCK_TRANSFER_REQUESTED payload field '${fieldName}' must be a string.`);
  }

  return value;
}

function requiredNumber(payload: Record<string, unknown>, fieldName: string): number {
  const value = payload[fieldName];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`STOCK_TRANSFER_REQUESTED payload is missing numeric '${fieldName}'.`);
  }

  return value;
}

function parseStockTransferRequestedPayload(envelope: SyncEnvelope): StockTransferRequestedPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_REQUESTED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_REQUESTED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");
  const items = asArray(payload.items, "items");

  return {
    transferId: requiredString(payload, "transferId"),
    requestNumber: requiredString(payload, "requestNumber"),
    organizationId: requiredString(payload, "organizationId"),
    sourceType: requiredString(payload, "sourceType"),
    sourceId: requiredString(payload, "sourceId"),
    destinationType: requiredString(payload, "destinationType"),
    destinationId: requiredString(payload, "destinationId"),
    requestedByUserId: requiredString(payload, "requestedByUserId"),
    items: items.map((item) => {
      const productVariantId = optionalString(item, "productVariantId");

      return {
        transferItemId: requiredString(item, "transferItemId"),
        productId: requiredString(item, "productId"),
        ...(productVariantId ? { productVariantId } : {}),
        quantity: requiredNumber(item, "quantity")
      };
    })
  };
}

function parseStockTransferDispatchedPayload(envelope: SyncEnvelope): StockTransferDispatchedPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_DISPATCHED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_DISPATCHED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");
  const items = asArray(payload.items, "items");

  return {
    transferId: requiredString(payload, "transferId"),
    dispatchId: requiredString(payload, "dispatchId"),
    warehouseId: requiredString(payload, "warehouseId"),
    dispatchedByUserId: requiredString(payload, "dispatchedByUserId"),
    dispatchedAt: requiredString(payload, "dispatchedAt"),
    items: items.map((item) => ({
      transferItemId: requiredString(item, "transferItemId"),
      dispatchedQuantity: requiredNumber(item, "dispatchedQuantity")
    }))
  };
}

function parseStockTransferApprovedPayload(envelope: SyncEnvelope): StockTransferApprovedPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_APPROVED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_APPROVED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");
  const items = asArray(payload.items, "items");

  return {
    transferId: requiredString(payload, "transferId"),
    approvedByUserId: requiredString(payload, "approvedByUserId"),
    approvedAt: requiredString(payload, "approvedAt"),
    items: items.map((item) => ({
      transferItemId: requiredString(item, "transferItemId"),
      approvedQuantity: requiredNumber(item, "approvedQuantity")
    }))
  };
}

function parseStockTransferReceivedPayload(envelope: SyncEnvelope): StockTransferReceivedPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_RECEIVED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_RECEIVED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");
  const items = asArray(payload.items, "items");
  const notes = optionalString(payload, "notes");

  return {
    transferId: requiredString(payload, "transferId"),
    receiptId: requiredString(payload, "receiptId"),
    organizationId: requiredString(payload, "organizationId"),
    branchId: requiredString(payload, "branchId"),
    receivedByUserId: requiredString(payload, "receivedByUserId"),
    receivedAt: requiredString(payload, "receivedAt"),
    ...(notes ? { notes } : {}),
    items: items.map((item) => {
      const productVariantId = optionalString(item, "productVariantId");

      return {
        transferItemId: requiredString(item, "transferItemId"),
        productId: requiredString(item, "productId"),
        ...(productVariantId ? { productVariantId } : {}),
        receivedQuantity: requiredNumber(item, "receivedQuantity")
      };
    })
  };
}

function parseStockTransferRejectedPayload(envelope: SyncEnvelope): StockTransferRejectedPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_REJECTED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_REJECTED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");

  return {
    transferId: requiredString(payload, "transferId"),
    rejectedByUserId: requiredString(payload, "rejectedByUserId"),
    rejectedAt: requiredString(payload, "rejectedAt"),
    reason: requiredString(payload, "reason")
  };
}

function parseStockTransferCancelledPayload(envelope: SyncEnvelope): StockTransferCancelledPayload {
  if (envelope.eventType !== "STOCK_TRANSFER_CANCELLED" || envelope.aggregateType !== "stock_transfer") {
    throw new Error("Only STOCK_TRANSFER_CANCELLED stock_transfer events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");

  return {
    transferId: requiredString(payload, "transferId"),
    cancelledByUserId: requiredString(payload, "cancelledByUserId"),
    cancelledAt: requiredString(payload, "cancelledAt"),
    reason: requiredString(payload, "reason")
  };
}

async function claimReplayEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<boolean> {
  const replayClaim = await client.query<{ event_id: string }>(
    `
      INSERT INTO sync_replay_log (
        event_id,
        event_type,
        aggregate_type,
        aggregate_id,
        projected_at
      )
      VALUES ($1::UUID, $2, $3, $4::UUID, NOW())
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `,
    [envelope.eventId, envelope.eventType, envelope.aggregateType, envelope.aggregateId]
  );

  return replayClaim.rows.length > 0;
}

export async function replayStockTransferRequestedEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const transfer = parseStockTransferRequestedPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: transfer.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        INSERT INTO stock_transfers (
          id,
          organization_id,
          source_type,
          source_id,
          destination_type,
          destination_id,
          request_number,
          status,
          requested_by_user_id,
          created_at,
          updated_at
        )
        VALUES ($1::UUID, $2::UUID, $3, $4::UUID, $5, $6::UUID, $7, $8, $9::UUID, $10::TIMESTAMPTZ, $10::TIMESTAMPTZ)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        transfer.transferId,
        transfer.organizationId,
        transfer.sourceType,
        transfer.sourceId,
        transfer.destinationType,
        transfer.destinationId,
        transfer.requestNumber,
        "requested",
        transfer.requestedByUserId,
        envelope.createdAt
      ]
    );

    for (const item of transfer.items) {
      await client.query(
        `
          INSERT INTO transfer_items (
            id,
            stock_transfer_id,
            product_id,
            product_variant_id,
            requested_quantity,
            created_at,
            updated_at
          )
          VALUES ($1::UUID, $2::UUID, $3::UUID, $4::UUID, $5, $6::TIMESTAMPTZ, $6::TIMESTAMPTZ)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          item.transferItemId,
          transfer.transferId,
          item.productId,
          item.productVariantId ?? null,
          item.quantity,
          envelope.createdAt
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: transfer.transferId,
    items: transfer.items.length,
    replayed: true
  };
}

export async function replayStockTransferApprovedEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const approval = parseStockTransferApprovedPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: approval.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        UPDATE stock_transfers
        SET
          status = CASE
            WHEN status = 'requested' THEN 'approved'
            ELSE status
          END,
          approved_by_user_id = $3::UUID,
          updated_at = $2::TIMESTAMPTZ
        WHERE id = $1::UUID
      `,
      [approval.transferId, approval.approvedAt, approval.approvedByUserId]
    );

    for (const item of approval.items) {
      await client.query(
        `
          UPDATE transfer_items
          SET
            approved_quantity = $2,
            updated_at = $3::TIMESTAMPTZ
          WHERE id = $1::UUID
        `,
        [item.transferItemId, item.approvedQuantity, approval.approvedAt]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: approval.transferId,
    items: approval.items.length,
    replayed: true
  };
}

export async function replayStockTransferDispatchedEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const dispatch = parseStockTransferDispatchedPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: dispatch.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        UPDATE stock_transfers
        SET
          status = 'dispatched',
          dispatched_at = $2::TIMESTAMPTZ,
          approved_by_user_id = COALESCE(approved_by_user_id, $3::UUID),
          updated_at = $2::TIMESTAMPTZ
        WHERE id = $1::UUID
      `,
      [dispatch.transferId, dispatch.dispatchedAt, dispatch.dispatchedByUserId]
    );

    await client.query(
      `
        INSERT INTO warehouse_dispatches (
          id,
          stock_transfer_id,
          warehouse_id,
          dispatched_by_user_id,
          dispatched_at,
          status,
          created_at
        )
        VALUES ($1::UUID, $2::UUID, $3::UUID, $4::UUID, $5::TIMESTAMPTZ, 'dispatched', $5::TIMESTAMPTZ)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        dispatch.dispatchId,
        dispatch.transferId,
        dispatch.warehouseId,
        dispatch.dispatchedByUserId,
        dispatch.dispatchedAt
      ]
    );

    for (const item of dispatch.items) {
      await client.query(
        `
          UPDATE transfer_items
          SET
            dispatched_quantity = $2,
            updated_at = $3::TIMESTAMPTZ
          WHERE id = $1::UUID
        `,
        [item.transferItemId, item.dispatchedQuantity, dispatch.dispatchedAt]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: dispatch.transferId,
    items: dispatch.items.length,
    replayed: true
  };
}

export async function replayStockTransferReceivedEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const receipt = parseStockTransferReceivedPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: receipt.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        UPDATE stock_transfers
        SET
          status = 'received',
          received_at = $2::TIMESTAMPTZ,
          updated_at = $2::TIMESTAMPTZ
        WHERE id = $1::UUID
      `,
      [receipt.transferId, receipt.receivedAt]
    );

    await client.query(
      `
        INSERT INTO warehouse_receipts (
          id,
          stock_transfer_id,
          branch_id,
          received_by_user_id,
          received_at,
          status,
          notes,
          created_at
        )
        VALUES ($1::UUID, $2::UUID, $3::UUID, $4::UUID, $5::TIMESTAMPTZ, 'received', $6, $5::TIMESTAMPTZ)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        receipt.receiptId,
        receipt.transferId,
        receipt.branchId,
        receipt.receivedByUserId,
        receipt.receivedAt,
        receipt.notes ?? null
      ]
    );

    for (const item of receipt.items) {
      await client.query(
        `
          UPDATE transfer_items
          SET
            received_quantity = $2,
            updated_at = $3::TIMESTAMPTZ
          WHERE id = $1::UUID
        `,
        [item.transferItemId, item.receivedQuantity, receipt.receivedAt]
      );

      await client.query(
        `
          INSERT INTO inventory_levels (
            organization_id,
            location_type,
            location_id,
            product_id,
            product_variant_id,
            sellable_quantity,
            last_event_id,
            updated_at
          )
          VALUES ($1::UUID, 'branch', $2::UUID, $3::UUID, $4::UUID, $5, $6::UUID, $7::TIMESTAMPTZ)
          ON CONFLICT (
            organization_id,
            location_type,
            location_id,
            product_id,
            COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::UUID)
          )
          DO UPDATE SET
            sellable_quantity = inventory_levels.sellable_quantity + EXCLUDED.sellable_quantity,
            last_event_id = EXCLUDED.last_event_id,
            updated_at = EXCLUDED.updated_at
        `,
        [
          receipt.organizationId,
          receipt.branchId,
          item.productId,
          item.productVariantId ?? null,
          item.receivedQuantity,
          envelope.eventId,
          receipt.receivedAt
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: receipt.transferId,
    items: receipt.items.length,
    replayed: true
  };
}

export async function replayStockTransferRejectedEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const rejection = parseStockTransferRejectedPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: rejection.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        UPDATE stock_transfers
        SET
          status = CASE
            WHEN status = 'received' THEN status
            ELSE 'rejected'
          END,
          approved_by_user_id = COALESCE(approved_by_user_id, $3::UUID),
          updated_at = $2::TIMESTAMPTZ
        WHERE id = $1::UUID
      `,
      [rejection.transferId, rejection.rejectedAt, rejection.rejectedByUserId, rejection.reason]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: rejection.transferId,
    items: 0,
    replayed: true
  };
}

export async function replayStockTransferCancelledEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  const cancellation = parseStockTransferCancelledPayload(envelope);

  await client.query("BEGIN");

  try {
    if (!(await claimReplayEvent(client, envelope))) {
      await client.query("COMMIT");
      return {
        transferId: cancellation.transferId,
        items: 0,
        replayed: false
      };
    }

    await client.query(
      `
        UPDATE stock_transfers
        SET
          status = CASE
            WHEN status = 'received' THEN status
            ELSE 'cancelled'
          END,
          updated_at = $2::TIMESTAMPTZ
        WHERE id = $1::UUID
      `,
      [cancellation.transferId, cancellation.cancelledAt, cancellation.cancelledByUserId, cancellation.reason]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    transferId: cancellation.transferId,
    items: 0,
    replayed: true
  };
}

async function replayTransferEvent(
  client: TransferReplayQueryClient,
  envelope: SyncEnvelope
): Promise<TransferReplayResult> {
  if (envelope.eventType === "STOCK_TRANSFER_REQUESTED") {
    return replayStockTransferRequestedEvent(client, envelope);
  }

  if (envelope.eventType === "STOCK_TRANSFER_DISPATCHED") {
    return replayStockTransferDispatchedEvent(client, envelope);
  }

  if (envelope.eventType === "STOCK_TRANSFER_APPROVED") {
    return replayStockTransferApprovedEvent(client, envelope);
  }

  if (envelope.eventType === "STOCK_TRANSFER_RECEIVED") {
    return replayStockTransferReceivedEvent(client, envelope);
  }

  if (envelope.eventType === "STOCK_TRANSFER_REJECTED") {
    return replayStockTransferRejectedEvent(client, envelope);
  }

  if (envelope.eventType === "STOCK_TRANSFER_CANCELLED") {
    return replayStockTransferCancelledEvent(client, envelope);
  }

  throw new Error(`Unsupported transfer event type '${envelope.eventType}'.`);
}

export async function replayPendingStockTransferRequestedEvents(
  client: TransferReplayQueryClient,
  limit = 100
): Promise<TransferReplayBatchSummary> {
  const pendingEvents = await client.query<PendingTransferEventRow>(
    `
      SELECT
        inventory_events.id,
        inventory_events.event_type,
        inventory_events.aggregate_type,
        inventory_events.aggregate_id::TEXT,
        inventory_events.payload_json,
        inventory_events.local_created_at::TEXT
      FROM inventory_events
      LEFT JOIN sync_replay_log
        ON sync_replay_log.event_id = inventory_events.id
      WHERE inventory_events.event_type = 'STOCK_TRANSFER_REQUESTED'
        AND sync_replay_log.event_id IS NULL
      ORDER BY inventory_events.received_at, inventory_events.id
      LIMIT $1
    `,
    [limit]
  );

  const summary: TransferReplayBatchSummary = {
    scanned: pendingEvents.rows.length,
    replayed: 0,
    skipped: 0,
    failed: 0
  };

  for (const row of pendingEvents.rows) {
    try {
      const result = await replayStockTransferRequestedEvent(client, {
        eventId: row.id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: row.payload_json,
        createdAt: row.local_created_at
      });

      if (result.replayed) {
        summary.replayed += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      await client.query(
        `
          INSERT INTO sync_replay_failures (
            event_id,
            event_type,
            aggregate_type,
            aggregate_id,
            error_message,
            failed_at
          )
          VALUES ($1::UUID, $2, $3, $4::UUID, $5, NOW())
        `,
        [
          row.id,
          row.event_type,
          row.aggregate_type,
          row.aggregate_id,
          errorMessage(error)
        ]
      );
      summary.failed += 1;
    }
  }

  return summary;
}

export async function replayPendingStockTransferEvents(
  client: TransferReplayQueryClient,
  limit = 100
): Promise<TransferReplayBatchSummary> {
  const pendingEvents = await client.query<PendingTransferEventRow>(
    `
      SELECT
        inventory_events.id,
        inventory_events.event_type,
        inventory_events.aggregate_type,
        inventory_events.aggregate_id::TEXT,
        inventory_events.payload_json,
        inventory_events.local_created_at::TEXT
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
        AND sync_replay_log.event_id IS NULL
      ORDER BY inventory_events.received_at, inventory_events.id
      LIMIT $1
    `,
    [limit]
  );

  const summary: TransferReplayBatchSummary = {
    scanned: pendingEvents.rows.length,
    replayed: 0,
    skipped: 0,
    failed: 0
  };

  for (const row of pendingEvents.rows) {
    try {
      const result = await replayTransferEvent(client, {
        eventId: row.id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: row.payload_json,
        createdAt: row.local_created_at
      });

      if (result.replayed) {
        summary.replayed += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      await client.query(
        `
          INSERT INTO sync_replay_failures (
            event_id,
            event_type,
            aggregate_type,
            aggregate_id,
            error_message,
            failed_at
          )
          VALUES ($1::UUID, $2, $3, $4::UUID, $5, NOW())
        `,
        [
          row.id,
          row.event_type,
          row.aggregate_type,
          row.aggregate_id,
          errorMessage(error)
        ]
      );
      summary.failed += 1;
    }
  }

  return summary;
}
