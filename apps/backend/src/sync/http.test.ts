import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createBackendHttpServer } from "./http.ts";
import { SyncIngestionService } from "./service.ts";
import { InMemorySyncEventRepository } from "./repository.ts";

test("returns sync health with replay worker status", async () => {
  const server = createBackendHttpServer(
    new SyncIngestionService(new InMemorySyncEventRepository()),
    {
      replayWorker: {
        getStatus: () => ({
          enabled: true,
          running: true,
          inFlight: false,
          intervalMs: 5000,
          limit: 25,
          runs: 3,
          failures: 0
        })
      }
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.notEqual(address, null);
    const port = (address as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/sync/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      status: "ok",
      replayWorker: {
        enabled: true,
        running: true,
        inFlight: false,
        intervalMs: 5000,
        limit: 25,
        runs: 3,
        failures: 0
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("allows public health without auth", async () => {
  const server = createBackendHttpServer(
    new SyncIngestionService(new InMemorySyncEventRepository()),
    {
      auth: {
        enabled: true,
        identities: new Map([
          [
            "read-token",
            {
              token: "read-token",
              roles: ["sync_read"]
            }
          ]
        ])
      }
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.notEqual(address, null);
    const port = (address as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("rejects protected sync health without token", async () => {
  const server = createBackendHttpServer(
    new SyncIngestionService(new InMemorySyncEventRepository()),
    {
      auth: {
        enabled: true,
        identities: new Map([
          [
            "read-token",
            {
              token: "read-token",
              roles: ["sync_read"]
            }
          ]
        ])
      }
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.notEqual(address, null);
    const port = (address as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/sync/health`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Missing Authorization header.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("allows protected sync health with read token", async () => {
  const server = createBackendHttpServer(
    new SyncIngestionService(new InMemorySyncEventRepository()),
    {
      auth: {
        enabled: true,
        identities: new Map([
          [
            "read-token",
            {
              token: "read-token",
              roles: ["sync_read"]
            }
          ]
        ])
      }
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.notEqual(address, null);
    const port = (address as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/sync/health`, {
      headers: {
        Authorization: "Bearer read-token"
      }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
