import type { SyncBatchRequest, SyncBatchResponse } from "../../../../packages/types/src/index.ts";

function buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export interface SyncEventsResponse {
  count: number;
  events: Array<{
    branchId: string;
    deviceId: string;
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    createdAt: string;
    receivedAt: string;
    payload: Record<string, unknown>;
  }>;
}

export class WarehouseBackendClient {
  private readonly baseUrl: string;
  private readonly writeToken?: string;
  private readonly readToken?: string;

  constructor(options: { baseUrl: string; writeToken?: string; readToken?: string }) {
    this.baseUrl = options.baseUrl;
    this.writeToken = options.writeToken;
    this.readToken = options.readToken;
  }

  async ingestEvents(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    const response = await fetch(`${this.baseUrl}/sync/events`, {
      method: "POST",
      headers: buildHeaders(this.writeToken),
      body: JSON.stringify(batch)
    });

    const body = (await response.json()) as SyncBatchResponse | { error: string; details?: string };
    if (!response.ok) {
      throw new Error("error" in body ? body.error : `Unexpected sync HTTP status ${response.status}.`);
    }

    return body as SyncBatchResponse;
  }

  async listEvents(): Promise<SyncEventsResponse> {
    const response = await fetch(`${this.baseUrl}/sync/events`, {
      headers: buildHeaders(this.readToken)
    });

    const body = (await response.json()) as SyncEventsResponse | { error: string; details?: string };
    if (!response.ok) {
      throw new Error("error" in body ? body.error : `Unexpected sync HTTP status ${response.status}.`);
    }

    return body as SyncEventsResponse;
  }
}

