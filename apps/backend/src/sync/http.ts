import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { SyncBatchResponse } from "../../../../packages/types/src/index.ts";
import {
  ForbiddenError,
  authenticateRequest,
  requireRoles,
  type BackendAuthConfig
} from "../auth.ts";

import { SyncIngestionService } from "./service.ts";
import type { SaleReplayWorkerStatus } from "./replay-worker.ts";

export interface BackendHttpServerOptions {
  auth?: BackendAuthConfig;
  replayWorker?: {
    getStatus(): SaleReplayWorkerStatus;
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body, null, 2));
}

function normalizeError(
  error: unknown
): { message: string; details?: string; statusCode: number } {
  if (error instanceof ForbiddenError) {
    return {
      message: error.message,
      statusCode: 403
    };
  }

  if (error instanceof Error && error.name === "UnauthorizedError") {
    return {
      message: error.message,
      statusCode: 401
    };
  }

  if (error instanceof Error) {
    const details =
      typeof (error as Error & { cause?: unknown }).cause === "string"
        ? (error as Error & { cause?: string }).cause
        : undefined;

    const normalized: { message: string; details?: string } = {
      message: error.message || "Unknown server error."
    };

    if (details) {
      normalized.details = details;
    }

    return {
      ...normalized,
      statusCode: 400
    };
  }

  return {
    message: String(error),
    statusCode: 400
  };
}

export function createBackendHttpServer(
  syncService: SyncIngestionService,
  options: BackendHttpServerOptions = {}
) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "pipeflow-backend",
          timestamp: new Date().toISOString()
        });
        return;
      }

      const authConfig = options.auth ?? {
        enabled: false,
        identities: new Map()
      };
      const authenticatedRequest = authenticateRequest(request, authConfig);

      if (request.method === "POST" && request.url === "/sync/events") {
        requireRoles(authenticatedRequest, authConfig, ["sync_ingest"]);
        const body = await readJsonBody(request);
        const result: SyncBatchResponse = await syncService.ingestBatch(body);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && request.url === "/sync/events") {
        requireRoles(authenticatedRequest, authConfig, ["sync_read"]);
        const result = await syncService.listEvents();
        sendJson(response, 200, {
          count: result.length,
          events: result
        });
        return;
      }

      if (request.method === "GET" && request.url === "/sync/health") {
        requireRoles(authenticatedRequest, authConfig, ["sync_read"]);
        sendJson(response, 200, {
          status: "ok",
          replayWorker: options.replayWorker?.getStatus() ?? {
            enabled: false,
            running: false,
            inFlight: false,
            intervalMs: 0,
            limit: 0,
            runs: 0,
            failures: 0
          }
        });
        return;
      }

      sendJson(response, 404, {
        error: "Not found"
      });
    } catch (error) {
      const normalized = normalizeError(error);
      sendJson(response, normalized.statusCode, {
        error: normalized.message,
        details: normalized.details
      });
    }
  });
}
