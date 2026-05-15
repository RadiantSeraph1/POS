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
    "catalogPreview:"
  ];

  for (const item of options.catalog.slice(0, 4)) {
    lines.push(`- ${item.sku} | ${item.name} | stock ${item.sellableQuantity}`);
  }

  lines.push("cart:");
  for (const line of options.cart.lines) {
    lines.push(`- ${line.name} | qty ${line.quantity} | unit ${line.unitPriceMinor} | total ${line.lineTotalMinor}`);
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
  return lines.join("\n");
}
