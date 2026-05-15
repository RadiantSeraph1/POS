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
