import { randomUUID } from "node:crypto";

import type {
  StockTransferApprovedPayload,
  StockTransferCancelledPayload,
  StockTransferDispatchedPayload,
  StockTransferRejectedPayload,
  SyncBatchRequest,
  SyncEnvelope
} from "../../../packages/types/src/index.ts";

import type { WarehouseBackendClient } from "./backend-client.ts";
import type { TransferSummary } from "./models.ts";

export interface RejectTransferInput {
  transfer: TransferSummary;
  organizationId: string;
  branchId: string;
  deviceId: string;
  rejectedByUserId: string;
  rejectedAt: string;
  reason: string;
}

export interface ApproveTransferInput {
  transfer: TransferSummary;
  approvedByUserId: string;
  approvedAt: string;
  quantitiesByTransferItemId: Record<string, number>;
}

export interface DispatchTransferInput {
  transfer: TransferSummary;
  dispatchId: string;
  warehouseId: string;
  dispatchedByUserId: string;
  dispatchedAt: string;
  quantitiesByTransferItemId: Record<string, number>;
}

export interface CancelTransferInput {
  transfer: TransferSummary;
  organizationId: string;
  branchId: string;
  deviceId: string;
  cancelledByUserId: string;
  cancelledAt: string;
  reason: string;
}

function assertReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0) {
    throw new Error("A reason is required for this transfer action.");
  }

  return normalized;
}

function assertTransferQuantity(
  quantity: number,
  transferItemId: string,
  ceiling: number,
  label: "requested" | "approved"
): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`Quantity for ${transferItemId} must be a non-negative number.`);
  }

  if (quantity > ceiling) {
    throw new Error(`Quantity for ${transferItemId} cannot exceed ${label} quantity.`);
  }

  return quantity;
}

function toEnvelope(
  eventType: SyncEnvelope["eventType"],
  aggregateId: string,
  payload: Record<string, unknown>,
  createdAt: string
): SyncEnvelope {
  return {
    eventId: randomUUID(),
    eventType,
    aggregateType: "stock_transfer",
    aggregateId,
    payload,
    createdAt
  };
}

export function buildRejectTransferEnvelope(input: RejectTransferInput): SyncEnvelope {
  const payload: StockTransferRejectedPayload = {
    transferId: input.transfer.transferId,
    rejectedByUserId: input.rejectedByUserId,
    rejectedAt: input.rejectedAt,
    reason: assertReason(input.reason)
  };

  return toEnvelope(
    "STOCK_TRANSFER_REJECTED" as SyncEnvelope["eventType"],
    input.transfer.transferId,
    payload as unknown as Record<string, unknown>,
    input.rejectedAt
  );
}

export function buildApproveTransferEnvelope(input: ApproveTransferInput): SyncEnvelope {
  const payload: StockTransferApprovedPayload = {
    transferId: input.transfer.transferId,
    approvedByUserId: input.approvedByUserId,
    approvedAt: input.approvedAt,
    items: input.transfer.lines.map((line) => ({
      transferItemId: line.transferItemId,
      approvedQuantity: assertTransferQuantity(
        input.quantitiesByTransferItemId[line.transferItemId] ?? 0,
        line.transferItemId,
        line.requestedQuantity,
        "requested"
      )
    }))
  };

  return toEnvelope(
    "STOCK_TRANSFER_APPROVED" as SyncEnvelope["eventType"],
    input.transfer.transferId,
    payload as unknown as Record<string, unknown>,
    input.approvedAt
  );
}

export function buildDispatchTransferEnvelope(input: DispatchTransferInput): SyncEnvelope {
  const payload: StockTransferDispatchedPayload = {
    transferId: input.transfer.transferId,
    dispatchId: input.dispatchId,
    warehouseId: input.warehouseId,
    dispatchedByUserId: input.dispatchedByUserId,
    dispatchedAt: input.dispatchedAt,
    items: input.transfer.lines.map((line) => ({
      transferItemId: line.transferItemId,
      dispatchedQuantity: assertTransferQuantity(
        input.quantitiesByTransferItemId[line.transferItemId] ?? 0,
        line.transferItemId,
        line.approvedQuantity,
        "approved"
      )
    }))
  };

  return toEnvelope(
    "STOCK_TRANSFER_DISPATCHED" as SyncEnvelope["eventType"],
    input.transfer.transferId,
    payload as unknown as Record<string, unknown>,
    input.dispatchedAt
  );
}

export function buildCancelTransferEnvelope(input: CancelTransferInput): SyncEnvelope {
  const payload: StockTransferCancelledPayload = {
    transferId: input.transfer.transferId,
    cancelledByUserId: input.cancelledByUserId,
    cancelledAt: input.cancelledAt,
    reason: assertReason(input.reason)
  };

  return toEnvelope(
    "STOCK_TRANSFER_CANCELLED" as SyncEnvelope["eventType"],
    input.transfer.transferId,
    payload as unknown as Record<string, unknown>,
    input.cancelledAt
  );
}

export async function submitRejectTransfer(
  client: WarehouseBackendClient,
  input: RejectTransferInput
): Promise<void> {
  const batch: SyncBatchRequest = {
    branchId: input.branchId,
    deviceId: input.deviceId,
    events: [buildRejectTransferEnvelope(input)]
  };

  await client.ingestEvents(batch);
}

export async function submitApproveTransfer(
  client: WarehouseBackendClient,
  input: ApproveTransferInput & { branchId: string; deviceId: string }
): Promise<void> {
  const batch: SyncBatchRequest = {
    branchId: input.branchId,
    deviceId: input.deviceId,
    events: [buildApproveTransferEnvelope(input)]
  };

  await client.ingestEvents(batch);
}

export async function submitDispatchTransfer(
  client: WarehouseBackendClient,
  input: DispatchTransferInput & { branchId: string; deviceId: string }
): Promise<void> {
  const batch: SyncBatchRequest = {
    branchId: input.branchId,
    deviceId: input.deviceId,
    events: [buildDispatchTransferEnvelope(input)]
  };

  await client.ingestEvents(batch);
}

export async function submitCancelTransfer(
  client: WarehouseBackendClient,
  input: CancelTransferInput
): Promise<void> {
  const batch: SyncBatchRequest = {
    branchId: input.branchId,
    deviceId: input.deviceId,
    events: [buildCancelTransferEnvelope(input)]
  };

  await client.ingestEvents(batch);
}
