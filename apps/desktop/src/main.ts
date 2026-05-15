import { existsSync, rmSync } from "node:fs";
import type { Server } from "node:http";

import {
  SqliteSyncEventRepository,
  SyncIngestionService,
  createBackendHttpServer
} from "../../backend/src/sync/index.ts";
import { SqliteTransactionRunner, resolveProjectPath } from "./db.ts";
import { createDemoIds } from "./demo-ids.ts";
import { createLocalSale } from "./sales/index.ts";
import {
  HttpSyncTransport,
  SelectiveFailingSyncTransport,
  SyncQueueProcessor
} from "./sync/index.ts";
import { runPosFlow } from "./pos/flow.ts";

const ids = createDemoIds();

const databaseFile = resolveProjectPath("data", "desktop", "branch-001.sqlite");
const schemaFile = resolveProjectPath(
  "infrastructure",
  "sql",
  "sqlite",
  "001_initial_branch_schema.sql"
);

if (existsSync(databaseFile)) {
  rmSync(databaseFile);
}

const db = new SqliteTransactionRunner(databaseFile);
db.applySchemaFile(schemaFile);
const externalBackendBaseUrl = process.env.PIPEFLOW_SYNC_BASE_URL;
const shouldUseExternalBackend = Boolean(externalBackendBaseUrl);

let backendRepository: SqliteSyncEventRepository | null = null;
let backendServer: Server | null = null;
let backendBaseUrl = externalBackendBaseUrl ?? "http://127.0.0.1:3102";

if (!shouldUseExternalBackend) {
  const backendRepositoryFile = resolveProjectPath("data", "backend", "sync-events.sqlite");
  if (existsSync(backendRepositoryFile)) {
    rmSync(backendRepositoryFile);
  }

  backendRepository = new SqliteSyncEventRepository(backendRepositoryFile);
  await backendRepository.initialize();
  const backendService = new SyncIngestionService(backendRepository);
  backendServer = createBackendHttpServer(backendService);
  const backendPort = 3102;

  await new Promise<void>((resolve, reject) => {
    backendServer!.listen(backendPort, () => resolve());
    backendServer!.once("error", reject);
  });
}

const now = new Date().toISOString();

function seedReferenceData(): void {
  db.execute(
    `
      INSERT INTO branches (id, organization_id, code, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [ids.branch, ids.organization, "ACC-01", "Accra Central", now, now]
  );

  db.execute(
    `
      INSERT INTO devices (id, branch_id, device_name, device_type, registered_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [ids.device, ids.branch, "Front Counter POS", "pos_terminal", now, now]
  );

  db.execute(
    `
      INSERT INTO users (
        id, branch_id, full_name, role_code, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [ids.user, ids.branch, "Cashier Demo", "cashier", 1, now, now]
  );

  db.execute(
    `
      INSERT INTO customers (
        id, customer_code, full_name, loyalty_points_balance, credit_limit_minor,
        credit_balance_minor, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [ids.customer, "CUST-001", "Walk-in Project Customer", 0, 0, 0, 1, now, now]
  );

  db.execute(
    `
      INSERT INTO shifts (
        id, branch_id, cashier_user_id, opened_at, opening_cash_minor, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [ids.shift, ids.branch, ids.user, now, 200000, "open", now, now]
  );

  db.execute(
    `
      INSERT INTO categories (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
    [ids.category, "Pipes and Fittings", now, now]
  );

  db.execute(
    `
      INSERT INTO suppliers (id, supplier_code, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [ids.supplier, "SUP-001", "Standard Plumbing Supplies", now, now]
  );

  db.execute(
    `
      INSERT INTO products (
        id, product_code, sku, name, category_id, supplier_id, unit_of_measure,
        tracking_mode, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ids.productPipe,
      "PVC-PIPE-001",
      "SKU-PVC-001",
      "PVC Pipe",
      ids.category,
      ids.supplier,
      "piece",
      "quantity",
      1,
      now,
      now
    ]
  );

  db.execute(
    `
      INSERT INTO products (
        id, product_code, sku, name, category_id, supplier_id, unit_of_measure,
        tracking_mode, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ids.productElbow,
      "ELBOW-001",
      "SKU-ELBOW-001",
      "Elbow Joint",
      ids.category,
      ids.supplier,
      "piece",
      "quantity",
      1,
      now,
      now
    ]
  );

  db.execute(
    `
      INSERT INTO product_variants (
        id, product_id, variant_code, variant_name, attributes_json, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ids.variantOneInch,
      ids.productElbow,
      "1IN",
      "1 Inch",
      JSON.stringify({ size: "1 inch" }),
      1,
      now,
      now
    ]
  );

  db.execute(
    `
      INSERT INTO inventory_levels (
        id, branch_id, product_id, product_variant_id, sellable_quantity,
        reserved_quantity, damaged_quantity, last_event_id, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${ids.branch}:${ids.productPipe}:base`,
      ids.branch,
      ids.productPipe,
      null,
      20,
      0,
      0,
      null,
      now
    ]
  );

  db.execute(
    `
      INSERT INTO inventory_levels (
        id, branch_id, product_id, product_variant_id, sellable_quantity,
        reserved_quantity, damaged_quantity, last_event_id, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${ids.branch}:${ids.productElbow}:${ids.variantOneInch}`,
      ids.branch,
      ids.productElbow,
      ids.variantOneInch,
      50,
      0,
      0,
      null,
      now
    ]
  );
}

seedReferenceData();

const sampleSale = {
  eventId: ids.eventOne,
  saleId: ids.saleOne,
  saleNumber: "POS-000001",
  organizationId: ids.organization,
  branchId: ids.branch,
  shiftId: ids.shift,
  cashierUserId: ids.user,
  deviceId: ids.device,
  customerId: ids.customer,
  currencyCode: "GHS",
  subtotalMinor: 125000,
  discountMinor: 5000,
  taxMinor: 0,
  totalMinor: 120000,
  happenedAt: now,
  notes: "Sample local sale transaction",
  items: [
    {
      saleItemId: ids.saleItemOne,
      productId: ids.productPipe,
      quantity: 2,
      unitPriceMinor: 50000,
      discountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 100000
    },
    {
      saleItemId: ids.saleItemTwo,
      productId: ids.productElbow,
      productVariantId: ids.variantOneInch,
      quantity: 4,
      unitPriceMinor: 6250,
      discountMinor: 5000,
      taxMinor: 0,
      lineTotalMinor: 20000
    }
  ],
  payments: [
    {
      paymentId: ids.paymentCashOne,
      method: "cash",
      amountMinor: 80000,
      status: "completed",
      paidAt: now
    },
    {
      paymentId: ids.paymentMomoOne,
      method: "mobile_money",
      amountMinor: 40000,
      providerCode: "mtn_momo",
      externalReference: "MM-REF-001",
      status: "completed",
      paidAt: now
    }
  ]
};

const oversellAttempt = {
  eventId: ids.eventTwo,
  saleId: ids.saleTwo,
  saleNumber: "POS-000002",
  organizationId: ids.organization,
  branchId: ids.branch,
  shiftId: ids.shift,
  cashierUserId: ids.user,
  deviceId: ids.device,
  currencyCode: "GHS",
  subtotalMinor: 1000000,
  discountMinor: 0,
  taxMinor: 0,
  totalMinor: 1000000,
  happenedAt: now,
  notes: "Intentional oversell validation test",
  items: [
    {
      saleItemId: ids.saleItemThree,
      productId: ids.productPipe,
      quantity: 99,
      unitPriceMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 990000
    },
    {
      saleItemId: ids.saleItemFour,
      productId: ids.productElbow,
      productVariantId: ids.variantOneInch,
      quantity: 1,
      unitPriceMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 10000
    }
  ],
  payments: [
    {
      paymentId: ids.paymentCashTwo,
      method: "cash",
      amountMinor: 1000000,
      status: "completed",
      paidAt: now
    }
  ]
};

const retrySale = {
  eventId: ids.eventThree,
  saleId: ids.saleThree,
  saleNumber: "POS-000003",
  organizationId: ids.organization,
  branchId: ids.branch,
  shiftId: ids.shift,
  cashierUserId: ids.user,
  deviceId: ids.device,
  currencyCode: "GHS",
  subtotalMinor: 20000,
  discountMinor: 0,
  taxMinor: 0,
  totalMinor: 20000,
  happenedAt: now,
  notes: "Retry and dead-letter demonstration",
  items: [
    {
      saleItemId: ids.saleItemFive,
      productId: ids.productElbow,
      productVariantId: ids.variantOneInch,
      quantity: 2,
      unitPriceMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 20000
    }
  ],
  payments: [
    {
      paymentId: ids.paymentCashThree,
      method: "cash",
      amountMinor: 20000,
      status: "completed",
      paidAt: now
    }
  ]
};

try {
  const processor = new SyncQueueProcessor(
    db,
    new HttpSyncTransport(backendBaseUrl)
  );

  await runPosFlow(db, processor, {
    ids,
    happenedAt: now
  });

  try {
    await createLocalSale(db, oversellAttempt);
    console.log("Oversell validation unexpectedly passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("Oversell validation blocked transaction:");
    console.log(message);
  }
  if (backendRepository) {
    console.log("Backend stored events after POS sync:");
    console.log(JSON.stringify(await backendRepository.list(), null, 2));
  } else {
    const backendEvents = await fetch(`${backendBaseUrl}/sync/events`).then((response) =>
      response.json()
    );
    console.log("Live backend events after POS sync:");
    console.log(JSON.stringify(backendEvents, null, 2));
  }

  const retrySaleResult = await createLocalSale(db, retrySale);
  console.log(`Created retry test sale ${retrySaleResult.saleId} with event ${retrySaleResult.eventId}`);

  const failingProcessor = new SyncQueueProcessor(
    db,
    new SelectiveFailingSyncTransport([retrySaleResult.eventId]),
    3
  );

  const attemptTimes = [
    new Date("2026-05-11T21:40:00.000Z"),
    new Date("2026-05-11T21:40:02.000Z"),
    new Date("2026-05-11T21:40:06.000Z")
  ];

  for (const [index, attemptTime] of attemptTimes.entries()) {
    const attemptResult = await failingProcessor.processPending(20, attemptTime);
    const retryQueueState = db.query<{
      event_id: string;
      status: string;
      retry_count: number;
      last_error: string | null;
      next_retry_at: string | null;
    }>(
      `
        SELECT event_id, status, retry_count, last_error, next_retry_at
        FROM sync_queue
        WHERE event_id = ?
      `,
      [retrySaleResult.eventId]
    );

    console.log(`Retry attempt ${index + 1}:`);
    console.log(JSON.stringify(attemptResult, null, 2));
    console.log(JSON.stringify(retryQueueState, null, 2));
  }
} finally {
  db.close();
  if (backendServer) {
    await new Promise<void>((resolve, reject) => {
      backendServer!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await backendRepository?.close?.();
}
