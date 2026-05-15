import assert from "node:assert/strict";
import test from "node:test";

import { SaleReplayWorker } from "./replay-worker.ts";
import type { SaleReplayBatchSummary } from "./sale-replay.ts";

test("runs sale replay once and records status", async () => {
  const summaries: SaleReplayBatchSummary[] = [
    {
      scanned: 2,
      replayed: 1,
      skipped: 1,
      failed: 0
    }
  ];
  const worker = new SaleReplayWorker({
    intervalMs: 1000,
    limit: 50,
    replay: async (limit) => {
      assert.equal(limit, 50);
      return summaries.shift() ?? { scanned: 0, replayed: 0, skipped: 0, failed: 0 };
    }
  });

  const summary = await worker.runOnce();

  assert.deepEqual(summary, {
    scanned: 2,
    replayed: 1,
    skipped: 1,
    failed: 0
  });
  assert.deepEqual(worker.getStatus(), {
    enabled: false,
    running: false,
    inFlight: false,
    intervalMs: 1000,
    limit: 50,
    runs: 1,
    failures: 0,
    lastRunAt: worker.getStatus().lastRunAt,
    lastSummary: summary
  });
  assert.equal(typeof worker.getStatus().lastRunAt, "string");
});

test("records replay worker failures without hiding the error", async () => {
  const worker = new SaleReplayWorker({
    intervalMs: 1000,
    limit: 10,
    replay: async () => {
      throw new Error("database unavailable");
    }
  });

  await assert.rejects(() => worker.runOnce(), /database unavailable/);

  const status = worker.getStatus();
  assert.equal(status.failures, 1);
  assert.equal(status.lastError, "database unavailable");
  assert.equal(status.inFlight, false);
});
