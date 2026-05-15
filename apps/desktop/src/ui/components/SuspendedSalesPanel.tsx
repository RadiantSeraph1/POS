import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

export function SuspendedSalesPanel(props: {
  suspendedSales: PosScreenSnapshot["suspendedSales"];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Suspended Sales</h2>
        <span className="muted">{props.suspendedSales.length} saved</span>
      </div>
      <div className="suspended-sales-list">
        {props.suspendedSales.length === 0 ? <p className="muted">No suspended sales.</p> : null}
        {props.suspendedSales.map((sale) => (
          <div key={sale.id} className="suspended-sale-card">
            <div>
              <div className="name">{sale.label}</div>
              <div className="muted">
                {sale.itemCount} items | total {sale.totalMinor}
              </div>
              <div className="muted">Updated {sale.updatedAt}</div>
            </div>
            <div className="checkout-actions">
              <button onClick={() => props.onResume(sale.id)}>Resume</button>
              <button onClick={() => props.onDelete(sale.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
