export type TransferLifecycleStatus =
  | "requested"
  | "approved"
  | "dispatched"
  | "received"
  | "partial_receipt"
  | "rejected"
  | "cancelled";

export interface TransferLineSummary {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
}

export interface TransferEventSummary {
  eventId: string;
  eventType: string;
  createdAt: string;
  receivedAt: string;
}

export interface TransferSummary {
  transferId: string;
  requestNumber: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  destinationType: string;
  destinationId: string;
  requestedByUserId: string;
  approvedByUserId?: string;
  dispatchedByUserId?: string;
  receivedByUserId?: string;
  rejectedByUserId?: string;
  cancelledByUserId?: string;
  status: TransferLifecycleStatus;
  lines: TransferLineSummary[];
  events: TransferEventSummary[];
  createdAt: string;
  lastUpdatedAt: string;
  notes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
}

export interface WarehouseDashboardState {
  generatedAt: string;
  totalTransfers: number;
  requestedTransfers: number;
  approvedTransfers: number;
  dispatchedTransfers: number;
  receivedTransfers: number;
  partialReceiptTransfers: number;
  rejectedTransfers: number;
  cancelledTransfers: number;
  transfers: TransferSummary[];
}
