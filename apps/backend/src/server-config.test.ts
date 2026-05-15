import assert from "node:assert/strict";
import test from "node:test";

import { parseAuthConfig, parseHttpPort, parseReplayWorkerConfig } from "./server-config.ts";

test("uses 3000 when PORT is not set", () => {
  assert.equal(parseHttpPort(undefined), 3000);
});

test("uses the configured PORT when it is valid", () => {
  assert.equal(parseHttpPort("3001"), 3001);
});

test("rejects invalid PORT values", () => {
  assert.throws(() => parseHttpPort("not-a-port"), /PORT must be a number/);
});

test("disables the replay worker by default", () => {
  assert.deepEqual(parseReplayWorkerConfig({}), {
    enabled: false,
    intervalMs: 30000,
    limit: 100
  });
});

test("parses replay worker settings from environment values", () => {
  assert.deepEqual(
    parseReplayWorkerConfig({
      SYNC_REPLAY_WORKER: "enabled",
      SYNC_REPLAY_WORKER_INTERVAL_MS: "5000",
      SYNC_REPLAY_WORKER_LIMIT: "25"
    }),
    {
      enabled: true,
      intervalMs: 5000,
      limit: 25
    }
  );
});

test("rejects invalid replay worker settings", () => {
  assert.throws(
    () => parseReplayWorkerConfig({ SYNC_REPLAY_WORKER_INTERVAL_MS: "0" }),
    /SYNC_REPLAY_WORKER_INTERVAL_MS must be a positive integer/
  );
  assert.throws(
    () => parseReplayWorkerConfig({ SYNC_REPLAY_WORKER_LIMIT: "not-a-number" }),
    /SYNC_REPLAY_WORKER_LIMIT must be a positive integer/
  );
});

test("disables backend auth by default", () => {
  assert.deepEqual(parseAuthConfig({}), {
    enabled: false,
    identities: new Map()
  });
});

test("parses token-based backend auth config", () => {
  const config = parseAuthConfig({
    BACKEND_AUTH_MODE: "token",
    BACKEND_AUTH_TOKENS: "ingest-token=sync_ingest;read-token=sync_read,sync_admin"
  });

  assert.equal(config.enabled, true);
  assert.deepEqual(config.identities.get("ingest-token"), {
    token: "ingest-token",
    roles: ["sync_ingest"]
  });
  assert.deepEqual(config.identities.get("read-token"), {
    token: "read-token",
    roles: ["sync_read", "sync_admin"]
  });
});

test("rejects invalid backend auth config", () => {
  assert.throws(
    () => parseAuthConfig({ BACKEND_AUTH_MODE: "token" }),
    /BACKEND_AUTH_TOKENS is required/
  );
  assert.throws(
    () =>
      parseAuthConfig({
        BACKEND_AUTH_MODE: "token",
        BACKEND_AUTH_TOKENS: "bad-token=unknown_role"
      }),
    /Unsupported backend auth role/
  );
});
