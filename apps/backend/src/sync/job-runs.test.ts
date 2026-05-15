import assert from "node:assert/strict";
import test from "node:test";

import { runRecordedSyncJob } from "./job-runs.ts";

class RecordingClient {
  calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }> {
    this.calls.push(params ? { text, params } : { text });

    if (text.includes("INSERT INTO sync_job_runs")) {
      return { rows: [{ id: "job-run-001" }] as unknown as T[] };
    }

    return { rows: [] };
  }
}

test("records a successful sync job run with summary metadata", async () => {
  const client = new RecordingClient();

  const result = await runRecordedSyncJob(
    client,
    { jobType: "sale_replay", jobName: "Replay sale events" },
    async () => ({ scanned: 1, replayed: 1 })
  );

  assert.deepEqual(result, { scanned: 1, replayed: 1 });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[0]?.text ?? "", /INSERT INTO sync_job_runs/);
  assert.deepEqual(client.calls[0]?.params, ["sale_replay", "Replay sale events"]);
  assert.match(client.calls[1]?.text ?? "", /status = 'succeeded'/);
  assert.deepEqual(client.calls[1]?.params, [
    { scanned: 1, replayed: 1 },
    "job-run-001"
  ]);
});

test("records a failed sync job run before rethrowing", async () => {
  const client = new RecordingClient();

  await assert.rejects(
    () =>
      runRecordedSyncJob(
        client,
        { jobType: "sale_reconciliation", jobName: "Reconcile sale projections" },
        async () => {
          throw new Error("projection drift query failed");
        }
      ),
    /projection drift query failed/
  );

  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1]?.text ?? "", /status = 'failed'/);
  assert.deepEqual(client.calls[1]?.params, [
    "projection drift query failed",
    "job-run-001"
  ]);
});
