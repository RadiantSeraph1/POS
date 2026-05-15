import type {
  AggregateType,
  CreateLocalSaleInput,
  InventoryEvent,
  SaleCreatedPayload,
  SyncQueueStatus
} from "../../../../packages/types/src/index.ts";

import type { DbTransaction, TransactionRunner } from "../db.ts";

const SALE_STATUS_COMPLETED = "completed";
const PAYMENT_STATUS_COMPLETED = "completed";
const RECEIPT_STATUS_PENDING = "pending";
const SYNC_STATUS_PENDING: SyncQueueStatus = "pending";
const SALE_AGGREGATE_TYPE: AggregateType = "sale";

interface InventoryLevelRow {
  sellable_quantity: number;
}

function assertValidSaleInput(input: CreateLocalSaleInput): void {
  if (input.items.length === 0) {
    throw new Error("A local sale must include at least one item.");
  }

  if (input.payments.length === 0) {
    throw new Error("A local sale must include at least one payment.");
  }

  const totalPaid = input.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  if (totalPaid !== input.totalMinor) {
    throw new Error("Payment total must match sale total.");
  }

  const computedItemTotal = input.items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  if (computedItemTotal !== input.totalMinor) {
    throw new Error("Line item total must match sale total.");
  }
}

function buildSaleCreatedPayload(input: CreateLocalSaleInput): SaleCreatedPayload {
  const customerId = input.customerId;

  return {
    saleId: input.saleId,
    saleNumber: input.saleNumber,
    organizationId: input.organizationId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    cashierUserId: input.cashierUserId,
    ...(customerId ? { customerId } : {}),
    currencyCode: input.currencyCode,
    subtotalMinor: input.subtotalMinor,
    discountMinor: input.discountMinor,
    taxMinor: input.taxMinor,
    totalMinor: input.totalMinor,
    items: input.items.map((item) => {
      const productVariantId = item.productVariantId;

      return {
        saleItemId: item.saleItemId,
        productId: item.productId,
        ...(productVariantId ? { productVariantId } : {}),
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        discountMinor: item.discountMinor,
        taxMinor: item.taxMinor,
        lineTotalMinor: item.lineTotalMinor
      };
    }),
    payments: input.payments.map((payment) => {
      const providerCode = payment.providerCode;
      const externalReference = payment.externalReference;

      return {
        paymentId: payment.paymentId,
        method: payment.method,
        amountMinor: payment.amountMinor,
        ...(providerCode ? { providerCode } : {}),
        ...(externalReference ? { externalReference } : {})
      };
    })
  };
}

function buildInventoryEvent(input: CreateLocalSaleInput): InventoryEvent {
  return {
    id: input.eventId,
    type: "SALE_CREATED",
    organizationId: input.organizationId,
    branchId: input.branchId,
    aggregateId: input.saleId,
    aggregateType: SALE_AGGREGATE_TYPE,
    actorUserId: input.cashierUserId,
    deviceId: input.deviceId,
    localTimestamp: input.happenedAt,
    schemaVersion: 1,
    payload: buildSaleCreatedPayload(input) as unknown as Record<string, unknown>
  };
}

async function insertSale(tx: DbTransaction, input: CreateLocalSaleInput): Promise<void> {
  await tx.execute(
    `
      INSERT INTO sales (
        id, branch_id, shift_id, cashier_user_id, customer_id, sale_number, status,
        currency_code, subtotal_minor, discount_minor, tax_minor, total_minor, notes,
        happened_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.saleId,
      input.branchId,
      input.shiftId,
      input.cashierUserId,
      input.customerId ?? null,
      input.saleNumber,
      SALE_STATUS_COMPLETED,
      input.currencyCode,
      input.subtotalMinor,
      input.discountMinor,
      input.taxMinor,
      input.totalMinor,
      input.notes ?? null,
      input.happenedAt,
      input.happenedAt,
      input.happenedAt
    ]
  );
}

async function insertSaleItems(tx: DbTransaction, input: CreateLocalSaleInput): Promise<void> {
  for (const item of input.items) {
    await tx.execute(
      `
        INSERT INTO sale_items (
          id, sale_id, product_id, product_variant_id, quantity, unit_price_minor,
          discount_minor, tax_minor, line_total_minor, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        item.saleItemId,
        input.saleId,
        item.productId,
        item.productVariantId ?? null,
        item.quantity,
        item.unitPriceMinor,
        item.discountMinor,
        item.taxMinor,
        item.lineTotalMinor,
        input.happenedAt
      ]
    );
  }
}

async function insertPayments(tx: DbTransaction, input: CreateLocalSaleInput): Promise<void> {
  for (const payment of input.payments) {
    await tx.execute(
      `
        INSERT INTO payments (
          id, sale_id, payment_method, provider_code, external_reference, amount_minor,
          status, paid_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payment.paymentId,
        input.saleId,
        payment.method,
        payment.providerCode ?? null,
        payment.externalReference ?? null,
        payment.amountMinor,
        payment.status || PAYMENT_STATUS_COMPLETED,
        payment.paidAt,
        input.happenedAt
      ]
    );
  }
}

async function insertReceipt(tx: DbTransaction, input: CreateLocalSaleInput): Promise<void> {
  await tx.execute(
    `
      INSERT INTO receipts (
        id, sale_id, receipt_number, print_status, created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      `receipt-${input.saleId}`,
      input.saleId,
      input.saleNumber,
      RECEIPT_STATUS_PENDING,
      input.happenedAt
    ]
  );
}

async function insertInventoryEvent(tx: DbTransaction, event: InventoryEvent): Promise<void> {
  const payload = event.payload as unknown as SaleCreatedPayload;

  await tx.execute(
    `
      INSERT INTO inventory_events (
        id, organization_id, branch_id, warehouse_id, aggregate_type, aggregate_id,
        event_type, actor_user_id, device_id, quantity_delta, payload_json,
        local_created_at, event_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      event.id,
      event.organizationId,
      event.branchId ?? null,
      event.warehouseId ?? null,
      event.aggregateType,
      event.aggregateId,
      event.type,
      event.actorUserId,
      event.deviceId,
      payload.items.reduce((sum, item) => sum - item.quantity, 0),
      JSON.stringify(event.payload),
      event.localTimestamp,
      event.schemaVersion
    ]
  );
}

async function insertInventoryLevelMutations(tx: DbTransaction, input: CreateLocalSaleInput): Promise<void> {
  const eventId = input.eventId;

  for (const item of input.items) {
    await tx.execute(
      `
        INSERT INTO inventory_levels (
          id, branch_id, product_id, product_variant_id, sellable_quantity,
          reserved_quantity, damaged_quantity, last_event_id, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          sellable_quantity = inventory_levels.sellable_quantity + excluded.sellable_quantity,
          last_event_id = excluded.last_event_id,
          updated_at = excluded.updated_at
      `,
      [
        `${input.branchId}:${item.productId}:${item.productVariantId ?? "base"}`,
        input.branchId,
        item.productId,
        item.productVariantId ?? null,
        -item.quantity,
        eventId,
        input.happenedAt
      ]
    );
  }
}

async function insertSyncQueueRecord(tx: DbTransaction, event: InventoryEvent): Promise<void> {
  await tx.execute(
    `
      INSERT INTO sync_queue (
        id, event_id, event_type, aggregate_type, aggregate_id, payload_json,
        status, retry_count, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `queue-${event.id}`,
      event.id,
      event.type,
      event.aggregateType,
      event.aggregateId,
      JSON.stringify(event.payload),
      SYNC_STATUS_PENDING,
      0,
      event.localTimestamp,
      event.localTimestamp
    ]
  );
}

async function assertSufficientInventory(
  tx: DbTransaction,
  input: CreateLocalSaleInput
): Promise<void> {
  const requestedByStockKey = new Map<string, number>();

  for (const item of input.items) {
    const stockKey = `${input.branchId}:${item.productId}:${item.productVariantId ?? "base"}`;
    requestedByStockKey.set(stockKey, (requestedByStockKey.get(stockKey) ?? 0) + item.quantity);
  }

  for (const [stockKey, requestedQuantity] of requestedByStockKey.entries()) {
    const [branchId, productId, variantId] = stockKey.split(":");
    const rows = await tx.query<InventoryLevelRow>(
      `
        SELECT sellable_quantity
        FROM inventory_levels
        WHERE id = ?
        LIMIT 1
      `,
      [stockKey]
    );

    const availableQuantity = rows[0]?.sellable_quantity ?? 0;
    if (availableQuantity < requestedQuantity) {
      throw new Error(
        `Insufficient inventory for product ${productId}${variantId === "base" ? "" : ` variant ${variantId}`} at branch ${branchId}. Requested ${requestedQuantity}, available ${availableQuantity}.`
      );
    }
  }
}

export async function createLocalSale(
  db: TransactionRunner,
  input: CreateLocalSaleInput
): Promise<{ saleId: string; eventId: string }> {
  assertValidSaleInput(input);

  const event = buildInventoryEvent(input);

  await db.runInTransaction(async (tx) => {
    await assertSufficientInventory(tx, input);
    await insertSale(tx, input);
    await insertSaleItems(tx, input);
    await insertPayments(tx, input);
    await insertReceipt(tx, input);
    await insertInventoryEvent(tx, event);
    await insertInventoryLevelMutations(tx, input);
    await insertSyncQueueRecord(tx, event);
  });

  return {
    saleId: input.saleId,
    eventId: event.id
  };
}
