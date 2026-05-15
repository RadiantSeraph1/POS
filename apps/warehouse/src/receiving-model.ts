import type { TransferSummary, WarehouseDashboardState } from "./models.ts";

export interface ReceivingLineSummary {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  outstandingQuantity: number;
}

export interface ReceivingTransferSummary {
  transferId: string;
  requestNumber: string;
  sourceType: string;
  sourceId: string;
  destinationType: string;
  destinationId: string;
  status: "dispatched" | "partial_receipt";
  totalOutstandingQuantity: number;
  lines: ReceivingLineSummary[];
  lastUpdatedAt: string;
}

export interface ReceivingQueue {
  generatedAt: string;
  totalTransfers: number;
  transfers: ReceivingTransferSummary[];
}

function toReceivingTransfer(transfer: TransferSummary): ReceivingTransferSummary {
  if (transfer.status !== "dispatched" && transfer.status !== "partial_receipt") {
    throw new Error(`Transfer ${transfer.transferId} is not actionable for receiving.`);
  }

  const lines = transfer.lines.map((line) => ({
    transferItemId: line.transferItemId,
    productId: line.productId,
    ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
    requestedQuantity: line.requestedQuantity,
    approvedQuantity: line.approvedQuantity,
    dispatchedQuantity: line.dispatchedQuantity,
    receivedQuantity: line.receivedQuantity,
    outstandingQuantity: Math.max(0, line.dispatchedQuantity - line.receivedQuantity)
  }));

  return {
    transferId: transfer.transferId,
    requestNumber: transfer.requestNumber,
    sourceType: transfer.sourceType,
    sourceId: transfer.sourceId,
    destinationType: transfer.destinationType,
    destinationId: transfer.destinationId,
    status: transfer.status,
    totalOutstandingQuantity: lines.reduce((sum, line) => sum + line.outstandingQuantity, 0),
    lines,
    lastUpdatedAt: transfer.lastUpdatedAt
  };
}

export function deriveReceivingQueue(dashboard: WarehouseDashboardState): ReceivingQueue {
  const transfers = dashboard.transfers
    .filter((transfer) => transfer.status === "dispatched" || transfer.status === "partial_receipt")
    .map(toReceivingTransfer)
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));

  return {
    generatedAt: dashboard.generatedAt,
    totalTransfers: transfers.length,
    transfers
  };
}
