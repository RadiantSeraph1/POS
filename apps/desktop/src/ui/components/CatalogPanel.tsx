import { useMemo, useState } from "react";

import { filterSellableCatalog, type PosCatalogItem } from "../../pos/catalog.ts";

export function CatalogPanel(props: {
  catalog: PosCatalogItem[];
  onAdd: (input: { productId: string; productVariantId?: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredCatalog = useMemo(
    () => filterSellableCatalog(props.catalog, query),
    [props.catalog, query]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Catalog</h2>
        <span className="muted">{filteredCatalog.length} items</span>
      </div>
      <label className="search-field">
        <span className="muted">Search by SKU or name</span>
        <input
          type="search"
          placeholder="PVC, 1IN, elbow..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="catalog-list">
        {filteredCatalog.length === 0 ? <p className="muted">No products match this search.</p> : null}
        {filteredCatalog.map((item) => (
          <button
            key={`${item.productId}:${item.productVariantId ?? "base"}`}
            className="catalog-item"
            onClick={() =>
              props.onAdd({
                productId: item.productId,
                ...(item.productVariantId ? { productVariantId: item.productVariantId } : {})
              })
            }
          >
            <span className="sku">{item.sku}</span>
            <span className="name">{item.name}</span>
            <span className="stock">Stock {item.sellableQuantity}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
