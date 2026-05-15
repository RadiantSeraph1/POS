import type {
  SyncBatchRequest,
  SyncBatchResponse,
  SyncEnvelope,
  SyncEventAcknowledgement
} from "../../../../packages/types/src/index.ts";

import {
  buildStoredEvent,
  createAcceptedAcknowledgement,
  createDuplicateAcknowledgement,
  createRejectedAcknowledgement,
  type SyncEventRepository
} from "./repository.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateEnvelope(envelope: SyncEnvelope): string | null {
  if (!envelope.eventId) {
    return "Missing eventId.";
  }

  if (!envelope.eventType) {
    return "Missing eventType.";
  }

  if (!envelope.aggregateType) {
    return "Missing aggregateType.";
  }

  if (!envelope.aggregateId) {
    return "Missing aggregateId.";
  }

  if (!isObject(envelope.payload)) {
    return "Payload must be an object.";
  }

  return null;
}

function validateBatchRequest(body: unknown): body is SyncBatchRequest {
  if (!isObject(body)) {
    return false;
  }

  if (typeof body.branchId !== "string" || typeof body.deviceId !== "string") {
    return false;
  }

  if (!Array.isArray(body.events)) {
    return false;
  }

  return true;
}

export class SyncIngestionService {
  private readonly repository: SyncEventRepository;

  constructor(repository: SyncEventRepository) {
    this.repository = repository;
  }

  async ingestBatch(body: unknown, now = new Date()): Promise<SyncBatchResponse> {
    if (!validateBatchRequest(body)) {
      throw new Error("Invalid sync batch payload.");
    }

    const acknowledgedAt = now.toISOString();
    const results: SyncEventAcknowledgement[] = [];

    for (const event of body.events) {
      const error = validateEnvelope(event);
      if (error) {
        results.push(createRejectedAcknowledgement(event?.eventId ?? "unknown", acknowledgedAt, error));
        continue;
      }

      const alreadyExists = await this.repository.has(event.eventId);
      if (alreadyExists) {
        results.push(createDuplicateAcknowledgement(event.eventId, acknowledgedAt));
        continue;
      }

      await this.repository.save(buildStoredEvent(body, event, acknowledgedAt));
      results.push(createAcceptedAcknowledgement(event.eventId, acknowledgedAt));
    }

    const accepted = results.filter((result) => result.status === "accepted").length;
    const duplicates = results.filter((result) => result.status === "duplicate").length;
    const rejected = results.filter((result) => result.status === "rejected").length;

    return {
      received: body.events.length,
      accepted,
      duplicates,
      rejected,
      results
    };
  }

  async listEvents(): Promise<StoredSyncEventView[]> {
    const storedEvents = await this.repository.list();

    return storedEvents.map((event) => ({
      branchId: event.branchId,
      deviceId: event.deviceId,
      eventId: event.envelope.eventId,
      eventType: event.envelope.eventType,
      aggregateType: event.envelope.aggregateType,
      aggregateId: event.envelope.aggregateId,
      createdAt: event.envelope.createdAt,
      receivedAt: event.receivedAt,
      payload: event.envelope.payload
    }));
  }
}

export interface StoredSyncEventView {
  branchId: string;
  deviceId: string;
  eventId: string;
  eventType: SyncEnvelope["eventType"];
  aggregateType: SyncEnvelope["aggregateType"];
  aggregateId: string;
  createdAt: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}
