import assert from "node:assert/strict";
import test from "node:test";

import { addCartLine, createCartState } from "./cart.ts";
import { assertValidCheckout, buildSplitPayments, createCheckoutPayments } from "./checkout.ts";

test("assertValidCheckout rejects empty carts", () => {
  assert.throws(
    () =>
      assertValidCheckout(createCartState(), [
        { method: "cash", amountMinor: 1000, status: "completed", paidAt: "2026-05-15T12:00:00.000Z" }
      ]),
    /cart/i
  );
});

test("assertValidCheckout rejects payment mismatch", () => {
  const cart = addCartLine(createCartState(), {
    productId: "product-1",
    name: "PVC Pipe",
    quantity: 1,
    unitPriceMinor: 50000,
    discountMinor: 0,
    taxMinor: 0
  });

  assert.throws(
    () =>
      assertValidCheckout(cart, [
        { method: "cash", amountMinor: 1000, status: "completed", paidAt: "2026-05-15T12:00:00.000Z" }
      ]),
    /payment total/i
  );
});

test("createCheckoutPayments preserves split payments", () => {
  const payments = createCheckoutPayments([
    {
      paymentId: "payment-1",
      method: "cash",
      amountMinor: 80000,
      status: "completed",
      paidAt: "2026-05-15T12:00:00.000Z"
    },
    {
      paymentId: "payment-2",
      method: "mobile_money",
      amountMinor: 40000,
      providerCode: "mtn_momo",
      externalReference: "MM-REF-1",
      status: "completed",
      paidAt: "2026-05-15T12:00:01.000Z"
    }
  ]);

  assert.equal(payments.length, 2);
  assert.equal(payments[1]?.providerCode, "mtn_momo");
});

test("buildSplitPayments creates editable cash and mobile money lines", () => {
  const payments = buildSplitPayments({
    cashAmountMinor: 1500,
    mobileMoneyAmountMinor: 3500,
    paidAt: "2026-05-15T12:00:00.000Z"
  });

  assert.deepEqual(
    payments.map((payment) => ({
      method: payment.method,
      amountMinor: payment.amountMinor
    })),
    [
      { method: "cash", amountMinor: 1500 },
      { method: "mobile_money", amountMinor: 3500 }
    ]
  );
  assert.equal(payments[1]?.providerCode, "mtn_momo");
});
