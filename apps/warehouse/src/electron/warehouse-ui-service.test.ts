import assert from "node:assert/strict";
import test from "node:test";

import { WarehouseUiService } from "./warehouse-ui-service.ts";

test("WarehouseUiService seeds demo transfers into the receiving queue", async () => {
  const service = await WarehouseUiService.createForTest();

  try {
    const seeded = await service.seedDemoLifecycle();

    assert.ok(seeded.queue.totalTransfers > 0);
    assert.ok(seeded.dashboard.totalTransfers > 0);
    assert.equal(seeded.status?.kind, "success");
  } finally {
    await service.dispose();
  }
});

test("WarehouseUiService can receive a transfer and refresh projected state", async () => {
  const service = await WarehouseUiService.createForTest();

  try {
    const seeded = await service.seedDemoLifecycle();
    const transfer = seeded.queue.transfers[0];
    assert.ok(transfer);

    const received = await service.receiveTransfer({
      transferId: transfer.transferId,
      notes: "Warehouse shell test",
      quantitiesByTransferItemId: Object.fromEntries(
        transfer.lines.map((line) => [line.transferItemId, line.outstandingQuantity])
      )
    });

    assert.equal(received.status?.kind, "success");
    assert.match(received.status?.message ?? "", /received/i);
    assert.ok(received.dashboard.totalTransfers > 0);
  } finally {
    await service.dispose();
  }
});

test("WarehouseUiService can reject a requested transfer and refresh projected state", async () => {
  const service = await WarehouseUiService.createForTest();

  try {
    const seeded = await service.seedDemoLifecycle();
    const transfer = seeded.dashboard.transfers.find((entry) => entry.status === "requested");
    assert.ok(transfer);

    const rejected = await service.rejectTransfer({
      transferId: transfer.transferId,
      reason: "Rejected by warehouse service test"
    });

    assert.equal(rejected.status?.kind, "success");
    assert.match(rejected.status?.message ?? "", /rejected/i);
    assert.equal(
      rejected.dashboard.transfers.find((entry) => entry.transferId === transfer.transferId)?.status,
      "rejected"
    );
  } finally {
    await service.dispose();
  }
});

test("WarehouseUiService can cancel a requested transfer and refresh projected state", async () => {
  const service = await WarehouseUiService.createForTest();

  try {
    const seeded = await service.seedDemoLifecycle();
    const transfer = seeded.dashboard.transfers.find((entry) => entry.status === "approved");
    assert.ok(transfer);

    const cancelled = await service.cancelTransfer({
      transferId: transfer.transferId,
      reason: "Cancelled by warehouse service test"
    });

    assert.equal(cancelled.status?.kind, "success");
    assert.match(cancelled.status?.message ?? "", /cancelled/i);
    assert.equal(
      cancelled.dashboard.transfers.find((entry) => entry.transferId === transfer.transferId)?.status,
      "cancelled"
    );
  } finally {
    await service.dispose();
  }
});
