import { randomUUID } from "node:crypto";

import type {
  StockTransferReceivedPayload,
  SyncBatchResponse,
  SyncEnvelope
} from "../../../packages/types/src/index.ts";

import { WarehouseBackendClient } from "./backend-client.ts";
import type { ReceivingTransferSummary } from "./receiving-model.ts";

export interface ReceiveTransferDraft {
  transfer: ReceivingTransferSummary;
  receiptId: string;
  organizationId: string;
  branchId: string;
  deviceId: string;
  receivedByUserId: string;
  receivedAt: string;
  notes?: string;
  quantitiesByTransferItemId: Record<string, number>;
}

export function buildReceiveTransferInput(
  transfer: ReceivingTransferSummary,
  input: Omit<ReceiveTransferDraft, "transfer">
): ReceiveTransferDraft {
  return {
    transfer,
    ...input
  };
}

export function buildReceiveTransferPayload(input: ReceiveTransferDraft): StockTransferReceivedPayload {
  const lines = input.transfer.lines
    .filter((line) => {
      const quantity = input.quantitiesByTransferItemId[line.transferItemId] ?? 0;
      return quantity > 0;
    })
    .map((line) => {
      const quantity = input.quantitiesByTransferItemId[line.transferItemId] ?? 0;

      if (quantity < 0) {
        throw new Error(`Received quantity for ${line.transferItemId} cannot be negative.`);
      }

      if (quantity > line.outstandingQuantity) {
        throw new Error(
          `Received quantity for ${line.transferItemId} exceeds remaining dispatched quantity.`
        );
      }

      return {
        transferItemId: line.transferItemId,
        productId: line.productId,
        ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
        receivedQuantity: quantity
      };
    });

  if (lines.length === 0) {
    throw new Error("At least one receiving quantity must be greater than zero.");
  }

  return {
    transferId: input.transfer.transferId,
    receiptId: input.receiptId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    receivedByUserId: input.receivedByUserId,
    receivedAt: input.receivedAt,
    ...(input.notes ? { notes: input.notes } : {}),
    items: lines
  };
}

export async function submitReceiveTransfer(
  client: WarehouseBackendClient,
  input: ReceiveTransferDraft
): Promise<SyncBatchResponse> {
  const payload = buildReceiveTransferPayload(input);
  const envelope: SyncEnvelope = {
    eventId: randomUUID(),
    eventType: "STOCK_TRANSFER_RECEIVED",
    aggregateType: "stock_transfer",
    aggregateId: payload.transferId,
    createdAt: payload.receivedAt,
    payload: payload as unknown as Record<string, unknown>
  };

  return client.ingestEvents({
    branchId: payload.branchId,
    deviceId: input.deviceId,
    events: [envelope]
  });
}
