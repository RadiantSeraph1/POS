import { randomUUID } from "node:crypto";

import { WarehouseBackendClient } from "./backend-client.ts";
import {
  buildReceiveTransferInput,
  submitReceiveTransfer
} from "./receiving-actions.ts";
import { deriveReceivingQueue } from "./receiving-model.ts";
import { renderReceivingQueue } from "./receiving-renderer.ts";
import { projectWarehouseDashboard } from "./projector.ts";
import { renderWarehouseDashboard } from "./renderer.ts";
import { WAREHOUSE_DEMO_IDS, seedTransferLifecycle } from "./workbench.ts";

export async function runWarehouseDashboard(client: WarehouseBackendClient): Promise<void> {
  const backendEvents = await client.listEvents();
  const dashboard = projectWarehouseDashboard(backendEvents);

  console.log(renderWarehouseDashboard(dashboard));
}

export async function runWarehouseReceivingFlow(client: WarehouseBackendClient): Promise<void> {
  await seedTransferLifecycle(client);

  const beforeEvents = await client.listEvents();
  const beforeDashboard = projectWarehouseDashboard(beforeEvents);
  const queue = deriveReceivingQueue(beforeDashboard);

  console.log(renderReceivingQueue(queue));

  const selectedTransfer = queue.transfers[0];
  if (!selectedTransfer) {
    throw new Error("No inbound transfer is available for receiving.");
  }

  const partialLine = [...selectedTransfer.lines].sort(
    (left, right) => right.outstandingQuantity - left.outstandingQuantity
  )[0];
  const quantitiesByTransferItemId = Object.fromEntries(
    selectedTransfer.lines.map((line) => [
      line.transferItemId,
      line.transferItemId === partialLine?.transferItemId
        ? Math.max(0, line.outstandingQuantity - 1)
        : line.outstandingQuantity
    ])
  );
  const receivedAt = new Date(Date.parse(selectedTransfer.lastUpdatedAt) + 60_000).toISOString();

  const result = await submitReceiveTransfer(
    client,
    buildReceiveTransferInput(selectedTransfer, {
      receiptId: randomUUID(),
      organizationId: WAREHOUSE_DEMO_IDS.organization,
      branchId: WAREHOUSE_DEMO_IDS.branch,
      deviceId: WAREHOUSE_DEMO_IDS.device,
      receivedByUserId: WAREHOUSE_DEMO_IDS.user,
      receivedAt,
      notes: "Receiving-first workflow demo",
      quantitiesByTransferItemId
    })
  );

  console.log("Receive submission result:");
  console.log(JSON.stringify(result, null, 2));

  const afterEvents = await client.listEvents();
  const afterDashboard = projectWarehouseDashboard(afterEvents);
  const afterQueue = deriveReceivingQueue(afterDashboard);

  console.log(renderReceivingQueue(afterQueue));
  console.log(renderWarehouseDashboard(afterDashboard));
}
