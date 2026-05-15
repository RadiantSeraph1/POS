import type { PosCatalogItem } from "../../pos/catalog.ts";

export function CatalogPanel(props: {
  catalog: PosCatalogItem[];
  onAdd: (input: { productId: string; productVariantId?: string }) => void;
}) {
  return (
    <section className="panel">
      <h2>Catalog</h2>
      <div className="catalog-list">
        {props.catalog.map((item) => (
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
