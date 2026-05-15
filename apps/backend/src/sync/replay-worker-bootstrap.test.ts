import assert from "node:assert/strict";
import test from "node:test";

import { createSaleReplayWorkerFromConfig } from "./replay-worker-bootstrap.ts";

test("does not create a replay worker when disabled", () => {
  assert.equal(
    createSaleReplayWorkerFromConfig({
      config: { enabled: false, intervalMs: 30000, limit: 100 }
    }),
    null
  );
});

test("requires a PostgreSQL query client when replay worker is enabled", () => {
  assert.throws(
    () =>
      createSaleReplayWorkerFromConfig({
        config: { enabled: true, intervalMs: 30000, limit: 100 }
      }),
    /requires PostgreSQL repository mode/
  );
});
