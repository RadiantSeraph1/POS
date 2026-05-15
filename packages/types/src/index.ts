export type UUID = string;

export type InventoryEventType =
  | "SALE_CREATED"
  | "SALE_VOIDED"
  | "RETURN_COMPLETED"
  | "STOCK_RECEIVED"
  | "STOCK_TRANSFER_REQUESTED"
  | "STOCK_TRANSFER_APPROVED"
  | "STOCK_TRANSFER_DISPATCHED"
  | "STOCK_TRANSFER_RECEIVED"
  | "STOCK_ADJUSTED"
  | "DAMAGE_LOGGED";

export type AggregateType =
  | "sale"
  | "refund"
  | "inventory_adjustment"
  | "stock_transfer"
  | "warehouse_receipt";

export type SyncQueueStatus =
  | "pending"
  | "processing"
  | "synced"
  | "failed"
  | "dead_letter";

export interface InventoryEvent {
  id: UUID;
  type: InventoryEventType;
  organizationId: UUID;
  branchId?: UUID;
  warehouseId?: UUID;
  aggregateId: UUID;
  actorUserId: UUID;
  deviceId: UUID;
  localTimestamp: string;
  schemaVersion: number;
  aggregateType: AggregateType;
  payload: Record<string, unknown>;
}

export interface SyncQueueRecord {
  id: UUID;
  eventId: UUID;
  status: SyncQueueStatus;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncEnvelope {
  eventId: UUID;
  eventType: InventoryEventType;
  aggregateType: AggregateType;
  aggregateId: UUID;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SyncBatchRequest {
  branchId: UUID;
  deviceId: UUID;
  events: SyncEnvelope[];
}

export interface SyncEventAcknowledgement {
  eventId: UUID;
  status: "accepted" | "duplicate" | "rejected";
  message?: string;
  acknowledgedAt: string;
}

export interface SyncBatchResponse {
  received: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  results: SyncEventAcknowledgement[];
}

export interface SaleCreatedPayload {
  saleId: UUID;
  saleNumber: string;
  organizationId: UUID;
  branchId: UUID;
  deviceId: UUID;
  cashierUserId: UUID;
  customerId?: UUID;
  currencyCode: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  items: Array<{
    saleItemId: UUID;
    productId: UUID;
    productVariantId?: UUID;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
    taxMinor: number;
    lineTotalMinor: number;
  }>;
  payments: Array<{
    paymentId: UUID;
    method: string;
    amountMinor: number;
    providerCode?: string;
    externalReference?: string;
  }>;
}

export interface CreateLocalSaleInput {
  eventId: UUID;
  saleId: UUID;
  saleNumber: string;
  organizationId: UUID;
  branchId: UUID;
  shiftId: UUID;
  cashierUserId: UUID;
  deviceId: UUID;
  customerId?: UUID;
  currencyCode: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  happenedAt: string;
  notes?: string;
  items: Array<{
    saleItemId: UUID;
    productId: UUID;
    productVariantId?: UUID;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
    taxMinor: number;
    lineTotalMinor: number;
  }>;
  payments: Array<{
    paymentId: UUID;
    method: string;
    amountMinor: number;
    providerCode?: string;
    externalReference?: string;
    status: string;
    paidAt: string;
  }>;
}

export interface TransferItemQuantityPayload {
  transferItemId: UUID;
  productId: UUID;
  productVariantId?: UUID;
  quantity: number;
}

export interface TransferApprovalQuantityPayload {
  transferItemId: UUID;
  approvedQuantity: number;
}

export interface TransferDispatchQuantityPayload {
  transferItemId: UUID;
  dispatchedQuantity: number;
}

export interface TransferReceiptQuantityPayload {
  transferItemId: UUID;
  productId: UUID;
  productVariantId?: UUID;
  receivedQuantity: number;
}

export interface StockTransferRequestedPayload {
  transferId: UUID;
  requestNumber: string;
  organizationId: UUID;
  sourceType: string;
  sourceId: UUID;
  destinationType: string;
  destinationId: UUID;
  requestedByUserId: UUID;
  items: TransferItemQuantityPayload[];
}

export interface StockTransferApprovedPayload {
  transferId: UUID;
  approvedByUserId: UUID;
  approvedAt: string;
  items: TransferApprovalQuantityPayload[];
}

export interface StockTransferDispatchedPayload {
  transferId: UUID;
  dispatchId: UUID;
  warehouseId: UUID;
  dispatchedByUserId: UUID;
  dispatchedAt: string;
  items: TransferDispatchQuantityPayload[];
}

export interface StockTransferReceivedPayload {
  transferId: UUID;
  receiptId: UUID;
  organizationId: UUID;
  branchId: UUID;
  receivedByUserId: UUID;
  receivedAt: string;
  notes?: string;
  items: TransferReceiptQuantityPayload[];
}
