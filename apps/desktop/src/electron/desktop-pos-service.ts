import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDemoIds } from "../demo-ids.ts";
import { seedDesktopReferenceData } from "../demo-environment.ts";
import { SqliteTransactionRunner, resolveProjectPath } from "../db.ts";
import { createLocalSale } from "../sales/index.ts";
import { MockSyncTransport, SyncQueueProcessor } from "../sync/index.ts";
import { listSellableCatalog, type PosCatalogItem } from "../pos/catalog.ts";
import { addCartLine, createCartState, summarizeCart, type PosCartState, type PosCartSummary } from "../pos/cart.ts";
import {
  buildCreateLocalSaleInput,
  createCheckoutPayments,
  type PosPaymentInput
} from "../pos/checkout.ts";
import { readSyncPanelState, type PosSyncPanelState } from "../pos/sync-panel.ts";

export interface PosInventorySummaryItem {
  productId: string;
  productVariantId?: string;
  sellableQuantity: number;
}

export interface SuspendedSaleSummary {
  id: string;
  label: string;
  totalMinor: number;
  itemCount: number;
  updatedAt: string;
}

export interface PosRecentSaleSummary {
  saleId: string;
  saleNumber: string;
  totalMinor: number;
  happenedAt: string;
  syncStatus: "pending" | "processing" | "synced" | "failed" | "dead_letter" | "unknown";
  eventId?: string;
  retryCount: number;
  itemCount: number;
  items: Array<{
    name: string;
    quantity: number;
    lineTotalMinor: number;
  }>;
  payments: Array<{
    method: string;
    amountMinor: number;
  }>;
}

export interface PosRecoveryQueueItem {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  status: "pending" | "processing" | "synced" | "failed" | "dead_letter";
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
}

export interface PosShiftSummary {
  salesCount: number;
  grossTotalMinor: number;
  syncedSalesCount: number;
  attentionSalesCount: number;
  deadLetterSalesCount: number;
  suspendedDraftCount: number;
  openCartLineCount: number;
  readyToClose: boolean;
  blockers: string[];
}

export interface PosOperatorStatus {
  kind: "success" | "info" | "error";
  message: string;
}

export interface PosScreenSnapshot {
  catalog: PosCatalogItem[];
  cart: {
    lines: PosCartState["lines"];
    summary: PosCartSummary;
  };
  payments: PosPaymentInput[];
  suspendedSales: SuspendedSaleSummary[];
  sync: PosSyncPanelState;
  reporting: {
    shift: PosShiftSummary;
  };
  recovery: {
    queue: PosRecoveryQueueItem[];
    recentSales: PosRecentSaleSummary[];
  };
  inventory: PosInventorySummaryItem[];
  lastSubmitResult?: {
    saleId: string;
    eventId: string;
    saleNumber: string;
  };
  status?: PosOperatorStatus;
  errorMessage?: string;
}

interface SuspendedSaleRow {
  id: string;
  label: string;
  totals_json: string;
  updated_at: string;
}

interface SuspendedSalePayloadRow {
  id: string;
  label: string;
  cart_json: string;
  payments_json: string;
}

interface RecentSaleRow {
  sale_id: string;
  sale_number: string;
  total_minor: number;
  happened_at: string;
  event_id: string | null;
  sync_status: PosRecentSaleSummary["syncStatus"] | null;
  retry_count: number | null;
}

interface RecentSaleItemRow {
  sale_id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  line_total_minor: number;
}

interface RecentSalePaymentRow {
  sale_id: string;
  payment_method: string;
  amount_minor: number;
}

interface RecoveryQueueRow {
  id: string;
  event_id: string;
  event_type: string;
  aggregate_id: string;
  status: PosRecoveryQueueItem["status"];
  retry_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
}

interface ShiftSummaryRow {
  sales_count: number;
  gross_total_minor: number | null;
  synced_sales_count: number;
  attention_sales_count: number;
  dead_letter_sales_count: number;
}

function readInventorySummary(db: SqliteTransactionRunner): PosInventorySummaryItem[] {
  return db.query<{
    product_id: string;
    product_variant_id: string | null;
    sellable_quantity: number;
  }>(
    `
      SELECT product_id, product_variant_id, sellable_quantity
      FROM inventory_levels
      ORDER BY product_id, product_variant_id
    `
  ).map((row) => ({
    productId: row.product_id,
    ...(row.product_variant_id ? { productVariantId: row.product_variant_id } : {}),
    sellableQuantity: row.sellable_quantity
  }));
}

function readSuspendedSales(db: SqliteTransactionRunner): SuspendedSaleSummary[] {
  return db
    .query<SuspendedSaleRow>(
      `
        SELECT id, label, totals_json, updated_at
        FROM suspended_sales
        ORDER BY updated_at DESC
      `
    )
    .map((row) => {
      const totals = JSON.parse(row.totals_json) as PosCartSummary;
      return {
        id: row.id,
        label: row.label,
        totalMinor: totals.totalMinor,
        itemCount: totals.totalItemCount,
        updatedAt: row.updated_at
      };
    });
}

function readRecentSales(db: SqliteTransactionRunner): PosRecentSaleSummary[] {
  const saleRows = db.query<RecentSaleRow>(
    `
      SELECT
        sales.id AS sale_id,
        sales.sale_number,
        sales.total_minor,
        sales.happened_at,
        inventory_events.id AS event_id,
        sync_queue.status AS sync_status,
        sync_queue.retry_count
      FROM sales
      LEFT JOIN inventory_events
        ON inventory_events.aggregate_type = 'sale'
        AND inventory_events.aggregate_id = sales.id
        AND inventory_events.event_type = 'SALE_CREATED'
      LEFT JOIN sync_queue
        ON sync_queue.event_id = inventory_events.id
      ORDER BY sales.happened_at DESC
      LIMIT 10
    `
  );

  if (saleRows.length === 0) {
    return [];
  }

  const itemRows = db.query<RecentSaleItemRow>(
    `
      SELECT
        sale_items.sale_id,
        products.name AS product_name,
        product_variants.variant_name,
        sale_items.quantity,
        sale_items.line_total_minor
      FROM sale_items
      INNER JOIN products ON products.id = sale_items.product_id
      LEFT JOIN product_variants ON product_variants.id = sale_items.product_variant_id
      WHERE sale_items.sale_id IN (${saleRows.map(() => "?").join(", ")})
      ORDER BY sale_items.created_at, sale_items.id
    `,
    saleRows.map((row) => row.sale_id)
  );

  const paymentRows = db.query<RecentSalePaymentRow>(
    `
      SELECT
        sale_id,
        payment_method,
        amount_minor
      FROM payments
      WHERE sale_id IN (${saleRows.map(() => "?").join(", ")})
      ORDER BY created_at, id
    `,
    saleRows.map((row) => row.sale_id)
  );

  const itemsBySale = new Map<string, PosRecentSaleSummary["items"]>();
  for (const row of itemRows) {
    const itemName = row.variant_name ? `${row.product_name} / ${row.variant_name}` : row.product_name;
    const list = itemsBySale.get(row.sale_id) ?? [];
    list.push({
      name: itemName,
      quantity: Number(row.quantity),
      lineTotalMinor: row.line_total_minor
    });
    itemsBySale.set(row.sale_id, list);
  }

  const paymentsBySale = new Map<string, PosRecentSaleSummary["payments"]>();
  for (const row of paymentRows) {
    const list = paymentsBySale.get(row.sale_id) ?? [];
    list.push({
      method: row.payment_method,
      amountMinor: row.amount_minor
    });
    paymentsBySale.set(row.sale_id, list);
  }

  return saleRows.map((row) => {
      const items = itemsBySale.get(row.sale_id) ?? [];
      const payments = paymentsBySale.get(row.sale_id) ?? [];
      return {
      saleId: row.sale_id,
      saleNumber: row.sale_number,
      totalMinor: row.total_minor,
      happenedAt: row.happened_at,
      syncStatus: row.sync_status ?? "unknown",
      ...(row.event_id ? { eventId: row.event_id } : {}),
      retryCount: Number(row.retry_count ?? 0),
      itemCount: items.length,
      items,
      payments
    };
  });
}

function readRecoveryQueue(db: SqliteTransactionRunner): PosRecoveryQueueItem[] {
  return db
    .query<RecoveryQueueRow>(
      `
        SELECT
          id,
          event_id,
          event_type,
          aggregate_id,
          status,
          retry_count,
          next_retry_at,
          last_error,
          created_at,
          updated_at,
          acknowledged_at
        FROM sync_queue
        ORDER BY
          CASE status
            WHEN 'failed' THEN 0
            WHEN 'dead_letter' THEN 1
            WHEN 'pending' THEN 2
            WHEN 'processing' THEN 3
            ELSE 4
          END,
          updated_at DESC
        LIMIT 20
      `
    )
    .map((row) => ({
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      status: row.status,
      retryCount: Number(row.retry_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.next_retry_at ? { nextRetryAt: row.next_retry_at } : {}),
      ...(row.last_error ? { lastError: row.last_error } : {}),
      ...(row.acknowledged_at ? { acknowledgedAt: row.acknowledged_at } : {})
    }));
}

function readShiftSummary(
  db: SqliteTransactionRunner,
  shiftId: string,
  suspendedDraftCount: number,
  openCartLineCount: number
): PosShiftSummary {
  const row = db.query<ShiftSummaryRow>(
    `
      SELECT
        COUNT(*) AS sales_count,
        COALESCE(SUM(sales.total_minor), 0) AS gross_total_minor,
        COALESCE(SUM(CASE WHEN sync_queue.status = 'synced' THEN 1 ELSE 0 END), 0) AS synced_sales_count,
        COALESCE(SUM(CASE WHEN sync_queue.status IN ('pending', 'processing', 'failed', 'dead_letter') THEN 1 ELSE 0 END), 0) AS attention_sales_count,
        COALESCE(SUM(CASE WHEN sync_queue.status = 'dead_letter' THEN 1 ELSE 0 END), 0) AS dead_letter_sales_count
      FROM sales
      LEFT JOIN inventory_events
        ON inventory_events.aggregate_type = 'sale'
        AND inventory_events.aggregate_id = sales.id
        AND inventory_events.event_type = 'SALE_CREATED'
      LEFT JOIN sync_queue
        ON sync_queue.event_id = inventory_events.id
      WHERE sales.shift_id = ?
    `,
    [shiftId]
  )[0];

  const deadLetterSalesCount = Number(row?.dead_letter_sales_count ?? 0);
  const attentionSalesCount = Number(row?.attention_sales_count ?? 0);
  const blockers: string[] = [];

  if (deadLetterSalesCount > 0) {
    blockers.push(`${deadLetterSalesCount} dead-letter sale(s)`);
  }
  if (attentionSalesCount > 0) {
    blockers.push(`${attentionSalesCount} unsynced or failed sale(s)`);
  }
  if (suspendedDraftCount > 0) {
    blockers.push(`${suspendedDraftCount} suspended draft(s)`);
  }
  if (openCartLineCount > 0) {
    blockers.push(`${openCartLineCount} open cart line(s)`);
  }

  return {
    salesCount: Number(row?.sales_count ?? 0),
    grossTotalMinor: Number(row?.gross_total_minor ?? 0),
    syncedSalesCount: Number(row?.synced_sales_count ?? 0),
    attentionSalesCount,
    deadLetterSalesCount,
    suspendedDraftCount,
    openCartLineCount,
    readyToClose: blockers.length === 0,
    blockers
  };
}

function priceForCatalogItem(item: PosCatalogItem): {
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
} {
  if (item.productVariantId) {
    return {
      unitPriceMinor: 6250,
      discountMinor: 1250,
      taxMinor: 0
    };
  }

  return {
    unitPriceMinor: 50000,
    discountMinor: 0,
    taxMinor: 0
  };
}

export class DesktopPosService {
  private static readonly repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  private db: SqliteTransactionRunner;
  private readonly ids = createDemoIds();
  private readonly queueProcessor: SyncQueueProcessor;
  private cart = createCartState();
  private payments: PosPaymentInput[] = [];
  private lastSubmitResult:
    | {
        saleId: string;
        eventId: string;
        saleNumber: string;
      }
    | undefined;
  private status: PosOperatorStatus | undefined;
  private errorMessage: string | undefined;
  private readonly databaseFile: string;

  private constructor(db: SqliteTransactionRunner, databaseFile: string) {
    this.db = db;
    this.databaseFile = databaseFile;
    this.queueProcessor = new SyncQueueProcessor(this.db, new MockSyncTransport());
  }

  static async createForTest(): Promise<DesktopPosService> {
    const databaseFile = resolve(this.repoRoot, "data", "desktop", `test-ui-${randomUUID()}.sqlite`);
    if (existsSync(databaseFile)) {
      rmSync(databaseFile);
    }

    const service = new DesktopPosService(new SqliteTransactionRunner(databaseFile), databaseFile);
    service.initializeDatabase();
    return service;
  }

  static async createForApp(): Promise<DesktopPosService> {
    const databaseFile = resolve(this.repoRoot, "data", "desktop", `ui-shell-${process.pid}.sqlite`);
    if (existsSync(databaseFile)) {
      rmSync(databaseFile, { force: true });
    }

    const service = new DesktopPosService(new SqliteTransactionRunner(databaseFile), databaseFile);
    service.initializeDatabase();
    return service;
  }

  private initializeDatabase(): void {
    const schemaFile = resolve(DesktopPosService.repoRoot, "infrastructure", "sql", "sqlite", "001_initial_branch_schema.sql");
    const now = new Date().toISOString();
    this.db.applySchemaFile(schemaFile);
    seedDesktopReferenceData(this.db, this.ids, now);
    this.cart = createCartState();
    this.payments = [];
    this.lastSubmitResult = undefined;
    this.status = undefined;
    this.errorMessage = undefined;
  }

  async loadSnapshot(): Promise<PosScreenSnapshot> {
    return this.buildSnapshot();
  }

  async addCatalogItem(input: { productId: string; productVariantId?: string }): Promise<PosScreenSnapshot> {
    const catalog = listSellableCatalog(this.db);
    const item = catalog.find(
      (entry) =>
        entry.productId === input.productId &&
        (entry.productVariantId ?? null) === (input.productVariantId ?? null)
    );

    if (!item) {
      this.errorMessage = "Selected catalog item was not found.";
      this.status = {
        kind: "error",
        message: "Selected catalog item was not found."
      };
      return this.buildSnapshot();
    }

    const pricing = priceForCatalogItem(item);
    this.cart = addCartLine(this.cart, {
      productId: item.productId,
      ...(item.productVariantId ? { productVariantId: item.productVariantId } : {}),
      name: item.name,
      quantity: 1,
      unitPriceMinor: pricing.unitPriceMinor,
      discountMinor: pricing.discountMinor,
      taxMinor: pricing.taxMinor
    });

    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: `Added ${item.name} to cart.`
    };
    return this.buildSnapshot();
  }

  async updateCartQuantity(input: { stockKey: string; quantity: number }): Promise<PosScreenSnapshot> {
    this.cart = {
      lines: this.cart.lines
        .map((line) =>
          line.stockKey !== input.stockKey
            ? line
            : {
                ...line,
                quantity: input.quantity,
                lineTotalMinor: line.unitPriceMinor * input.quantity - line.discountMinor + line.taxMinor
              }
        )
        .filter((line) => line.quantity > 0)
    };

    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: input.quantity > 0 ? "Cart updated." : "Item removed from cart."
    };
    return this.buildSnapshot();
  }

  async clearCart(): Promise<PosScreenSnapshot> {
    this.cart = createCartState();
    this.payments = [];
    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: "Cart cleared."
    };
    return this.buildSnapshot();
  }

  async setPayments(payments: PosPaymentInput[]): Promise<PosScreenSnapshot> {
    this.payments = createCheckoutPayments(payments);
    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: "Payments updated."
    };
    return this.buildSnapshot();
  }

  async suspendCurrentSale(label?: string): Promise<PosScreenSnapshot> {
    if (this.cart.lines.length === 0) {
      this.errorMessage = "Cannot suspend an empty cart.";
      this.status = {
        kind: "error",
        message: this.errorMessage
      };
      return this.buildSnapshot();
    }

    const now = new Date().toISOString();
    const summary = summarizeCart(this.cart);
    const normalizedLabel =
      label?.trim() ||
      `Suspended Sale ${new Date(now).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      })}`;

    this.db.execute(
      `
        INSERT INTO suspended_sales (
          id, branch_id, device_id, cashier_user_id, label,
          cart_json, payments_json, totals_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        this.ids.branch,
        this.ids.device,
        this.ids.user,
        normalizedLabel,
        JSON.stringify(this.cart),
        JSON.stringify(this.payments),
        JSON.stringify(summary),
        now,
        now
      ]
    );

    this.cart = createCartState();
    this.payments = [];
    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: `Sale suspended: ${normalizedLabel}.`
    };
    return this.buildSnapshot();
  }

  async resumeSuspendedSale(id: string): Promise<PosScreenSnapshot> {
    const rows = this.db.query<SuspendedSalePayloadRow>(
      `
        SELECT id, label, cart_json, payments_json
        FROM suspended_sales
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      this.errorMessage = "Suspended sale was not found.";
      this.status = {
        kind: "error",
        message: this.errorMessage
      };
      return this.buildSnapshot();
    }

    this.cart = JSON.parse(row.cart_json) as PosCartState;
    this.payments = JSON.parse(row.payments_json) as PosPaymentInput[];
    this.db.execute(`DELETE FROM suspended_sales WHERE id = ?`, [id]);
    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: `Suspended sale resumed: ${row.label}.`
    };
    return this.buildSnapshot();
  }

  async deleteSuspendedSale(id: string): Promise<PosScreenSnapshot> {
    this.db.execute(`DELETE FROM suspended_sales WHERE id = ?`, [id]);
    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: "Suspended sale deleted."
    };
    return this.buildSnapshot();
  }

  async submitSale(): Promise<PosScreenSnapshot> {
    try {
      if (this.payments.length === 0) {
        const summary = summarizeCart(this.cart);
        this.payments = createCheckoutPayments([
          {
            paymentId: randomUUID(),
            method: "cash",
            amountMinor: Math.floor(summary.totalMinor / 2),
            status: "completed",
            paidAt: new Date().toISOString()
          },
          {
            paymentId: randomUUID(),
            method: "mobile_money",
            amountMinor: summary.totalMinor - Math.floor(summary.totalMinor / 2),
            providerCode: "mtn_momo",
            externalReference: `MM-${Date.now()}`,
            status: "completed",
            paidAt: new Date().toISOString()
          }
        ]);
      }

      const saleInput = buildCreateLocalSaleInput(
        this.cart,
        this.payments as Array<PosPaymentInput & { paymentId: string }>,
        {
          eventId: randomUUID(),
          saleId: randomUUID(),
          saleNumber: `POS-${Date.now()}`,
          organizationId: this.ids.organization,
          branchId: this.ids.branch,
          shiftId: this.ids.shift,
          cashierUserId: this.ids.user,
          deviceId: this.ids.device,
          customerId: this.ids.customer,
          happenedAt: new Date().toISOString(),
          notes: "Electron POS shell demo"
        },
        this.cart.lines.map(() => randomUUID())
      );

      this.lastSubmitResult = {
        ...(await createLocalSale(this.db, saleInput)),
        saleNumber: saleInput.saleNumber
      };
      this.errorMessage = undefined;
      this.status = {
        kind: "success",
        message: `Sale submitted: ${saleInput.saleNumber}.`
      };
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = {
        kind: "error",
        message: this.errorMessage
      };
    }

    return this.buildSnapshot();
  }

  async processSyncQueue(): Promise<PosScreenSnapshot> {
    try {
      await this.queueProcessor.processPending();
      this.errorMessage = undefined;
      this.status = {
        kind: "success",
        message: "Sync processed successfully."
      };
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = {
        kind: "error",
        message: this.errorMessage
      };
    }

    return this.buildSnapshot();
  }

  async retryQueueItem(id: string): Promise<PosScreenSnapshot> {
    const updated = this.db.query<{ changes: number }>(
      `
        UPDATE sync_queue
        SET status = 'pending', retry_count = 0, last_error = NULL, next_retry_at = NULL, locked_at = NULL, updated_at = ?
        WHERE id = ? AND status IN ('failed', 'dead_letter')
        RETURNING 1 AS changes
      `,
      [new Date().toISOString(), id]
    )[0];

    if (!updated) {
      this.errorMessage = "Only failed or dead-letter queue items can be retried.";
      this.status = {
        kind: "error",
        message: this.errorMessage
      };
      return this.buildSnapshot();
    }

    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: "Queue item moved back to pending."
    };
    return this.buildSnapshot();
  }

  async retryAllQueueItems(): Promise<PosScreenSnapshot> {
    const recoverable = this.db.query<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM sync_queue
        WHERE status IN ('failed', 'dead_letter')
      `
    )[0];

    if (!recoverable || Number(recoverable.count) === 0) {
      this.errorMessage = undefined;
      this.status = {
        kind: "info",
        message: "No failed queue items to retry."
      };
      return this.buildSnapshot();
    }

    this.db.execute(
      `
        UPDATE sync_queue
        SET status = 'pending', retry_count = 0, last_error = NULL, next_retry_at = NULL, locked_at = NULL, updated_at = ?
        WHERE status IN ('failed', 'dead_letter')
      `,
      [new Date().toISOString()]
    );

    this.errorMessage = undefined;
    this.status = {
      kind: "info",
      message: `Retried ${recoverable.count} queue item(s).`
    };
    return this.buildSnapshot();
  }

  async resetDemoState(): Promise<PosScreenSnapshot> {
    this.db.close();
    if (existsSync(this.databaseFile)) {
      rmSync(this.databaseFile, { force: true });
    }
    this.db = new SqliteTransactionRunner(this.databaseFile);
    this.initializeDatabase();
    this.status = {
      kind: "info",
      message: "Demo state reset."
    };
    return this.buildSnapshot();
  }

  async dispose(): Promise<void> {
    this.db.close();
  }

  private buildSnapshot(): PosScreenSnapshot {
    const suspendedSales = readSuspendedSales(this.db);
    return {
      catalog: listSellableCatalog(this.db),
      cart: {
        lines: this.cart.lines,
        summary: summarizeCart(this.cart)
      },
      payments: this.payments,
      suspendedSales,
      sync: readSyncPanelState(this.db),
      reporting: {
        shift: readShiftSummary(this.db, this.ids.shift, suspendedSales.length, this.cart.lines.length)
      },
      recovery: {
        queue: readRecoveryQueue(this.db),
        recentSales: readRecentSales(this.db)
      },
      inventory: readInventorySummary(this.db),
      ...(this.lastSubmitResult ? { lastSubmitResult: this.lastSubmitResult } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.errorMessage ? { errorMessage: this.errorMessage } : {})
    };
  }
}
