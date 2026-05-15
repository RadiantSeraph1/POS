# Warehouse Receiving-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a receiving-first warehouse flow that derives actionable inbound transfers from backend events, submits validated `STOCK_TRANSFER_RECEIVED` events, and re-renders updated projected transfer state.

**Architecture:** Reuse the existing event-ingestion backend and warehouse projector as the source of truth. Add three focused warehouse modules: one to derive receiving queue state, one to build and submit validated receiving payloads, and one to render the receiving queue. Wire them into the existing warehouse demo so the app demonstrates a scripted receiving workflow end-to-end.

**Tech Stack:** Node.js TypeScript executed directly, existing backend HTTP client, existing transfer event projector, Node test runner

---

### Task 1: Add receiving-model tests first

**Files:**
- Create: `apps/warehouse/src/receiving-model.test.ts`
- Create: `apps/warehouse/src/receiving-model.ts`
- Modify: `apps/warehouse/src/models.ts`

- [ ] **Step 1: Write the failing receiving-model tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { deriveReceivingQueue } from "./receiving-model.ts";
import type { WarehouseDashboardState } from "./models.ts";

const dashboard: WarehouseDashboardState = {
  generatedAt: "2026-05-15T09:00:00.000Z",
  totalTransfers: 3,
  requestedTransfers: 0,
  approvedTransfers: 0,
  dispatchedTransfers: 1,
  receivedTransfers: 1,
  partialReceiptTransfers: 1,
  transfers: [
    {
      transferId: "transfer-dispatched",
      requestNumber: "TX-1",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "dispatched",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:10:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-1",
          productId: "product-1",
          requestedQuantity: 12,
          approvedQuantity: 10,
          dispatchedQuantity: 10,
          receivedQuantity: 0
        }
      ]
    },
    {
      transferId: "transfer-partial",
      requestNumber: "TX-2",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "partial_receipt",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:11:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-2",
          productId: "product-2",
          requestedQuantity: 8,
          approvedQuantity: 8,
          dispatchedQuantity: 8,
          receivedQuantity: 5
        }
      ]
    },
    {
      transferId: "transfer-received",
      requestNumber: "TX-3",
      organizationId: "org-1",
      sourceType: "warehouse",
      sourceId: "wh-1",
      destinationType: "branch",
      destinationId: "branch-1",
      requestedByUserId: "user-1",
      status: "received",
      createdAt: "2026-05-15T09:00:00.000Z",
      lastUpdatedAt: "2026-05-15T09:12:00.000Z",
      events: [],
      lines: [
        {
          transferItemId: "line-3",
          productId: "product-3",
          requestedQuantity: 4,
          approvedQuantity: 4,
          dispatchedQuantity: 4,
          receivedQuantity: 4
        }
      ]
    }
  ]
};

test("deriveReceivingQueue returns only actionable inbound transfers", () => {
  const queue = deriveReceivingQueue(dashboard);

  assert.equal(queue.totalTransfers, 2);
  assert.deepEqual(
    queue.transfers.map((transfer) => transfer.transferId),
    ["transfer-partial", "transfer-dispatched"]
  );
});

test("deriveReceivingQueue computes outstanding receiving quantities per line", () => {
  const queue = deriveReceivingQueue(dashboard);
  const partialTransfer = queue.transfers.find((transfer) => transfer.transferId === "transfer-partial");

  assert.ok(partialTransfer);
  assert.equal(partialTransfer.totalOutstandingQuantity, 3);
  assert.equal(partialTransfer.lines[0]?.outstandingQuantity, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-model.test.ts"`
Expected: FAIL with module or export not found for `deriveReceivingQueue`

- [ ] **Step 3: Write minimal receiving-model types and implementation**

```ts
import type { TransferSummary, WarehouseDashboardState } from "./models.ts";

export interface ReceivingLineSummary {
  transferItemId: string;
  productId: string;
  productVariantId?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  outstandingQuantity: number;
}

export interface ReceivingTransferSummary {
  transferId: string;
  requestNumber: string;
  sourceType: string;
  sourceId: string;
  destinationType: string;
  destinationId: string;
  status: "dispatched" | "partial_receipt";
  totalOutstandingQuantity: number;
  lines: ReceivingLineSummary[];
  lastUpdatedAt: string;
}

export interface ReceivingQueue {
  generatedAt: string;
  totalTransfers: number;
  transfers: ReceivingTransferSummary[];
}

function toReceivingTransfer(transfer: TransferSummary): ReceivingTransferSummary {
  const lines = transfer.lines.map((line) => ({
    transferItemId: line.transferItemId,
    productId: line.productId,
    ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
    requestedQuantity: line.requestedQuantity,
    approvedQuantity: line.approvedQuantity,
    dispatchedQuantity: line.dispatchedQuantity,
    receivedQuantity: line.receivedQuantity,
    outstandingQuantity: Math.max(0, line.dispatchedQuantity - line.receivedQuantity)
  }));

  return {
    transferId: transfer.transferId,
    requestNumber: transfer.requestNumber,
    sourceType: transfer.sourceType,
    sourceId: transfer.sourceId,
    destinationType: transfer.destinationType,
    destinationId: transfer.destinationId,
    status: transfer.status,
    totalOutstandingQuantity: lines.reduce((sum, line) => sum + line.outstandingQuantity, 0),
    lines,
    lastUpdatedAt: transfer.lastUpdatedAt
  };
}

export function deriveReceivingQueue(dashboard: WarehouseDashboardState): ReceivingQueue {
  const transfers = dashboard.transfers
    .filter((transfer) => transfer.status === "dispatched" || transfer.status === "partial_receipt")
    .map(toReceivingTransfer)
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));

  return {
    generatedAt: dashboard.generatedAt,
    totalTransfers: transfers.length,
    transfers
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-model.test.ts"`
Expected: PASS

### Task 2: Add receiving-actions tests first

**Files:**
- Create: `apps/warehouse/src/receiving-actions.test.ts`
- Create: `apps/warehouse/src/receiving-actions.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write the failing receiving-actions tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildReceiveTransferInput, buildReceiveTransferPayload } from "./receiving-actions.ts";
import type { ReceivingTransferSummary } from "./receiving-model.ts";

const transfer: ReceivingTransferSummary = {
  transferId: "transfer-1",
  requestNumber: "TX-1",
  sourceType: "warehouse",
  sourceId: "wh-1",
  destinationType: "branch",
  destinationId: "branch-1",
  status: "dispatched",
  totalOutstandingQuantity: 13,
  lastUpdatedAt: "2026-05-15T10:00:00.000Z",
  lines: [
    {
      transferItemId: "line-1",
      productId: "product-1",
      requestedQuantity: 12,
      approvedQuantity: 10,
      dispatchedQuantity: 10,
      receivedQuantity: 0,
      outstandingQuantity: 10
    },
    {
      transferItemId: "line-2",
      productId: "product-2",
      productVariantId: "variant-1",
      requestedQuantity: 8,
      approvedQuantity: 8,
      dispatchedQuantity: 8,
      receivedQuantity: 5,
      outstandingQuantity: 3
    }
  ]
};

test("buildReceiveTransferPayload returns receive lines for submitted quantities", () => {
  const input = buildReceiveTransferInput(transfer, {
    receiptId: "receipt-1",
    organizationId: "org-1",
    branchId: "branch-1",
    receivedByUserId: "user-1",
    receivedAt: "2026-05-15T10:05:00.000Z",
    notes: "Short pipe receipt",
    quantitiesByTransferItemId: {
      "line-1": 9,
      "line-2": 3
    }
  });

  const payload = buildReceiveTransferPayload(input);
  assert.equal(payload.transferId, "transfer-1");
  assert.equal(payload.items.length, 2);
  assert.deepEqual(payload.items[0], {
    transferItemId: "line-1",
    productId: "product-1",
    receivedQuantity: 9
  });
});

test("buildReceiveTransferPayload rejects over-receipt quantities", () => {
  assert.throws(
    () =>
      buildReceiveTransferPayload(
        buildReceiveTransferInput(transfer, {
          receiptId: "receipt-1",
          organizationId: "org-1",
          branchId: "branch-1",
          receivedByUserId: "user-1",
          receivedAt: "2026-05-15T10:05:00.000Z",
          quantitiesByTransferItemId: {
            "line-1": 11
          }
        })
      ),
    /exceeds remaining dispatched quantity/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-actions.test.ts"`
Expected: FAIL with module or export not found for receiving actions

- [ ] **Step 3: Write minimal payload-building implementation**

```ts
import type { StockTransferReceivedPayload } from "../../../../packages/types/src/index.ts";
import type { ReceivingTransferSummary } from "./receiving-model.ts";

export interface ReceiveTransferDraft {
  transfer: ReceivingTransferSummary;
  receiptId: string;
  organizationId: string;
  branchId: string;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-actions.test.ts"`
Expected: PASS

### Task 3: Render the receiving queue

**Files:**
- Create: `apps/warehouse/src/receiving-renderer.ts`
- Modify: `apps/warehouse/src/dashboard.ts`

- [ ] **Step 1: Add receiving renderer**

```ts
import type { ReceivingQueue, ReceivingTransferSummary } from "./receiving-model.ts";

function renderTransfer(transfer: ReceivingTransferSummary): string {
  const lines = [
    `Transfer ${transfer.requestNumber} (${transfer.transferId})`,
    `Route: ${transfer.sourceType}:${transfer.sourceId} -> ${transfer.destinationType}:${transfer.destinationId}`,
    `Status: ${transfer.status} | Outstanding: ${transfer.totalOutstandingQuantity}`
  ];

  for (const line of transfer.lines) {
    lines.push(
      `- ${line.transferItemId} | product ${line.productId} | dispatched ${line.dispatchedQuantity} | received ${line.receivedQuantity} | outstanding ${line.outstandingQuantity}`
    );
  }

  return lines.join("\\n");
}

export function renderReceivingQueue(queue: ReceivingQueue): string {
  const lines = [
    "PipeFlow warehouse receiving queue",
    `Generated: ${queue.generatedAt}`,
    `Transfers ready to receive: ${queue.totalTransfers}`
  ];

  if (queue.transfers.length === 0) {
    lines.push("No inbound transfers are currently ready to receive.");
    return lines.join("\\n");
  }

  for (const transfer of queue.transfers) {
    lines.push(renderTransfer(transfer));
  }

  return lines.join("\\n");
}
```

- [ ] **Step 2: Run targeted test and smoke-check imports**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-model.test.ts" "apps/warehouse/src/receiving-actions.test.ts"`
Expected: PASS

### Task 4: Wire the receiving-first flow into the warehouse app

**Files:**
- Modify: `apps/warehouse/src/workbench.ts`
- Modify: `apps/warehouse/src/main.ts`
- Modify: `apps/warehouse/src/dashboard.ts`
- Modify: `apps/warehouse/src/README.md`

- [ ] **Step 1: Split workbench scenario generation from receipt submission**

```ts
export interface WorkbenchScenarioResult {
  transferId: string;
  requestNumber: string;
}

export async function seedTransferLifecycle(client: WarehouseBackendClient): Promise<WorkbenchScenarioResult> {
  // keep requested, approved, dispatched generation
  // remove immediate received event from the initial batch
}
```

- [ ] **Step 2: Add a scripted receiving flow using new receiving modules**

```ts
import { randomUUID } from "node:crypto";

import { buildReceiveTransferInput, buildReceiveTransferPayload } from "./receiving-actions.ts";
import { deriveReceivingQueue } from "./receiving-model.ts";
import { renderReceivingQueue } from "./receiving-renderer.ts";

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

  const quantitiesByTransferItemId = Object.fromEntries(
    selectedTransfer.lines.map((line) => [
      line.transferItemId,
      line.transferItemId === selectedTransfer.lines[0]?.transferItemId
        ? Math.max(0, line.outstandingQuantity - 1)
        : line.outstandingQuantity
    ])
  );

  const payload = buildReceiveTransferPayload(
    buildReceiveTransferInput(selectedTransfer, {
      receiptId: randomUUID(),
      organizationId: beforeDashboard.transfers[0]?.organizationId ?? "11111111-1111-4111-8111-111111111111",
      branchId: selectedTransfer.destinationId,
      receivedByUserId: "44444444-4444-4444-8444-444444444444",
      receivedAt: new Date().toISOString(),
      notes: "Receiving-first workflow demo",
      quantitiesByTransferItemId
    })
  );

  await client.ingestEvents({
    branchId: selectedTransfer.destinationId,
    deviceId: "34343434-3434-4343-8343-343434343434",
    events: [
      {
        eventId: randomUUID(),
        eventType: "STOCK_TRANSFER_RECEIVED",
        aggregateType: "stock_transfer",
        aggregateId: selectedTransfer.transferId,
        createdAt: payload.receivedAt,
        payload: payload as unknown as Record<string, unknown>
      }
    ]
  });

  const afterEvents = await client.listEvents();
  const afterDashboard = projectWarehouseDashboard(afterEvents);
  console.log(renderReceivingQueue(deriveReceivingQueue(afterDashboard)));
}
```

- [ ] **Step 3: Update main entrypoint and README**

Run the receiving-first flow from `main.ts` and document:

```md
- the app now seeds request/approve/dispatch and then performs receiving separately
- the app prints queue state before and after receipt submission
- partial receipt remains visible as actionable work
```

- [ ] **Step 4: Run the warehouse app end-to-end**

Run: `node apps/warehouse/src/main.ts`
Expected:
- request/approve/dispatch events are ingested
- receiving queue prints at least one actionable transfer
- one `STOCK_TRANSFER_RECEIVED` event is submitted
- final output shows updated transfer state

### Task 5: Final verification

**Files:**
- Modify: `docs/NEXT_STEPS.md`

- [ ] **Step 1: Run all warehouse receiving tests**

Run: `node --test --test-isolation=none "apps/warehouse/src/receiving-model.test.ts" "apps/warehouse/src/receiving-actions.test.ts"`
Expected: PASS

- [ ] **Step 2: Re-run full warehouse flow**

Run: `node apps/warehouse/src/main.ts`
Expected: PASS with receiving queue before and after receipt submission

- [ ] **Step 3: Update next-steps documentation**

Add the new current state:

```md
- warehouse app now has a receiving-first UI layer
- it derives actionable inbound transfers from projected backend events
- it submits validated receive events and re-renders projected state
```
