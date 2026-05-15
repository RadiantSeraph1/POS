import assert from "node:assert/strict";
import test from "node:test";

import { addCartLine, createCartState, summarizeCart } from "./cart.ts";

const baseLine = {
  productId: "product-1",
  name: "PVC Pipe",
  quantity: 1,
  unitPriceMinor: 50000,
  discountMinor: 0,
  taxMinor: 0
};

test("summarizeCart derives subtotal discount and total", () => {
  const cart = addCartLine(
    addCartLine(createCartState(), baseLine),
    {
      productId: "product-2",
      productVariantId: "variant-1",
      name: "Elbow Joint 1 Inch",
      quantity: 2,
      unitPriceMinor: 6250,
      discountMinor: 500,
      taxMinor: 0
    }
  );

  const summary = summarizeCart(cart);

  assert.equal(summary.subtotalMinor, 62500);
  assert.equal(summary.discountMinor, 500);
  assert.equal(summary.totalMinor, 62000);
  assert.equal(summary.totalItemCount, 3);
});

test("addCartLine aggregates repeated additions for the same stock line", () => {
  const cart = addCartLine(
    addCartLine(createCartState(), baseLine),
    {
      ...baseLine,
      quantity: 2
    }
  );

  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0]?.quantity, 3);
});
