PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  last_seen_at TEXT,
  is_trusted INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  branch_id TEXT,
  email TEXT,
  phone TEXT,
  full_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  password_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_authenticated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS offline_auth_cache (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT,
  pin_hash TEXT,
  permissions_json TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  offline_access_expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  supplier_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  supplier_id TEXT,
  unit_of_measure TEXT NOT NULL,
  tracking_mode TEXT NOT NULL DEFAULT 'quantity',
  tax_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_code TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, variant_code),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS barcodes (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  product_variant_id TEXT,
  barcode TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS branch_prices (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_variant_id TEXT,
  currency_code TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_code TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  loyalty_points_balance INTEGER NOT NULL DEFAULT 0,
  credit_limit_minor INTEGER NOT NULL DEFAULT 0,
  credit_balance_minor INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  cashier_user_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash_minor INTEGER NOT NULL DEFAULT 0,
  closing_cash_minor INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (cashier_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  cashier_user_id TEXT NOT NULL,
  customer_id TEXT,
  sale_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  notes TEXT,
  happened_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id),
  FOREIGN KEY (cashier_user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_variant_id TEXT,
  quantity NUMERIC NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  provider_code TEXT,
  external_reference TEXT,
  amount_minor INTEGER NOT NULL,
  status TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  processed_by_user_id TEXT NOT NULL,
  refund_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  status TEXT NOT NULL,
  happened_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refund_items (
  id TEXT PRIMARY KEY,
  refund_id TEXT NOT NULL,
  sale_item_id TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  condition_code TEXT NOT NULL,
  line_total_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (refund_id) REFERENCES refunds(id),
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  print_status TEXT NOT NULL,
  printed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS suspended_sales (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  cashier_user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  cart_json TEXT NOT NULL,
  payments_json TEXT NOT NULL,
  totals_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (cashier_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_variant_id TEXT,
  sellable_quantity NUMERIC NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC NOT NULL DEFAULT 0,
  damaged_quantity NUMERIC NOT NULL DEFAULT 0,
  last_event_id TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (branch_id, product_id, product_variant_id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS inventory_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT,
  warehouse_id TEXT,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  quantity_delta NUMERIC,
  payload_json TEXT NOT NULL,
  local_created_at TEXT NOT NULL,
  synced_at TEXT,
  event_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_variant_id TEXT,
  reason_code TEXT NOT NULL,
  note TEXT,
  quantity_delta NUMERIC NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  request_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  approved_by_user_id TEXT,
  dispatched_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id TEXT PRIMARY KEY,
  stock_transfer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_variant_id TEXT,
  requested_quantity NUMERIC NOT NULL,
  approved_quantity NUMERIC,
  dispatched_quantity NUMERIC,
  received_quantity NUMERIC,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (stock_transfer_id) REFERENCES stock_transfers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TEXT,
  locked_at TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES inventory_events(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  branch_id TEXT,
  device_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  happened_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_branch_happened_at
  ON sales(branch_id, happened_at);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id
  ON payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_suspended_sales_updated_at
  ON suspended_sales(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_events_branch_created_at
  ON inventory_events(branch_id, local_created_at);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_branch_product
  ON inventory_levels(branch_id, product_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next_retry
  ON sync_queue(status, next_retry_at);
