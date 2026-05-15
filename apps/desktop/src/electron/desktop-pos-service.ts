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
    return {
      catalog: listSellableCatalog(this.db),
      cart: {
        lines: this.cart.lines,
        summary: summarizeCart(this.cart)
      },
      payments: this.payments,
      suspendedSales: readSuspendedSales(this.db),
      sync: readSyncPanelState(this.db),
      inventory: readInventorySummary(this.db),
      ...(this.lastSubmitResult ? { lastSubmitResult: this.lastSubmitResult } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.errorMessage ? { errorMessage: this.errorMessage } : {})
    };
  }
}
