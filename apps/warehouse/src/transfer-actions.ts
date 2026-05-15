import { randomUUID } from "node:crypto";

import type {
  StockTransferCancelledPayload,
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
