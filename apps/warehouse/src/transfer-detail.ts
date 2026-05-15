import type { TransferSummary } from "./models.ts";

export interface TransferDetailLineSummary {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  approvalShortfallQuantity: number;
  dispatchShortfallQuantity: number;
  receiptShortfallQuantity: number;
  hasApprovalShortfall: boolean;
  hasDispatchShortfall: boolean;
  hasReceiptShortfall: boolean;
}

export interface TransferDetailSummary {
  transfer: TransferSummary;
  totals: {
    requestedQuantity: number;
    approvedQuantity: number;
    dispatchedQuantity: number;
    receivedQuantity: number;
    approvalShortfallQuantity: number;
    dispatchShortfallQuantity: number;
    receiptShortfallQuantity: number;
  };
  lines: TransferDetailLineSummary[];
}

export function summarizeTransferDetail(transfer: TransferSummary): TransferDetailSummary {
  const lines = transfer.lines.map((line) => {
    const approvalShortfallQuantity = Math.max(0, line.requestedQuantity - line.approvedQuantity);
    const dispatchShortfallQuantity = Math.max(0, line.approvedQuantity - line.dispatchedQuantity);
    const receiptShortfallQuantity = Math.max(0, line.dispatchedQuantity - line.receivedQuantity);

    return {
      transferItemId: line.transferItemId,
      productId: line.productId,
      ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
      requestedQuantity: line.requestedQuantity,
      approvedQuantity: line.approvedQuantity,
      dispatchedQuantity: line.dispatchedQuantity,
      receivedQuantity: line.receivedQuantity,
      approvalShortfallQuantity,
      dispatchShortfallQuantity,
      receiptShortfallQuantity,
      hasApprovalShortfall: approvalShortfallQuantity > 0,
      hasDispatchShortfall: dispatchShortfallQuantity > 0,
      hasReceiptShortfall: receiptShortfallQuantity > 0
    };
  });

  return {
    transfer,
    totals: {
      requestedQuantity: lines.reduce((sum, line) => sum + line.requestedQuantity, 0),
      approvedQuantity: lines.reduce((sum, line) => sum + line.approvedQuantity, 0),
      dispatchedQuantity: lines.reduce((sum, line) => sum + line.dispatchedQuantity, 0),
      receivedQuantity: lines.reduce((sum, line) => sum + line.receivedQuantity, 0),
      approvalShortfallQuantity: lines.reduce((sum, line) => sum + line.approvalShortfallQuantity, 0),
      dispatchShortfallQuantity: lines.reduce((sum, line) => sum + line.dispatchShortfallQuantity, 0),
      receiptShortfallQuantity: lines.reduce((sum, line) => sum + line.receiptShortfallQuantity, 0)
    },
    lines
  };
}
