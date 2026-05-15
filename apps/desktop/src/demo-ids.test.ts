import assert from "node:assert/strict";
import test from "node:test";

import { createDemoIds } from "./demo-ids.ts";

test("keeps shared reference ids stable while generating unique sale runtime ids", () => {
  const first = createDemoIds();
  const second = createDemoIds();

  assert.equal(first.organization, second.organization);
  assert.equal(first.branch, second.branch);
  assert.equal(first.productPipe, second.productPipe);
  assert.equal(first.productElbow, second.productElbow);
  assert.equal(first.variantOneInch, second.variantOneInch);

  assert.notEqual(first.saleOne, second.saleOne);
  assert.notEqual(first.eventOne, second.eventOne);
  assert.notEqual(first.paymentCashOne, second.paymentCashOne);
});
