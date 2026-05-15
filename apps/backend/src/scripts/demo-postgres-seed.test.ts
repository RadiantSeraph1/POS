import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_POSTGRES_IDS, seedDemoPostgresData } from "./demo-postgres-seed.ts";

class RecordingClient {
  calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }> {
    this.calls.push(params ? { text, params } : { text });
    return { rows: [] };
  }
}

test("seeds demo catalog records required by the desktop sale replay", async () => {
  const client = new RecordingClient();

  await seedDemoPostgresData(client);

  const sql = client.calls.map((call) => call.text).join("\n");

  assert.match(sql, /INSERT INTO customers/);
  assert.match(sql, /INSERT INTO categories/);
  assert.match(sql, /INSERT INTO suppliers/);
  assert.match(sql, /INSERT INTO warehouses/);
  assert.match(sql, /INSERT INTO products/);
  assert.match(sql, /INSERT INTO product_variants/);

  assert(
    client.calls.some((call) => call.params?.includes(DEMO_POSTGRES_IDS.productPipe)),
    "PVC pipe product id should be seeded"
  );
  assert(
    client.calls.some((call) => call.params?.includes(DEMO_POSTGRES_IDS.productElbow)),
    "elbow product id should be seeded"
  );
  assert(
    client.calls.some((call) => call.params?.includes(DEMO_POSTGRES_IDS.variantOneInch)),
    "one-inch variant id should be seeded"
  );
  assert(
    client.calls.some((call) => call.params?.includes(DEMO_POSTGRES_IDS.warehouse)),
    "central warehouse id should be seeded"
  );
});
