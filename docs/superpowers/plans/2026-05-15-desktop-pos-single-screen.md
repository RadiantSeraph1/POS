# Desktop POS Single-Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-screen cashier-oriented desktop POS model that loads the local catalog, builds a cart, validates checkout, submits a real local sale, and shows sync state before and after processing.

**Architecture:** Reuse the existing SQLite seed data, `createLocalSale()` transaction boundary, and `SyncQueueProcessor` as the source of truth. Add focused POS modules for catalog lookup, cart totals, checkout validation, queue-state projection, and terminal rendering, then wire them into a scripted cashier flow.

**Tech Stack:** Node.js TypeScript executed directly, local SQLite via `node:sqlite`, existing sale transaction service, existing sync queue processor, Node test runner

---

### Task 1: Add cart tests first

**Files:**
- Create: `apps/desktop/src/pos/cart.test.ts`
- Create: `apps/desktop/src/pos/cart.ts`

- [ ] **Step 1: Write the failing cart tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { addCartLine, createCartState, summarizeCart } from "./cart.ts";

const baseLine = {
  productId: "product-1",
  name: "PVC Pipe",
  quantity: 1,
  unitPriceMinor: 50000,
  discountMinor: 0,
  taxMinor: 0
};

test("summarizeCart derives subtotal discount and total", () => {
  const cart = addCartLine(
    addCartLine(createCartState(), baseLine),
    {
      productId: "product-2",
      productVariantId: "variant-1",
      name: "Elbow Joint 1 Inch",
      quantity: 2,
      unitPriceMinor: 6250,
      discountMinor: 500,
      taxMinor: 0
    }
  );

  const summary = summarizeCart(cart);

  assert.equal(summary.subtotalMinor, 62500);
  assert.equal(summary.discountMinor, 500);
  assert.equal(summary.totalMinor, 62000);
  assert.equal(summary.totalItemCount, 3);
});

test("addCartLine aggregates repeated additions for the same stock line", () => {
  const cart = addCartLine(
    addCartLine(createCartState(), baseLine),
    {
      ...baseLine,
      quantity: 2
    }
  );

  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0]?.quantity, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-isolation=none "apps/desktop/src/pos/cart.test.ts"`
Expected: FAIL with module or export not found for cart helpers

- [ ] **Step 3: Write minimal cart implementation**

```ts
export interface PosCartLineInput {
  productId: string;
  productVariantId?: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
}

export interface PosCartLine extends PosCartLineInput {
  lineTotalMinor: number;
  stockKey: string;
}

export interface PosCartState {
  lines: PosCartLine[];
}

export interface PosCartSummary {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  totalItemCount: number;
}

export function createCartState(): PosCartState {
  return { lines: [] };
}

function buildStockKey(input: PosCartLineInput): string {
  return `${input.productId}:${input.productVariantId ?? "base"}`;
}

export function addCartLine(cart: PosCartState, input: PosCartLineInput): PosCartState {
  const stockKey = buildStockKey(input);
  const existing = cart.lines.find((line) => line.stockKey === stockKey);

  if (!existing) {
    return {
      lines: [
        ...cart.lines,
        {
          ...input,
          stockKey,
          lineTotalMinor: input.unitPriceMinor * input.quantity - input.discountMinor + input.taxMinor
        }
      ]
    };
  }

  return {
    lines: cart.lines.map((line) =>
      line.stockKey !== stockKey
        ? line
        : {
            ...line,
            quantity: line.quantity + input.quantity,
            discountMinor: line.discountMinor + input.discountMinor,
            taxMinor: line.taxMinor + input.taxMinor,
            lineTotalMinor:
              line.unitPriceMinor * (line.quantity + input.quantity) -
              (line.discountMinor + input.discountMinor) +
              (line.taxMinor + input.taxMinor)
          }
    )
  };
}

export function summarizeCart(cart: PosCartState): PosCartSummary {
  const subtotalMinor = cart.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const discountMinor = cart.lines.reduce((sum, line) => sum + line.discountMinor, 0);
  const taxMinor = cart.lines.reduce((sum, line) => sum + line.taxMinor, 0);

  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: subtotalMinor - discountMinor + taxMinor,
    totalItemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-isolation=none "apps/desktop/src/pos/cart.test.ts"`
Expected: PASS

### Task 2: Add checkout tests first

**Files:**
- Create: `apps/desktop/src/pos/checkout.test.ts`
- Create: `apps/desktop/src/pos/checkout.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write the failing checkout tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { addCartLine, createCartState } from "./cart.ts";
import { assertValidCheckout, createCheckoutPayments } from "./checkout.ts";

test("assertValidCheckout rejects empty carts", () => {
  assert.throws(
    () =>
      assertValidCheckout(createCartState(), [
        { method: "cash", amountMinor: 1000, status: "completed", paidAt: "2026-05-15T12:00:00.000Z" }
      ]),
    /cart/i
  );
});

test("assertValidCheckout rejects payment mismatch", () => {
  const cart = addCartLine(createCartState(), {
    productId: "product-1",
    name: "PVC Pipe",
    quantity: 1,
    unitPriceMinor: 50000,
    discountMinor: 0,
    taxMinor: 0
  });

  assert.throws(
    () =>
      assertValidCheckout(cart, [
        { method: "cash", amountMinor: 1000, status: "completed", paidAt: "2026-05-15T12:00:00.000Z" }
      ]),
    /payment total/i
  );
});

test("createCheckoutPayments preserves split payments", () => {
  const payments = createCheckoutPayments([
    { paymentId: "payment-1", method: "cash", amountMinor: 80000, status: "completed", paidAt: "2026-05-15T12:00:00.000Z" },
    { paymentId: "payment-2", method: "mobile_money", amountMinor: 40000, providerCode: "mtn_momo", externalReference: "MM-REF-1", status: "completed", paidAt: "2026-05-15T12:00:01.000Z" }
  ]);

  assert.equal(payments.length, 2);
  assert.equal(payments[1]?.providerCode, "mtn_momo");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-isolation=none "apps/desktop/src/pos/checkout.test.ts"`
Expected: FAIL with module or export not found for checkout helpers

- [ ] **Step 3: Write minimal checkout implementation**

```ts
import type { CreateLocalSaleInput } from "../../../../packages/types/src/index.ts";

import type { PosCartState } from "./cart.ts";
import { summarizeCart } from "./cart.ts";

export interface PosPaymentInput {
  paymentId?: string;
  method: string;
  amountMinor: number;
  providerCode?: string;
  externalReference?: string;
  status: string;
  paidAt: string;
}

export function createCheckoutPayments(payments: PosPaymentInput[]): PosPaymentInput[] {
  return payments;
}

export function assertValidCheckout(cart: PosCartState, payments: PosPaymentInput[]): void {
  if (cart.lines.length === 0) {
    throw new Error("Cart must include at least one line.");
  }

  if (payments.length === 0) {
    throw new Error("Checkout must include at least one payment.");
  }

  const summary = summarizeCart(cart);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  if (totalPaid !== summary.totalMinor) {
    throw new Error("Payment total must match cart total.");
  }
}

export interface BuildSaleInputContext {
  eventId: string;
  saleId: string;
  saleNumber: string;
  organizationId: string;
  branchId: string;
  shiftId: string;
  cashierUserId: string;
  deviceId: string;
  customerId?: string;
  happenedAt: string;
  notes?: string;
}

export function buildCreateLocalSaleInput(
  cart: PosCartState,
  payments: Array<PosPaymentInput & { paymentId: string }>,
  context: BuildSaleInputContext,
  saleItemIds: string[]
): CreateLocalSaleInput {
  assertValidCheckout(cart, payments);
  const summary = summarizeCart(cart);

  return {
    eventId: context.eventId,
    saleId: context.saleId,
    saleNumber: context.saleNumber,
    organizationId: context.organizationId,
    branchId: context.branchId,
    shiftId: context.shiftId,
    cashierUserId: context.cashierUserId,
    deviceId: context.deviceId,
    ...(context.customerId ? { customerId: context.customerId } : {}),
    currencyCode: "GHS",
    subtotalMinor: summary.subtotalMinor,
    discountMinor: summary.discountMinor,
    taxMinor: summary.taxMinor,
    totalMinor: summary.totalMinor,
    happenedAt: context.happenedAt,
    ...(context.notes ? { notes: context.notes } : {}),
    items: cart.lines.map((line, index) => ({
      saleItemId: saleItemIds[index] ?? `sale-item-${index + 1}`,
      productId: line.productId,
      ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: line.discountMinor,
      taxMinor: line.taxMinor,
      lineTotalMinor: line.lineTotalMinor
    })),
    payments: payments.map((payment) => ({
      paymentId: payment.paymentId,
      method: payment.method,
      amountMinor: payment.amountMinor,
      ...(payment.providerCode ? { providerCode: payment.providerCode } : {}),
      ...(payment.externalReference ? { externalReference: payment.externalReference } : {}),
      status: payment.status,
      paidAt: payment.paidAt
    }))
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-isolation=none "apps/desktop/src/pos/checkout.test.ts"`
Expected: PASS

### Task 3: Add catalog and sync-panel projections

**Files:**
- Create: `apps/desktop/src/pos/catalog.ts`
- Create: `apps/desktop/src/pos/sync-panel.ts`
- Modify: `apps/desktop/src/db.ts`

- [ ] **Step 1: Add read-only desktop query helpers**

```ts
export interface ProductCatalogRow {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  variant_code: string | null;
  product_name: string;
  variant_name: string | null;
  sellable_quantity: number;
}

export interface SyncQueueSummaryRow {
  status: string;
  count: number;
}
```

- [ ] **Step 2: Implement catalog and queue summary readers**

```ts
import type { SqliteTransactionRunner } from "../db.ts";

export interface PosCatalogItem {
  productId: string;
  productVariantId?: string;
  sku: string;
  name: string;
  sellableQuantity: number;
}

export function listSellableCatalog(db: SqliteTransactionRunner): PosCatalogItem[] {
  const rows = db.query<ProductCatalogRow>(
    `
      SELECT
        p.id AS product_id,
        pv.id AS product_variant_id,
        p.sku AS sku,
        pv.variant_code AS variant_code,
        p.name AS product_name,
        pv.variant_name AS variant_name,
        COALESCE(il.sellable_quantity, 0) AS sellable_quantity
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
      LEFT JOIN inventory_levels il
        ON il.product_id = p.id
       AND ((pv.id IS NULL AND il.product_variant_id IS NULL) OR il.product_variant_id = pv.id)
      WHERE p.is_active = 1
      ORDER BY p.name, pv.variant_name
    `
  );

  return rows.map((row) => ({
    productId: row.product_id,
    ...(row.product_variant_id ? { productVariantId: row.product_variant_id } : {}),
    sku: row.variant_code ?? row.sku,
    name: row.variant_name ? `${row.product_name} ${row.variant_name}` : row.product_name,
    sellableQuantity: row.sellable_quantity
  }));
}

export interface PosSyncPanelState {
  pending: number;
  processing: number;
  synced: number;
  failed: number;
  deadLetter: number;
  lastError?: string;
}

export function readSyncPanelState(db: SqliteTransactionRunner): PosSyncPanelState {
  const rows = db.query<SyncQueueSummaryRow>(
    `SELECT status, COUNT(*) AS count FROM sync_queue GROUP BY status`
  );
  const lastErrorRow = db.query<{ last_error: string | null }>(
    `SELECT last_error FROM sync_queue WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1`
  )[0];

  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]));
  return {
    pending: Number(counts.pending ?? 0),
    processing: Number(counts.processing ?? 0),
    synced: Number(counts.synced ?? 0),
    failed: Number(counts.failed ?? 0),
    deadLetter: Number(counts.dead_letter ?? 0),
    ...(lastErrorRow?.last_error ? { lastError: lastErrorRow.last_error } : {})
  };
}
```

### Task 4: Render and orchestrate the POS flow

**Files:**
- Create: `apps/desktop/src/pos/renderer.ts`
- Create: `apps/desktop/src/pos/flow.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/README.md`

- [ ] **Step 1: Add renderer**

```ts
import type { PosCatalogItem } from "./catalog.ts";
import type { PosCartState, PosCartSummary } from "./cart.ts";
import type { PosPaymentInput } from "./checkout.ts";
import type { PosSyncPanelState } from "./sync-panel.ts";

export function renderPosScreen(options: {
  catalog: PosCatalogItem[];
  cart: PosCartState;
  summary: PosCartSummary;
  payments: PosPaymentInput[];
  sync: PosSyncPanelState;
  inventoryLines: string[];
  title: string;
}): string {
  const lines = [
    options.title,
    `catalogItems: ${options.catalog.length}`,
    "cart:"
  ];

  for (const line of options.cart.lines) {
    lines.push(
      `- ${line.name} | qty ${line.quantity} | unit ${line.unitPriceMinor} | total ${line.lineTotalMinor}`
    );
  }

  lines.push(
    `totals | subtotal ${options.summary.subtotalMinor} | discount ${options.summary.discountMinor} | tax ${options.summary.taxMinor} | total ${options.summary.totalMinor}`
  );
  lines.push("payments:");
  for (const payment of options.payments) {
    lines.push(`- ${payment.method} ${payment.amountMinor}`);
  }
  lines.push(
    `sync | pending ${options.sync.pending} | processing ${options.sync.processing} | synced ${options.sync.synced} | failed ${options.sync.failed} | dead ${options.sync.deadLetter}`
  );
  if (options.sync.lastError) {
    lines.push(`syncError: ${options.sync.lastError}`);
  }
  lines.push("inventory:");
  lines.push(...options.inventoryLines);
  return lines.join("\\n");
}
```

- [ ] **Step 2: Add scripted POS flow**

```ts
// load catalog, build cart from first base product and first variant product
// create split payments that match total
// render before sale
// submit createLocalSale
// read sync summary
// run queue processor
// read sync summary and inventory again
// render after sync
```

- [ ] **Step 3: Replace raw desktop demo printing with POS flow output**

Run: `node apps/desktop/src/main.ts`
Expected:
- cashier-oriented screen text before sale
- sync panel before processing
- sync panel after processing
- inventory summary after sale

- [ ] **Step 4: Update README**

Document:

```md
- the desktop app now renders a single-screen cashier model
- the flow shows cart, totals, payments, and sync state
- it still uses the same local transaction boundary and queue processor
```

### Task 5: Final verification

**Files:**
- Modify: `docs/NEXT_STEPS.md`

- [ ] **Step 1: Run POS unit tests**

Run: `node --test --test-isolation=none "apps/desktop/src/pos/cart.test.ts" "apps/desktop/src/pos/checkout.test.ts"`
Expected: PASS

- [ ] **Step 2: Run desktop app end-to-end**

Run: `node apps/desktop/src/main.ts`
Expected: PASS with cashier-oriented pre-sale and post-sync screen output

- [ ] **Step 3: Update next-steps documentation**

Add the new current state:

```md
- desktop app now has a single-screen POS model layer
- it derives local catalog and sync summary state from SQLite
- it submits a real local sale and shows queue state before and after sync
```
