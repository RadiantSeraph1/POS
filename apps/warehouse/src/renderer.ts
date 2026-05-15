import type { TransferSummary, WarehouseDashboardState } from "./models.ts";

function renderTransferLine(transfer: TransferSummary): string[] {
  const lines = [
    `${transfer.requestNumber} | ${transfer.status} | ${transfer.sourceType}:${transfer.sourceId} -> ${transfer.destinationType}:${transfer.destinationId}`,
    `  transferId: ${transfer.transferId}`,
    `  requestedBy: ${transfer.requestedByUserId}`,
    `  updated: ${transfer.lastUpdatedAt}`
  ];

  for (const item of transfer.lines) {
    lines.push(
      `  item ${item.transferItemId} | product ${item.productId}${item.productVariantId ? ` variant ${item.productVariantId}` : ""} | req ${item.requestedQuantity} | appr ${item.approvedQuantity} | disp ${item.dispatchedQuantity} | recv ${item.receivedQuantity}`
    );
  }

  if (transfer.notes) {
    lines.push(`  notes: ${transfer.notes}`);
  }

  return lines;
}

export function renderWarehouseDashboard(state: WarehouseDashboardState): string {
  const lines = [
    "PipeFlow warehouse dashboard",
    `generatedAt: ${state.generatedAt}`,
    `totals | all ${state.totalTransfers} | requested ${state.requestedTransfers} | approved ${state.approvedTransfers} | dispatched ${state.dispatchedTransfers} | received ${state.receivedTransfers} | partial ${state.partialReceiptTransfers}`
  ];

  for (const transfer of state.transfers) {
    lines.push(...renderTransferLine(transfer));
  }

  return lines.join("\n");
}

