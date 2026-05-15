import assert from "node:assert/strict";
import test from "node:test";

import { parsePostgresSetupConfig } from "./init-postgres.ts";

test("parses target and maintenance PostgreSQL connection strings", () => {
  const config = parsePostgresSetupConfig(
    "postgresql://postgres:secret@localhost:5432/pipeflow"
  );

  assert.equal(config.targetDatabase, "pipeflow");
  assert.equal(config.targetConnectionString, "postgresql://postgres:secret@localhost:5432/pipeflow");
  assert.equal(config.maintenanceConnectionString, "postgresql://postgres:secret@localhost:5432/postgres");
});
