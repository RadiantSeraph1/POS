import { buildCreateLocalSaleInput, createCheckoutPayments, type PosPaymentInput } from "./checkout.ts";
import { addCartLine, createCartState, summarizeCart } from "./cart.ts";
import { listSellableCatalog } from "./catalog.ts";
import { renderPosScreen } from "./renderer.ts";
import { readSyncPanelState } from "./sync-panel.ts";
import type { SqliteTransactionRunner } from "../db.ts";
import { createLocalSale } from "../sales/index.ts";
import type { SyncQueueProcessor } from "../sync/index.ts";

export interface PosFlowContext {
  ids: {
    organization: string;
    branch: string;
    device: string;
    user: string;
    customer: string;
    shift: string;
    saleOne: string;
    saleItemOne: string;
    saleItemTwo: string;
    paymentCashOne: string;
    paymentMomoOne: string;
    eventOne: string;
  };
  happenedAt: string;
}

function readInventoryLines(db: SqliteTransactionRunner): string[] {
  const inventory = db.query<{
    product_id: string;
    product_variant_id: string | null;
    sellable_quantity: number;
  }>(
    `
      SELECT product_id, product_variant_id, sellable_quantity
      FROM inventory_levels
      ORDER BY product_id, product_variant_id
    `
  );

  return inventory.map(
    (row) =>
      `- ${row.product_id}${row.product_variant_id ? ` variant ${row.product_variant_id}` : ""} | stock ${row.sellable_quantity}`
  );
}

export async function runPosFlow(
  db: SqliteTransactionRunner,
  processor: SyncQueueProcessor,
  context: PosFlowContext
): Promise<void> {
  const catalog = listSellableCatalog(db);
  const baseProduct = catalog.find((item) => !item.productVariantId);
  const variantProduct = catalog.find((item) => item.productVariantId);

  if (!baseProduct || !variantProduct) {
    throw new Error("POS flow requires one base product and one variant product in the local catalog.");
  }

  const cart = addCartLine(
    addCartLine(createCartState(), {
      productId: baseProduct.productId,
      name: baseProduct.name,
      quantity: 2,
      unitPriceMinor: 50000,
      discountMinor: 0,
      taxMinor: 0
    }),
    {
      productId: variantProduct.productId,
      ...(variantProduct.productVariantId ? { productVariantId: variantProduct.productVariantId } : {}),
      name: variantProduct.name,
      quantity: 4,
      unitPriceMinor: 6250,
      discountMinor: 5000,
      taxMinor: 0
    }
  );

  const summary = summarizeCart(cart);
  const payments: PosPaymentInput[] = createCheckoutPayments([
    {
      paymentId: context.ids.paymentCashOne,
      method: "cash",
      amountMinor: 80000,
      status: "completed",
      paidAt: context.happenedAt
    },
    {
      paymentId: context.ids.paymentMomoOne,
      method: "mobile_money",
      amountMinor: 40000,
      providerCode: "mtn_momo",
      externalReference: "MM-REF-001",
      status: "completed",
      paidAt: context.happenedAt
    }
  ]);

  console.log(
    renderPosScreen({
      title: "PipeFlow desktop POS screen (before sale)",
      catalog,
      cart,
      summary,
      payments,
      sync: readSyncPanelState(db),
      inventoryLines: readInventoryLines(db)
    })
  );

  const saleInput = buildCreateLocalSaleInput(
    cart,
    payments as Array<PosPaymentInput & { paymentId: string }>,
    {
      eventId: context.ids.eventOne,
      saleId: context.ids.saleOne,
      saleNumber: "POS-000001",
      organizationId: context.ids.organization,
      branchId: context.ids.branch,
      shiftId: context.ids.shift,
      cashierUserId: context.ids.user,
      deviceId: context.ids.device,
      customerId: context.ids.customer,
      happenedAt: context.happenedAt,
      notes: "Single-screen POS flow demo"
    },
    [context.ids.saleItemOne, context.ids.saleItemTwo]
  );

  await createLocalSale(db, saleInput);

  console.log(
    renderPosScreen({
      title: "PipeFlow desktop POS screen (after local sale, before sync)",
      catalog,
      cart,
      summary,
      payments,
      sync: readSyncPanelState(db),
      inventoryLines: readInventoryLines(db)
    })
  );

  await processor.processPending();

  console.log(
    renderPosScreen({
      title: "PipeFlow desktop POS screen (after sync)",
      catalog,
      cart,
      summary,
      payments,
      sync: readSyncPanelState(db),
      inventoryLines: readInventoryLines(db)
    })
  );
}
