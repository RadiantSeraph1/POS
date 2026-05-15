import type { SqliteTransactionRunner } from "../db.ts";

interface ProductCatalogRow {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  variant_code: string | null;
  product_name: string;
  variant_name: string | null;
  sellable_quantity: number;
}

export interface PosCatalogItem {
  productId: string;
  productVariantId?: string;
  sku: string;
  name: string;
  sellableQuantity: number;
}

export function listSellableCatalog(db: SqliteTransactionRunner): PosCatalogItem[] {
  const rows = db.query<ProductCatalogRow>(
    `
      SELECT
        p.id AS product_id,
        pv.id AS product_variant_id,
        p.sku AS sku,
        pv.variant_code AS variant_code,
        p.name AS product_name,
        pv.variant_name AS variant_name,
        COALESCE(il.sellable_quantity, 0) AS sellable_quantity
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
      LEFT JOIN inventory_levels il
        ON il.product_id = p.id
       AND ((pv.id IS NULL AND il.product_variant_id IS NULL) OR il.product_variant_id = pv.id)
      WHERE p.is_active = 1
      ORDER BY p.name, pv.variant_name
    `
  );

  return rows.map((row) => ({
    productId: row.product_id,
    ...(row.product_variant_id ? { productVariantId: row.product_variant_id } : {}),
    sku: row.variant_code ?? row.sku,
    name: row.variant_name ? `${row.product_name} ${row.variant_name}` : row.product_name,
    sellableQuantity: row.sellable_quantity
  }));
}
