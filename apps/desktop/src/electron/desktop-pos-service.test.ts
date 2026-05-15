import assert from "node:assert/strict";
import test from "node:test";

import { DesktopPosService } from "./desktop-pos-service.ts";

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
