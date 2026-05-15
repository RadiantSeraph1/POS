import { randomUUID } from "node:crypto";

import type {
  StockTransferApprovedPayload,
  StockTransferDispatchedPayload,
  StockTransferRequestedPayload,
  SyncBatchRequest,
  SyncEnvelope
} from "../../../packages/types/src/index.ts";

import { WarehouseBackendClient } from "./backend-client.ts";

export const WAREHOUSE_DEMO_IDS = {
  organization: "11111111-1111-4111-8111-111111111111",
  branch: "22222222-2222-4222-8222-222222222222",
  warehouse: "12121212-1212-4212-8212-121212121212",
  device: "33333333-3333-4333-8333-333333333333",
  warehouseDevice: "34343434-3434-4343-8343-343434343434",
  user: "44444444-4444-4444-8444-444444444444",
  warehouseManager: "45454545-4545-4454-8454-454545454545",
  productPipe: "99999999-9999-4999-8999-999999999999",
  productElbow: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  variantOneInch: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
} as const;

export interface WorkbenchTransferScenario {
  transferId: string;
  requestNumber: string;
  transferItemPipeId: string;
  transferItemElbowId: string;
  dispatchId: string;
  requestedAt: string;
  approvedAt: string;
  dispatchedAt: string;
}

export function createScenario(now = new Date()): WorkbenchTransferScenario {
  const requestedAt = new Date(now.getTime() - 180_000).toISOString();
  const approvedAt = new Date(now.getTime() - 120_000).toISOString();
  const dispatchedAt = new Date(now.getTime() - 60_000).toISOString();

  return {
    transferId: randomUUID(),
    requestNumber: `TX-${requestedAt.slice(0, 10).replace(/-/g, "")}-${requestedAt.slice(11, 19).replace(/:/g, "")}`,
    transferItemPipeId: randomUUID(),
    transferItemElbowId: randomUUID(),
    dispatchId: randomUUID(),
    requestedAt,
    approvedAt,
    dispatchedAt
  };
}

function buildRequestedPayload(scenario: WorkbenchTransferScenario): StockTransferRequestedPayload {
  return {
    transferId: scenario.transferId,
    requestNumber: scenario.requestNumber,
    organizationId: WAREHOUSE_DEMO_IDS.organization,
    sourceType: "warehouse",
    sourceId: WAREHOUSE_DEMO_IDS.warehouse,
    destinationType: "branch",
    destinationId: WAREHOUSE_DEMO_IDS.branch,
    requestedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
    items: [
      {
        transferItemId: scenario.transferItemPipeId,
        productId: WAREHOUSE_DEMO_IDS.productPipe,
        quantity: 12
      },
      {
        transferItemId: scenario.transferItemElbowId,
        productId: WAREHOUSE_DEMO_IDS.productElbow,
        productVariantId: WAREHOUSE_DEMO_IDS.variantOneInch,
        quantity: 8
      }
    ]
  };
}

function buildApprovedPayload(scenario: WorkbenchTransferScenario): StockTransferApprovedPayload {
  return {
    transferId: scenario.transferId,
    approvedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
    approvedAt: scenario.approvedAt,
    items: [
      {
        transferItemId: scenario.transferItemPipeId,
        approvedQuantity: 10
      },
      {
        transferItemId: scenario.transferItemElbowId,
        approvedQuantity: 8
      }
    ]
  };
}

function buildDispatchedPayload(scenario: WorkbenchTransferScenario): StockTransferDispatchedPayload {
  return {
    transferId: scenario.transferId,
    dispatchId: scenario.dispatchId,
    warehouseId: WAREHOUSE_DEMO_IDS.warehouse,
    dispatchedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
    dispatchedAt: scenario.dispatchedAt,
    items: [
      {
        transferItemId: scenario.transferItemPipeId,
        dispatchedQuantity: 10
      },
      {
        transferItemId: scenario.transferItemElbowId,
        dispatchedQuantity: 8
      }
    ]
  };
}

function toEnvelope(
  eventType: SyncEnvelope["eventType"],
  aggregateId: string,
  createdAt: string,
  payload: Record<string, unknown>
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

function renderTransferTimeline(events: Array<SyncEventsResponse["events"][number]>, transferId: string): string {
  const matching = events
    .filter((event) => event.aggregateType === "stock_transfer" && event.aggregateId === transferId)
    .sort((left, right) => {
      const createdComparison = left.createdAt.localeCompare(right.createdAt);
      if (createdComparison !== 0) {
        return createdComparison;
      }

      return left.receivedAt.localeCompare(right.receivedAt);
    });

  if (matching.length === 0) {
    return "No transfer events found for the requested transfer.";
  }

  const lines = [
    `Transfer ${transferId}`,
    `Events: ${matching.length}`
  ];

  for (const event of matching) {
    lines.push(
      `- ${event.eventType} | created ${event.createdAt} | received ${event.receivedAt}`
    );
  }

  return lines.join("\n");
}

type SyncEventsResponse = Awaited<ReturnType<WarehouseBackendClient["listEvents"]>>;

export async function runWarehouseWorkbench(client: WarehouseBackendClient): Promise<void> {
  const scenario = await seedTransferLifecycle(client);
  const backendEvents = await client.listEvents();
  const timeline = renderTransferTimeline(backendEvents.events, scenario.transferId);

  console.log("PipeFlow warehouse workbench");
  console.log(`Transfer ID: ${scenario.transferId}`);
  console.log("Transfer timeline:");
  console.log(timeline);
}

export async function seedTransferLifecycle(client: WarehouseBackendClient): Promise<WorkbenchTransferScenario> {
  const scenario = createScenario();

  const envelopes: SyncEnvelope[] = [
    toEnvelope(
      "STOCK_TRANSFER_REQUESTED",
      scenario.transferId,
      scenario.requestedAt,
      buildRequestedPayload(scenario) as unknown as Record<string, unknown>
    ),
    toEnvelope(
      "STOCK_TRANSFER_APPROVED",
      scenario.transferId,
      scenario.approvedAt,
      buildApprovedPayload(scenario) as unknown as Record<string, unknown>
    ),
    toEnvelope(
      "STOCK_TRANSFER_DISPATCHED",
      scenario.transferId,
      scenario.dispatchedAt,
      buildDispatchedPayload(scenario) as unknown as Record<string, unknown>
    )
  ];

  const batch: SyncBatchRequest = {
    branchId: WAREHOUSE_DEMO_IDS.branch,
    deviceId: WAREHOUSE_DEMO_IDS.warehouseDevice,
    events: envelopes
  };

  await client.ingestEvents(batch);
  return scenario;
}
