import type { ReceivingQueue, ReceivingTransferSummary } from "./receiving-model.ts";

function renderTransfer(transfer: ReceivingTransferSummary): string[] {
  const lines = [
    `${transfer.requestNumber} | ${transfer.status} | ${transfer.sourceType}:${transfer.sourceId} -> ${transfer.destinationType}:${transfer.destinationId}`,
    `  transferId: ${transfer.transferId}`,
    `  outstanding total: ${transfer.totalOutstandingQuantity}`
  ];

  for (const line of transfer.lines) {
    const discrepancy = line.outstandingQuantity > 0 ? " | discrepancy-open" : "";
    lines.push(
      `  item ${line.transferItemId} | product ${line.productId}${line.productVariantId ? ` variant ${line.productVariantId}` : ""} | disp ${line.dispatchedQuantity} | recv ${line.receivedQuantity} | remaining ${line.outstandingQuantity}${discrepancy}`
    );
  }

  return lines;
}

export function renderReceivingQueue(queue: ReceivingQueue): string {
  const lines = [
    "PipeFlow warehouse receiving queue",
    `generatedAt: ${queue.generatedAt}`,
    `readyToReceive: ${queue.totalTransfers}`
  ];

  if (queue.transfers.length === 0) {
    lines.push("No inbound transfers are currently ready to receive.");
    return lines.join("\n");
  }

  for (const transfer of queue.transfers) {
    lines.push(...renderTransfer(transfer));
  }

  return lines.join("\n");
}
