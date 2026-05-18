import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

function countLowStockLines(inventory: PosScreenSnapshot["inventory"]): number {
  return inventory.filter((line) => line.sellableQuantity <= 5).length;
}

export function BranchManagerDashboardPanel(props: {
  shift: PosScreenSnapshot["reporting"]["shift"];
  sync: PosScreenSnapshot["sync"];
  inventory: PosScreenSnapshot["inventory"];
  recentSales: PosScreenSnapshot["recovery"]["recentSales"];
  suspendedSales: PosScreenSnapshot["suspendedSales"];
}) {
  const lowStockCount = countLowStockLines(props.inventory);
  const topInventory = [...props.inventory]
    .sort((left, right) => left.sellableQuantity - right.sellableQuantity)
    .slice(0, 5);

  return (
    <section className="manager-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Branch Dashboard</h2>
            <p className="muted">Operating summary for the current branch session</p>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span className="label">Sales</span>
            <strong>{props.shift.salesCount}</strong>
            <span className="muted">Gross {props.shift.grossTotalMinor}</span>
          </div>
          <div className="metric-card">
            <span className="label">Sync Attention</span>
            <strong>{props.shift.attentionSalesCount}</strong>
            <span className="muted">{props.sync.pending} pending / {props.sync.failed} failed</span>
          </div>
          <div className="metric-card">
            <span className="label">Low Stock</span>
            <strong>{lowStockCount}</strong>
            <span className="muted">Items at 5 or below</span>
          </div>
          <div className="metric-card">
            <span className="label">Drafts</span>
            <strong>{props.suspendedSales.length}</strong>
            <span className="muted">Suspended cashier carts</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Sync Health</h2>
            <p className="muted">Queue state visible to branch operations</p>
          </div>
        </div>
        <div className="sync-grid">
          <span>Pending</span>
          <span>{props.sync.pending}</span>
          <span>Processing</span>
          <span>{props.sync.processing}</span>
          <span>Synced</span>
          <span>{props.sync.synced}</span>
          <span>Failed</span>
          <span>{props.sync.failed}</span>
          <span>Dead Letter</span>
          <span>{props.sync.deadLetter}</span>
        </div>
        {props.sync.lastError ? <p className="error-inline">Latest error: {props.sync.lastError}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Sales</h2>
            <p className="muted">Latest cashier transactions and sync state</p>
          </div>
        </div>
        <div className="recovery-list">
          {props.recentSales.length === 0 ? <p className="muted">No completed sales yet.</p> : null}
          {props.recentSales.slice(0, 5).map((sale) => (
            <div key={sale.saleId} className="recovery-card">
              <div className="recovery-card-header">
                <div>
                  <div className="strong">{sale.saleNumber}</div>
                  <div className="muted">{sale.happenedAt}</div>
                </div>
                <span className={`queue-badge queue-${sale.syncStatus}`}>{sale.syncStatus}</span>
              </div>
              <div className="recovery-metadata">
                <span>Total {sale.totalMinor}</span>
                <span>{sale.itemCount} items</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Inventory Watch</h2>
            <p className="muted">Lowest sellable lines in the local branch snapshot</p>
          </div>
        </div>
        <div className="inventory-list">
          {topInventory.map((line) => (
            <div key={`${line.productId}:${line.productVariantId ?? "base"}`} className="inventory-line">
              <span>{line.productVariantId ? `${line.productId} / ${line.productVariantId}` : line.productId}</span>
              <span className={line.sellableQuantity <= 5 ? "error-text" : ""}>{line.sellableQuantity}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
