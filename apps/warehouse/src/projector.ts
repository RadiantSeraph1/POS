import type { SyncEnvelope } from "../../../packages/types/src/index.ts";
import type { SyncEventsResponse } from "./backend-client.ts";
import type {
  TransferEventSummary,
  TransferLineSummary,
  TransferSummary,
  WarehouseDashboardState
} from "./models.ts";

interface MutableTransferSummary extends Omit<TransferSummary, "lines" | "events"> {
  lines: Map<string, TransferLineSummary>;
  events: TransferEventSummary[];
}

function ensureTransfer(
  transfers: Map<string, MutableTransferSummary>,
  event: SyncEventsResponse["events"][number]
): MutableTransferSummary {
  let existing = transfers.get(event.aggregateId);

  if (!existing) {
    existing = {
      transferId: event.aggregateId,
      requestNumber: "unknown",
      organizationId: "unknown",
      sourceType: "unknown",
      sourceId: "unknown",
      destinationType: "unknown",
      destinationId: "unknown",
      requestedByUserId: "unknown",
      status: "requested",
      lines: new Map(),
      events: [],
      createdAt: event.createdAt,
      lastUpdatedAt: event.receivedAt
    };
    transfers.set(event.aggregateId, existing);
  }

  existing.events.push({
    eventId: event.eventId,
    eventType: event.eventType,
    createdAt: event.createdAt,
    receivedAt: event.receivedAt
  });
  existing.lastUpdatedAt = event.receivedAt > existing.lastUpdatedAt ? event.receivedAt : existing.lastUpdatedAt;

  return existing;
}

function ensureLine(
  transfer: MutableTransferSummary,
  transferItemId: string,
  productId: string,
  productVariantId?: string
): TransferLineSummary {
  let line = transfer.lines.get(transferItemId);

  if (!line) {
    line = {
      transferItemId,
      productId,
      ...(productVariantId ? { productVariantId } : {}),
      requestedQuantity: 0,
      approvedQuantity: 0,
      dispatchedQuantity: 0,
      receivedQuantity: 0
    };
    transfer.lines.set(transferItemId, line);
  }

  return line;
}

function applyRequestedEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  transfer.requestNumber = String(payload.requestNumber ?? transfer.requestNumber);
  transfer.organizationId = String(payload.organizationId ?? transfer.organizationId);
  transfer.sourceType = String(payload.sourceType ?? transfer.sourceType);
  transfer.sourceId = String(payload.sourceId ?? transfer.sourceId);
  transfer.destinationType = String(payload.destinationType ?? transfer.destinationType);
  transfer.destinationId = String(payload.destinationId ?? transfer.destinationId);
  transfer.requestedByUserId = String(payload.requestedByUserId ?? transfer.requestedByUserId);

  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const rawItem of items) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const line = ensureLine(
      transfer,
      String(item.transferItemId),
      String(item.productId),
      typeof item.productVariantId === "string" ? item.productVariantId : undefined
    );
    line.requestedQuantity = Number(item.quantity ?? line.requestedQuantity);
  }

  transfer.status = "requested";
}

function applyApprovedEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  if (typeof payload.approvedByUserId === "string") {
    transfer.approvedByUserId = payload.approvedByUserId;
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const rawItem of items) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const transferItemId = String(item.transferItemId);
    const existing = transfer.lines.get(transferItemId);
    const line = ensureLine(
      transfer,
      transferItemId,
      existing?.productId ?? "unknown-product",
      existing?.productVariantId
    );
    line.approvedQuantity = Number(item.approvedQuantity ?? line.approvedQuantity);
  }

  transfer.status = "approved";
}

function applyDispatchedEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  if (typeof payload.dispatchedByUserId === "string") {
    transfer.dispatchedByUserId = payload.dispatchedByUserId;
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const rawItem of items) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const transferItemId = String(item.transferItemId);
    const existing = transfer.lines.get(transferItemId);
    const line = ensureLine(
      transfer,
      transferItemId,
      existing?.productId ?? "unknown-product",
      existing?.productVariantId
    );
    line.dispatchedQuantity = Number(item.dispatchedQuantity ?? line.dispatchedQuantity);
  }

  transfer.status = "dispatched";
}

function applyReceivedEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  if (typeof payload.receivedByUserId === "string") {
    transfer.receivedByUserId = payload.receivedByUserId;
  }
  if (typeof payload.notes === "string") {
    transfer.notes = payload.notes;
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const rawItem of items) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const line = ensureLine(
      transfer,
      String(item.transferItemId),
      String(item.productId),
      typeof item.productVariantId === "string" ? item.productVariantId : undefined
    );
    line.receivedQuantity = Number(item.receivedQuantity ?? line.receivedQuantity);
  }

  const hasShortReceipt = [...transfer.lines.values()].some(
    (line) => line.receivedQuantity < line.dispatchedQuantity
  );
  transfer.status = hasShortReceipt ? "partial_receipt" : "received";
}

function applyRejectedEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  if (typeof payload.rejectedByUserId === "string") {
    transfer.rejectedByUserId = payload.rejectedByUserId;
  }
  if (typeof payload.reason === "string") {
    transfer.rejectionReason = payload.reason;
  }
  transfer.status = "rejected";
}

function applyCancelledEvent(
  transfer: MutableTransferSummary,
  payload: Record<string, unknown>
): void {
  if (typeof payload.cancelledByUserId === "string") {
    transfer.cancelledByUserId = payload.cancelledByUserId;
  }
  if (typeof payload.reason === "string") {
    transfer.cancellationReason = payload.reason;
  }
  transfer.status = "cancelled";
}

function finalizeTransfer(transfer: MutableTransferSummary): TransferSummary {
  return {
    ...transfer,
    lines: [...transfer.lines.values()].sort((left, right) =>
      left.transferItemId.localeCompare(right.transferItemId)
    ),
    events: [...transfer.events].sort((left, right) => {
      const createdComparison = left.createdAt.localeCompare(right.createdAt);
      if (createdComparison !== 0) {
        return createdComparison;
      }

      return left.receivedAt.localeCompare(right.receivedAt);
    })
  };
}

export function projectWarehouseDashboard(
  eventsResponse: SyncEventsResponse,
  generatedAt = new Date().toISOString()
): WarehouseDashboardState {
  const transfers = new Map<string, MutableTransferSummary>();
  const orderedEvents = [...eventsResponse.events]
    .filter((event) => event.aggregateType === "stock_transfer")
    .sort((left, right) => {
      const aggregateComparison = left.aggregateId.localeCompare(right.aggregateId);
      if (aggregateComparison !== 0) {
        return aggregateComparison;
      }

      const createdComparison = left.createdAt.localeCompare(right.createdAt);
      if (createdComparison !== 0) {
        return createdComparison;
      }

      return left.receivedAt.localeCompare(right.receivedAt);
    });

  for (const event of orderedEvents) {
    const transfer = ensureTransfer(transfers, event);

    switch (event.eventType as SyncEnvelope["eventType"]) {
      case "STOCK_TRANSFER_REQUESTED":
        applyRequestedEvent(transfer, event.payload);
        break;
      case "STOCK_TRANSFER_APPROVED":
        applyApprovedEvent(transfer, event.payload);
        break;
      case "STOCK_TRANSFER_DISPATCHED":
        applyDispatchedEvent(transfer, event.payload);
        break;
      case "STOCK_TRANSFER_RECEIVED":
        applyReceivedEvent(transfer, event.payload);
        break;
      case "STOCK_TRANSFER_REJECTED":
        applyRejectedEvent(transfer, event.payload);
        break;
      case "STOCK_TRANSFER_CANCELLED":
        applyCancelledEvent(transfer, event.payload);
        break;
      default:
        break;
    }
  }

  const projectedTransfers = [...transfers.values()]
    .map(finalizeTransfer)
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));

  return {
    generatedAt,
    totalTransfers: projectedTransfers.length,
    requestedTransfers: projectedTransfers.filter((transfer) => transfer.status === "requested").length,
    approvedTransfers: projectedTransfers.filter((transfer) => transfer.status === "approved").length,
    dispatchedTransfers: projectedTransfers.filter((transfer) => transfer.status === "dispatched").length,
    receivedTransfers: projectedTransfers.filter((transfer) => transfer.status === "received").length,
    partialReceiptTransfers: projectedTransfers.filter((transfer) => transfer.status === "partial_receipt").length,
    rejectedTransfers: projectedTransfers.filter((transfer) => transfer.status === "rejected").length,
    cancelledTransfers: projectedTransfers.filter((transfer) => transfer.status === "cancelled").length,
    transfers: projectedTransfers
  };
}
