import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { DesktopPosService } from "./desktop-pos-service.ts";
import { SelectiveFailingSyncTransport, SyncQueueProcessor } from "../sync/queue-processor.ts";

test("DesktopPosService returns a populated initial snapshot", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();

    assert.ok(snapshot.catalog.length >= 2);
    assert.equal(snapshot.cart.lines.length, 0);
    assert.equal(snapshot.sync.pending, 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService adds a catalog item to cart and updates totals", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    const updated = await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    assert.equal(updated.cart.lines.length, 1);
    assert.ok(updated.cart.summary.totalMinor > 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService can clear the current cart", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const cleared = await service.clearCart();

    assert.equal(cleared.cart.lines.length, 0);
    assert.equal(cleared.cart.summary.totalMinor, 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService reports a success status after submitSale", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const submitted = await service.submitSale();

    assert.equal(submitted.status?.kind, "success");
    assert.match(submitted.status?.message ?? "", /sale submitted/i);
    assert.ok(submitted.lastSubmitResult?.saleId);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService reports a sync status after processSyncQueue", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });
    await service.submitSale();

    const processed = await service.processSyncQueue();

    assert.equal(processed.status?.kind, "success");
    assert.match(processed.status?.message ?? "", /sync processed/i);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService exposes recent sales with sync status after submit and sync", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const submitted = await service.submitSale();
    assert.equal(submitted.recovery.recentSales.length, 1);
    assert.equal(submitted.recovery.recentSales[0]?.syncStatus, "pending");

    const processed = await service.processSyncQueue();
    assert.equal(processed.recovery.recentSales.length, 1);
    const recentSale = processed.recovery.recentSales[0];
    assert.equal(recentSale?.syncStatus, "synced");
    assert.equal(recentSale?.saleNumber, submitted.lastSubmitResult?.saleNumber);
    assert.equal(recentSale?.itemCount, 1);
    assert.match(recentSale?.items[0]?.name ?? "", /Elbow Joint/);
    assert.ok((recentSale?.payments.length ?? 0) > 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService exposes shift summary counts for sales, attention, and drafts", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const first = snapshot.catalog[0];
    const second = snapshot.catalog[1];
    assert.ok(first);
    assert.ok(second);

    await service.addCatalogItem({
      productId: first.productId,
      ...(first.productVariantId ? { productVariantId: first.productVariantId } : {})
    });
    const suspended = await service.suspendCurrentSale("Hold draft");
    assert.equal(suspended.reporting.shift.suspendedDraftCount, 1);
    assert.equal(suspended.reporting.shift.salesCount, 0);

    await service.resumeSuspendedSale(suspended.suspendedSales[0]!.id);
    await service.submitSale();
    await service.clearCart();

    await service.addCatalogItem({
      productId: second.productId,
      ...(second.productVariantId ? { productVariantId: second.productVariantId } : {})
    });
    const secondSubmitted = await service.submitSale();
    const secondEventId = secondSubmitted.lastSubmitResult?.eventId;
    assert.ok(secondEventId);

    const internal = service as unknown as {
      db: ConstructorParameters<typeof SyncQueueProcessor>[0];
      queueProcessor: SyncQueueProcessor;
    };
    internal.queueProcessor = new SyncQueueProcessor(
      internal.db,
      new SelectiveFailingSyncTransport([secondEventId])
    );

    await service.processSyncQueue();
    const summary = await service.loadSnapshot();

    assert.equal(summary.reporting.shift.salesCount, 2);
    assert.ok(summary.reporting.shift.grossTotalMinor > 0);
    assert.equal(summary.reporting.shift.syncedSalesCount, 1);
    assert.equal(summary.reporting.shift.attentionSalesCount, 1);
    assert.equal(summary.reporting.shift.deadLetterSalesCount, 0);
    assert.equal(summary.reporting.shift.suspendedDraftCount, 0);
    assert.equal(summary.reporting.shift.readyToClose, false);
    assert.ok(summary.reporting.shift.blockers.some((blocker) => blocker.includes("unsynced or failed")));
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService marks shift close as blocked by open cart lines", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const updated = await service.loadSnapshot();
    assert.equal(updated.reporting.shift.openCartLineCount, 1);
    assert.equal(updated.reporting.shift.readyToClose, false);
    assert.ok(updated.reporting.shift.blockers.some((blocker) => blocker.includes("open cart line")));
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService exposes failed queue items in recovery state", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const submitted = await service.submitSale();
    const eventId = submitted.lastSubmitResult?.eventId;
    assert.ok(eventId);

    const internal = service as unknown as {
      db: ConstructorParameters<typeof SyncQueueProcessor>[0];
      queueProcessor: SyncQueueProcessor;
    };
    internal.queueProcessor = new SyncQueueProcessor(
      internal.db,
      new SelectiveFailingSyncTransport([eventId])
    );

    const processed = await service.processSyncQueue();
    assert.equal(processed.sync.failed, 1);
    assert.equal(processed.recovery.queue.length, 1);
    assert.equal(processed.recovery.queue[0]?.status, "failed");
    assert.match(processed.recovery.queue[0]?.lastError ?? "", /simulated transport failure/i);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService can retry one failed queue item", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const submitted = await service.submitSale();
    const eventId = submitted.lastSubmitResult?.eventId;
    assert.ok(eventId);

    const internal = service as unknown as {
      db: ConstructorParameters<typeof SyncQueueProcessor>[0];
      queueProcessor: SyncQueueProcessor;
    };
    internal.queueProcessor = new SyncQueueProcessor(
      internal.db,
      new SelectiveFailingSyncTransport([eventId])
    );

    const failed = await service.processSyncQueue();
    const queueItem = failed.recovery.queue[0];
    assert.ok(queueItem);
    assert.equal(queueItem.status, "failed");

    const retried = await service.retryQueueItem(queueItem.id);
    assert.equal(retried.sync.pending, 1);
    assert.equal(retried.sync.failed, 0);
    assert.equal(retried.recovery.queue[0]?.status, "pending");
    assert.equal(retried.recovery.queue[0]?.retryCount, 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService can retry all recoverable queue items", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const first = snapshot.catalog[0];
    assert.ok(first);

    await service.addCatalogItem({
      productId: first.productId,
      ...(first.productVariantId ? { productVariantId: first.productVariantId } : {})
    });
    const firstSubmitted = await service.submitSale();
    const firstEventId = firstSubmitted.lastSubmitResult?.eventId;
    assert.ok(firstEventId);

    const internal = service as unknown as {
      db: ConstructorParameters<typeof SyncQueueProcessor>[0];
    };
    const secondEventId = randomUUID();
    const secondQueueId = randomUUID();
    const secondSaleId = randomUUID();
    internal.db.execute(
      `
        INSERT INTO inventory_events (
          id, organization_id, branch_id, aggregate_type, aggregate_id, event_type,
          actor_user_id, device_id, quantity_delta, payload_json, local_created_at, event_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        secondEventId,
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "sale",
        secondSaleId,
        "SALE_CREATED",
        "44444444-4444-4444-8444-444444444444",
        "33333333-3333-4333-8333-333333333333",
        -1,
        JSON.stringify({ saleId: secondSaleId }),
        "2026-05-18T10:00:00.000Z",
        1
      ]
    );
    internal.db.execute(
      `
        INSERT INTO sync_queue (
          id, event_id, event_type, aggregate_type, aggregate_id, payload_json, status,
          retry_count, last_error, next_retry_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'dead_letter', 3, 'Seeded test failure', ?, ?, ?)
      `,
      [
        secondQueueId,
        secondEventId,
        "SALE_CREATED",
        "sale",
        secondSaleId,
        JSON.stringify({ saleId: secondSaleId }),
        "2026-05-18T10:00:08.000Z",
        "2026-05-18T10:00:00.000Z",
        "2026-05-18T10:00:08.000Z"
      ]
    );
    internal.db.execute(
      `
        UPDATE sync_queue
        SET status = 'dead_letter',
            retry_count = 3,
            last_error = 'Seeded test failure',
            next_retry_at = '2026-05-18T10:00:08.000Z',
            updated_at = '2026-05-18T10:00:08.000Z'
        WHERE event_id IN (?, ?)
      `,
      [firstEventId, secondEventId]
    );

    const beforeRetry = await service.loadSnapshot();
    assert.equal(beforeRetry.sync.deadLetter, 2);

    const retried = await service.retryAllQueueItems();
    assert.equal(retried.sync.pending, 2);
    assert.equal(retried.sync.failed, 0);
    assert.equal(retried.sync.deadLetter, 0);
    assert.ok(retried.recovery.queue.every((item) => item.status === "pending"));
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService can suspend and resume the current sale draft", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const suspended = await service.suspendCurrentSale("Counter hold");

    assert.equal(suspended.cart.lines.length, 0);
    assert.equal(suspended.suspendedSales.length, 1);
    assert.equal(suspended.suspendedSales[0]?.label, "Counter hold");

    const resumed = await service.resumeSuspendedSale(suspended.suspendedSales[0]!.id);

    assert.equal(resumed.cart.lines.length, 1);
    assert.equal(resumed.suspendedSales.length, 0);
    assert.equal(resumed.cart.lines[0]?.productId, product.productId);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService can delete a suspended sale draft", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    await service.addCatalogItem({
      productId: product.productId,
      ...(product.productVariantId ? { productVariantId: product.productVariantId } : {})
    });

    const suspended = await service.suspendCurrentSale("Delete me");
    const deleted = await service.deleteSuspendedSale(suspended.suspendedSales[0]!.id);

    assert.equal(deleted.suspendedSales.length, 0);
    assert.equal(deleted.status?.kind, "info");
    assert.match(deleted.status?.message ?? "", /deleted/i);
  } finally {
    await service.dispose();
  }
});
