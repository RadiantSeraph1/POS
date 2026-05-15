import assert from "node:assert/strict";
import test from "node:test";

import { filterSellableCatalog, type PosCatalogItem } from "./catalog.ts";

const sampleCatalog: PosCatalogItem[] = [
  {
    productId: "product-pvc",
    sku: "SKU-PVC-001",
    name: "PVC Pipe",
    sellableQuantity: 20
  },
  {
    productId: "product-elbow",
    productVariantId: "variant-1in",
    sku: "1IN",
    name: "Elbow Joint 1 Inch",
    sellableQuantity: 50
  }
];

test("filterSellableCatalog returns all items for an empty query", () => {
  const result = filterSellableCatalog(sampleCatalog, "");

  assert.equal(result.length, 2);
});

test("filterSellableCatalog matches by product name and sku", () => {
  assert.deepEqual(filterSellableCatalog(sampleCatalog, "pvc").map((item) => item.productId), [
    "product-pvc"
  ]);

  assert.deepEqual(filterSellableCatalog(sampleCatalog, "1in").map((item) => item.productId), [
    "product-elbow"
  ]);
});
