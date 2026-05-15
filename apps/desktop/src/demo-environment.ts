import type { SqliteTransactionRunner } from "./db.ts";

export interface DesktopReferenceIds {
  organization: string;
  branch: string;
  device: string;
  user: string;
  customer: string;
  shift: string;
  category: string;
  supplier: string;
  productPipe: string;
  productElbow: string;
  variantOneInch: string;
}

export function seedDesktopReferenceData(
  db: SqliteTransactionRunner,
  ids: DesktopReferenceIds,
  now: string
): void {
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
