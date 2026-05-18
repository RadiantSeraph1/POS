import { addCartLine, createCartState, summarizeCart, type PosCartState } from "../pos/cart.ts";
import { createCheckoutPayments, type PosPaymentInput } from "../pos/checkout.ts";
import type {
  PosInventorySummaryItem,
  PosOperatorStatus,
  PosRecentSaleSummary,
  PosRecoveryQueueItem,
  PosScreenSnapshot,
  PosShiftSummary,
  SuspendedSaleSummary
} from "../electron/desktop-pos-service.ts";
import type { PosCatalogItem } from "../pos/catalog.ts";
import type { PosSyncPanelState } from "../pos/sync-panel.ts";

import type { PipeflowPosBridge } from "./bridge.ts";

const PREVIEW_CATALOG: PosCatalogItem[] = [
  {
    productId: "prod-pipe-110mm",
    sku: "PVC-110",
    name: "PVC Pipe 110mm",
    sellableQuantity: 18
  },
  {
    productId: "prod-elbow-90",
    productVariantId: "variant-elbow-1in",
    sku: "ELB-1IN",
    name: "PVC Elbow 1in",
    sellableQuantity: 42
  },
  {
    productId: "prod-cement",
    sku: "GLU-250",
    name: "PVC Solvent Cement 250ml",
    sellableQuantity: 6
  },
  {
    productId: "prod-tape",
    sku: "TAPE-PTFE",
    name: "PTFE Thread Tape",
    sellableQuantity: 4
  }
];

interface PreviewState {
  catalog: PosCatalogItem[];
  cart: PosCartState;
  payments: PosPaymentInput[];
  suspendedSales: SuspendedSaleSummary[];
  sync: PosSyncPanelState;
  recoveryQueue: PosRecoveryQueueItem[];
  recentSales: PosRecentSaleSummary[];
  inventory: PosInventorySummaryItem[];
  lastSubmitResult: NonNullable<PosScreenSnapshot["lastSubmitResult"]> | undefined;
  status: PosOperatorStatus | undefined;
  errorMessage: string | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: PosScreenSnapshot): PosScreenSnapshot {
  return structuredClone(snapshot);
}

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildInventoryFromCatalog(catalog: PosCatalogItem[]): PosInventorySummaryItem[] {
  return catalog.map((item) => ({
    productId: item.productId,
    ...(item.productVariantId ? { productVariantId: item.productVariantId } : {}),
    sellableQuantity: item.sellableQuantity
  }));
}

function buildShiftSummary(state: PreviewState): PosShiftSummary {
  const deadLetterSalesCount = state.recoveryQueue.filter((item) => item.status === "dead_letter").length;
  const attentionSalesCount = state.recoveryQueue.filter((item) => item.status !== "synced").length;
  const blockers: string[] = [];

  if (deadLetterSalesCount > 0) {
    blockers.push(`${deadLetterSalesCount} dead-letter sale(s)`);
  }

  if (attentionSalesCount > 0) {
    blockers.push(`${attentionSalesCount} unsynced or failed sale(s)`);
  }

  if (state.suspendedSales.length > 0) {
    blockers.push(`${state.suspendedSales.length} suspended draft(s)`);
  }

  if (state.cart.lines.length > 0) {
    blockers.push(`${state.cart.lines.length} open cart line(s)`);
  }

  return {
    salesCount: state.recentSales.length,
    grossTotalMinor: state.recentSales.reduce((sum, sale) => sum + sale.totalMinor, 0),
    syncedSalesCount: state.recentSales.filter((sale) => sale.syncStatus === "synced").length,
    attentionSalesCount,
    deadLetterSalesCount,
    suspendedDraftCount: state.suspendedSales.length,
    openCartLineCount: state.cart.lines.length,
    readyToClose: blockers.length === 0,
    blockers
  };
}

function buildSnapshot(state: PreviewState): PosScreenSnapshot {
  return {
    catalog: cloneState(state.catalog),
    cart: {
      lines: cloneState(state.cart.lines),
      summary: summarizeCart(state.cart)
    },
    payments: cloneState(state.payments),
    suspendedSales: cloneState(state.suspendedSales),
    sync: cloneState(state.sync),
    reporting: {
      shift: buildShiftSummary(state)
    },
    recovery: {
      queue: cloneState(state.recoveryQueue),
      recentSales: cloneState(state.recentSales)
    },
    inventory: cloneState(state.inventory),
    ...(state.lastSubmitResult ? { lastSubmitResult: cloneState(state.lastSubmitResult) } : {}),
    ...(state.status ? { status: cloneState(state.status) } : {}),
    ...(state.errorMessage ? { errorMessage: state.errorMessage } : {})
  };
}

function createInitialState(): PreviewState {
  const cart = createCartState();
  const initialCatalog = cloneState(PREVIEW_CATALOG);
  const inventory = buildInventoryFromCatalog(initialCatalog);
  const initialSaleId = randomId("sale");
  const initialEventId = randomId("event");
  const happenedAt = new Date(Date.now() - 1000 * 60 * 48).toISOString();

  return {
    catalog: initialCatalog,
    cart: addCartLine(cart, {
      productId: "prod-pipe-110mm",
      name: "PVC Pipe 110mm",
      quantity: 2,
      unitPriceMinor: 50000,
      discountMinor: 6250,
      taxMinor: 0
    }),
    payments: createCheckoutPayments([
      {
        paymentId: "cash-payment-preview",
        method: "cash",
        amountMinor: 46875,
        status: "completed",
        paidAt: nowIso()
      },
      {
        paymentId: "momo-payment-preview",
        method: "mobile_money",
        amountMinor: 46875,
        providerCode: "mtn_momo",
        externalReference: "MM-PREVIEW-001",
        status: "completed",
        paidAt: nowIso()
      }
    ]),
    suspendedSales: [
      {
        id: randomId("suspend"),
        label: "Site Counter Hold",
        totalMinor: 6250,
        itemCount: 1,
        updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
      }
    ],
    sync: {
      pending: 1,
      processing: 0,
      synced: 3,
      failed: 1,
      deadLetter: 1,
      lastError: "HTTP request failed: backend not reachable"
    },
    recoveryQueue: [
      {
        id: randomId("queue"),
        eventId: initialEventId,
        eventType: "SALE_CREATED",
        aggregateId: initialSaleId,
        status: "failed",
        retryCount: 2,
        nextRetryAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
        lastError: "HTTP request failed: backend not reachable",
        createdAt: happenedAt,
        updatedAt: nowIso()
      },
      {
        id: randomId("queue"),
        eventId: randomId("event"),
        eventType: "SALE_CREATED",
        aggregateId: randomId("sale"),
        status: "dead_letter",
        retryCount: 5,
        lastError: "Payload rejected: duplicate external reference",
        createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: randomId("queue"),
        eventId: randomId("event"),
        eventType: "SALE_CREATED",
        aggregateId: randomId("sale"),
        status: "pending",
        retryCount: 0,
        createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString()
      }
    ],
    recentSales: [
      {
        saleId: initialSaleId,
        saleNumber: "POS-24051",
        totalMinor: 93750,
        happenedAt,
        syncStatus: "failed",
        eventId: initialEventId,
        retryCount: 2,
        itemCount: 2,
        items: [
          { name: "PVC Pipe 110mm", quantity: 1, lineTotalMinor: 50000 },
          { name: "PVC Elbow 1in", quantity: 7, lineTotalMinor: 43750 }
        ],
        payments: [
          { method: "cash", amountMinor: 43750 },
          { method: "mobile_money", amountMinor: 50000 }
        ]
      },
      {
        saleId: randomId("sale"),
        saleNumber: "POS-24050",
        totalMinor: 50000,
        happenedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
        syncStatus: "synced",
        eventId: randomId("event"),
        retryCount: 0,
        itemCount: 1,
        items: [{ name: "PVC Pipe 110mm", quantity: 1, lineTotalMinor: 50000 }],
        payments: [{ method: "cash", amountMinor: 50000 }]
      },
      {
        saleId: randomId("sale"),
        saleNumber: "POS-24049",
        totalMinor: 6250,
        happenedAt: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
        syncStatus: "dead_letter",
        eventId: randomId("event"),
        retryCount: 5,
        itemCount: 1,
        items: [{ name: "PVC Elbow 1in", quantity: 1, lineTotalMinor: 6250 }],
        payments: [{ method: "mobile_money", amountMinor: 6250 }]
      }
    ],
    inventory,
    lastSubmitResult: undefined,
    status: {
      kind: "info",
      message: "Browser preview mode. Actions mutate local in-memory demo state."
    },
    errorMessage: undefined
  };
}

function getCatalogPrice(item: PosCatalogItem): { unitPriceMinor: number; discountMinor: number; taxMinor: number } {
  if (item.productVariantId) {
    return {
      unitPriceMinor: 6250,
      discountMinor: 0,
      taxMinor: 0
    };
  }

  if (item.productId === "prod-cement") {
    return {
      unitPriceMinor: 14500,
      discountMinor: 0,
      taxMinor: 0
    };
  }

  if (item.productId === "prod-tape") {
    return {
      unitPriceMinor: 2250,
      discountMinor: 0,
      taxMinor: 0
    };
  }

  return {
    unitPriceMinor: 50000,
    discountMinor: 0,
    taxMinor: 0
  };
}

function findInventoryLine(state: PreviewState, productId: string, productVariantId?: string): PosInventorySummaryItem | undefined {
  return state.inventory.find(
    (line) =>
      line.productId === productId &&
      (line.productVariantId ?? null) === (productVariantId ?? null)
  );
}

function syncCatalogQuantities(state: PreviewState): void {
  state.catalog = state.catalog.map((item) => {
    const inventoryLine = findInventoryLine(state, item.productId, item.productVariantId);
    return {
      ...item,
      sellableQuantity: inventoryLine?.sellableQuantity ?? item.sellableQuantity
    };
  });
}

function updateSyncSummary(state: PreviewState, lastError?: string): void {
  state.sync = {
    pending: state.recoveryQueue.filter((item) => item.status === "pending").length,
    processing: state.recoveryQueue.filter((item) => item.status === "processing").length,
    synced: state.recoveryQueue.filter((item) => item.status === "synced").length,
    failed: state.recoveryQueue.filter((item) => item.status === "failed").length,
    deadLetter: state.recoveryQueue.filter((item) => item.status === "dead_letter").length,
    ...(lastError ? { lastError } : {})
  };
}

function installBridgeImplementation(): PipeflowPosBridge {
  let state = createInitialState();

  function withStatus(kind: PosOperatorStatus["kind"], message: string): PosScreenSnapshot {
    state.errorMessage = kind === "error" ? message : undefined;
    state.status = { kind, message };
    return cloneSnapshot(buildSnapshot(state));
  }

  function adjustInventoryForCart(multiplier: -1 | 1): void {
    for (const line of state.cart.lines) {
      const inventoryLine = findInventoryLine(state, line.productId, line.productVariantId);
      if (!inventoryLine) {
        continue;
      }

      inventoryLine.sellableQuantity = Math.max(0, inventoryLine.sellableQuantity + multiplier * line.quantity);
    }

    syncCatalogQuantities(state);
  }

  function createRecentSale(): PosRecentSaleSummary {
    const summary = summarizeCart(state.cart);
    return {
      saleId: randomId("sale"),
      saleNumber: `POS-${Date.now().toString().slice(-5)}`,
      totalMinor: summary.totalMinor,
      happenedAt: nowIso(),
      syncStatus: "pending",
      eventId: randomId("event"),
      retryCount: 0,
      itemCount: state.cart.lines.length,
      items: state.cart.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        lineTotalMinor: line.lineTotalMinor
      })),
      payments: state.payments.map((payment) => ({
        method: payment.method,
        amountMinor: payment.amountMinor
      }))
    };
  }

  function addQueueEntryForSale(sale: PosRecentSaleSummary): void {
    state.recoveryQueue.unshift({
      id: randomId("queue"),
      eventId: sale.eventId ?? randomId("event"),
      eventType: "SALE_CREATED",
      aggregateId: sale.saleId,
      status: "pending",
      retryCount: 0,
      createdAt: sale.happenedAt,
      updatedAt: sale.happenedAt
    });
    state.sync.pending += 1;
  }

  return {
    async loadSnapshot() {
      return cloneSnapshot(buildSnapshot(state));
    },
    async addCatalogItem(input) {
      const item = state.catalog.find(
        (entry) =>
          entry.productId === input.productId &&
          (entry.productVariantId ?? null) === (input.productVariantId ?? null)
      );

      if (!item) {
        return withStatus("error", "Selected catalog item was not found.");
      }

      state.cart = addCartLine(state.cart, {
        productId: item.productId,
        ...(item.productVariantId ? { productVariantId: item.productVariantId } : {}),
        name: item.name,
        quantity: 1,
        ...getCatalogPrice(item)
      });

      return withStatus("info", `Added ${item.name} to cart.`);
    },
    async updateCartQuantity(input) {
      state.cart = {
        lines: state.cart.lines
          .map((line) =>
            line.stockKey === input.stockKey
              ? {
                  ...line,
                  quantity: input.quantity,
                  lineTotalMinor: line.unitPriceMinor * input.quantity - line.discountMinor + line.taxMinor
                }
              : line
          )
          .filter((line) => line.quantity > 0)
      };

      if (state.payments.length > 0) {
        state.payments = createCheckoutPayments([]);
      }

      return withStatus("info", input.quantity > 0 ? "Cart updated." : "Item removed from cart.");
    },
    async clearCart() {
      state.cart = createCartState();
      state.payments = [];
      return withStatus("info", "Cart cleared.");
    },
    async suspendCurrentSale(label) {
      if (state.cart.lines.length === 0) {
        return withStatus("error", "Cannot suspend an empty cart.");
      }

      const summary = summarizeCart(state.cart);
      state.suspendedSales.unshift({
        id: randomId("suspend"),
        label:
          label?.trim() ||
          `Suspended Sale ${new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit"
          })}`,
        totalMinor: summary.totalMinor,
        itemCount: summary.totalItemCount,
        updatedAt: nowIso()
      });
      state.cart = createCartState();
      state.payments = [];
      return withStatus("info", "Sale suspended.");
    },
    async resumeSuspendedSale(id) {
      const suspended = state.suspendedSales.find((sale) => sale.id === id);
      if (!suspended) {
        return withStatus("error", "Suspended sale was not found.");
      }

      state.suspendedSales = state.suspendedSales.filter((sale) => sale.id !== id);
      state.cart = addCartLine(createCartState(), {
        productId: "prod-elbow-90",
        productVariantId: "variant-elbow-1in",
        name: suspended.label.includes("Counter") ? "PVC Elbow 1in" : "PVC Pipe 110mm",
        quantity: Math.max(1, suspended.itemCount),
        unitPriceMinor: suspended.totalMinor,
        discountMinor: 0,
        taxMinor: 0
      });
      state.payments = [];
      return withStatus("info", `Suspended sale resumed: ${suspended.label}.`);
    },
    async deleteSuspendedSale(id) {
      state.suspendedSales = state.suspendedSales.filter((sale) => sale.id !== id);
      return withStatus("info", "Suspended sale deleted.");
    },
    async setPayments(payments) {
      state.payments = createCheckoutPayments(payments);
      return withStatus("info", "Payments updated.");
    },
    async submitSale() {
      const summary = summarizeCart(state.cart);
      if (state.cart.lines.length === 0) {
        return withStatus("error", "Cart must include at least one line.");
      }

      const paymentTotal = state.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
      if (state.payments.length === 0 || paymentTotal !== summary.totalMinor) {
        return withStatus("error", "Payment total must match cart total.");
      }

      const sale = createRecentSale();
      state.recentSales.unshift(sale);
      state.lastSubmitResult = {
        saleId: sale.saleId,
        eventId: sale.eventId ?? randomId("event"),
        saleNumber: sale.saleNumber
      };
      addQueueEntryForSale(sale);
      adjustInventoryForCart(-1);
      state.cart = createCartState();
      state.payments = [];
      return withStatus("success", `Sale submitted: ${sale.saleNumber}.`);
    },
    async processSyncQueue() {
      let updatedCount = 0;
      let lastError: string | undefined;

      state.recoveryQueue = state.recoveryQueue.map((item) => {
        if (item.status === "dead_letter") {
          lastError = item.lastError;
          return item;
        }

        if (item.status === "pending" || item.status === "processing" || item.status === "failed") {
          updatedCount += 1;
          return {
            status: "synced",
            id: item.id,
            eventId: item.eventId,
            eventType: item.eventType,
            aggregateId: item.aggregateId,
            retryCount: item.retryCount,
            createdAt: item.createdAt,
            updatedAt: nowIso(),
            acknowledgedAt: nowIso()
          };
        }

        return item;
      });

      for (const sale of state.recentSales) {
        const queueItem = state.recoveryQueue.find((item) => item.aggregateId === sale.saleId);
        if (queueItem) {
          sale.syncStatus = queueItem.status;
          sale.retryCount = queueItem.retryCount;
        }
      }

      updateSyncSummary(state, lastError);

      return withStatus(
        "success",
        updatedCount > 0 ? "Sync processed successfully." : "No pending queue items to process."
      );
    },
    async retryQueueItem(id) {
      let moved = false;
      state.recoveryQueue = state.recoveryQueue.map((item) => {
        if (item.id !== id || (item.status !== "failed" && item.status !== "dead_letter")) {
          return item;
        }

        moved = true;
        return {
          id: item.id,
          eventId: item.eventId,
          eventType: item.eventType,
          aggregateId: item.aggregateId,
          status: "pending",
          retryCount: 0,
          createdAt: item.createdAt,
          updatedAt: nowIso()
        };
      });

      if (!moved) {
        return withStatus("error", "Only failed or dead-letter queue items can be retried.");
      }

      updateSyncSummary(state);
      return withStatus("info", "Queue item moved back to pending.");
    },
    async retryAllQueueItems() {
      const recoverable = state.recoveryQueue.filter((item) => item.status === "failed" || item.status === "dead_letter");
      if (recoverable.length === 0) {
        return withStatus("info", "No failed queue items to retry.");
      }

      state.recoveryQueue = state.recoveryQueue.map((item) =>
        item.status === "failed" || item.status === "dead_letter"
          ? {
              id: item.id,
              eventId: item.eventId,
              eventType: item.eventType,
              aggregateId: item.aggregateId,
              status: "pending",
              retryCount: 0,
              createdAt: item.createdAt,
              updatedAt: nowIso()
            }
          : item
      );

      for (const sale of state.recentSales) {
        const queueItem = state.recoveryQueue.find((item) => item.aggregateId === sale.saleId);
        if (queueItem) {
          sale.syncStatus = queueItem.status;
          sale.retryCount = queueItem.retryCount;
        }
      }

      updateSyncSummary(state);
      return withStatus("info", `Retried ${recoverable.length} queue item(s).`);
    },
    async resetDemoState() {
      state = createInitialState();
      return withStatus("info", "Preview state reset.");
    }
  };
}

export function installPreviewBridge(): void {
  if (typeof window === "undefined" || window.pipeflowPos) {
    return;
  }

  window.pipeflowPos = installBridgeImplementation();
}
