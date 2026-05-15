export interface DemoSeedQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export const DEMO_POSTGRES_IDS = {
  organization: "11111111-1111-4111-8111-111111111111",
  branch: "22222222-2222-4222-8222-222222222222",
  device: "33333333-3333-4333-8333-333333333333",
  user: "44444444-4444-4444-8444-444444444444",
  warehouse: "66666666-6666-4666-8666-666666666666",
  customer: "55555555-5555-4555-8555-555555555555",
  category: "77777777-7777-4777-8777-777777777777",
  supplier: "88888888-8888-4888-8888-888888888888",
  productPipe: "99999999-9999-4999-8999-999999999999",
  productElbow: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  variantOneInch: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
} as const;

export async function seedDemoPostgresData(client: DemoSeedQueryClient): Promise<void> {
  await client.query(
    `
      INSERT INTO organizations (id, code, name)
      VALUES ($1::UUID, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.organization, "PIPEFLOW-DEMO", "PipeFlow Demo Org"]
  );

  await client.query(
    `
      INSERT INTO branches (id, organization_id, code, name)
      VALUES ($1::UUID, $2::UUID, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.branch, DEMO_POSTGRES_IDS.organization, "ACC-01", "Accra Central"]
  );

  await client.query(
    `
      INSERT INTO warehouses (id, organization_id, code, name)
      VALUES ($1::UUID, $2::UUID, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.warehouse, DEMO_POSTGRES_IDS.organization, "WH-01", "Central Warehouse"]
  );

  await client.query(
    `
      INSERT INTO users (id, organization_id, default_branch_id, full_name, is_active)
      VALUES ($1::UUID, $2::UUID, $3::UUID, $4, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.user, DEMO_POSTGRES_IDS.organization, DEMO_POSTGRES_IDS.branch, "Cashier Demo"]
  );

  await client.query(
    `
      INSERT INTO devices (id, organization_id, branch_id, device_name, device_type, trusted)
      VALUES ($1::UUID, $2::UUID, $3::UUID, $4, $5, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      DEMO_POSTGRES_IDS.device,
      DEMO_POSTGRES_IDS.organization,
      DEMO_POSTGRES_IDS.branch,
      "Front Counter POS",
      "pos_terminal"
    ]
  );

  await client.query(
    `
      INSERT INTO customers (id, organization_id, customer_code, full_name, is_active)
      VALUES ($1::UUID, $2::UUID, $3, $4, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.customer, DEMO_POSTGRES_IDS.organization, "CUST-001", "Walk-in Project Customer"]
  );

  await client.query(
    `
      INSERT INTO categories (id, organization_id, name)
      VALUES ($1::UUID, $2::UUID, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEMO_POSTGRES_IDS.category, DEMO_POSTGRES_IDS.organization, "Pipes and Fittings"]
  );

  await client.query(
    `
      INSERT INTO suppliers (id, organization_id, supplier_code, name)
      VALUES ($1::UUID, $2::UUID, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      DEMO_POSTGRES_IDS.supplier,
      DEMO_POSTGRES_IDS.organization,
      "SUP-001",
      "Standard Plumbing Supplies"
    ]
  );

  await client.query(
    `
      INSERT INTO products (
        id,
        organization_id,
        product_code,
        sku,
        name,
        category_id,
        supplier_id,
        unit_of_measure,
        tracking_mode,
        is_active
      )
      VALUES ($1::UUID, $2::UUID, $3, $4, $5, $6::UUID, $7::UUID, $8, $9, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      DEMO_POSTGRES_IDS.productPipe,
      DEMO_POSTGRES_IDS.organization,
      "PVC-PIPE-001",
      "SKU-PVC-001",
      "PVC Pipe",
      DEMO_POSTGRES_IDS.category,
      DEMO_POSTGRES_IDS.supplier,
      "piece",
      "quantity"
    ]
  );

  await client.query(
    `
      INSERT INTO products (
        id,
        organization_id,
        product_code,
        sku,
        name,
        category_id,
        supplier_id,
        unit_of_measure,
        tracking_mode,
        is_active
      )
      VALUES ($1::UUID, $2::UUID, $3, $4, $5, $6::UUID, $7::UUID, $8, $9, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      DEMO_POSTGRES_IDS.productElbow,
      DEMO_POSTGRES_IDS.organization,
      "ELBOW-001",
      "SKU-ELBOW-001",
      "Elbow Joint",
      DEMO_POSTGRES_IDS.category,
      DEMO_POSTGRES_IDS.supplier,
      "piece",
      "quantity"
    ]
  );

  await client.query(
    `
      INSERT INTO product_variants (
        id,
        product_id,
        variant_code,
        variant_name,
        attributes_json,
        is_active
      )
      VALUES ($1::UUID, $2::UUID, $3, $4, $5::JSONB, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      DEMO_POSTGRES_IDS.variantOneInch,
      DEMO_POSTGRES_IDS.productElbow,
      "1IN",
      "1 Inch",
      JSON.stringify({ size: "1 inch" })
    ]
  );
}
