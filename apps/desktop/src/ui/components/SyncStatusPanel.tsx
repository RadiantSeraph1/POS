import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

export function SyncStatusPanel(props: {
  sync: PosScreenSnapshot["sync"];
  inventory: PosScreenSnapshot["inventory"];
  lastSubmitResult?: PosScreenSnapshot["lastSubmitResult"];
  onProcessSync: () => void;
  onReset: () => void;
}) {
  return (
    <section className="panel">
      <h2>Sync Status</h2>
      <div className="sync-grid">
        <span>Pending</span>
        <span>{props.sync.pending}</span>
        <span>Synced</span>
        <span>{props.sync.synced}</span>
        <span>Failed</span>
        <span>{props.sync.failed}</span>
        <span>Dead</span>
        <span>{props.sync.deadLetter}</span>
      </div>
      {props.sync.lastError ? <p className="error">Queue error: {props.sync.lastError}</p> : null}
      {props.lastSubmitResult ? (
        <p className="muted">
          Last sale {props.lastSubmitResult.saleNumber} synced as event {props.lastSubmitResult.eventId}
        </p>
      ) : null}
      <div className="inventory-list">
        {props.inventory.map((line) => (
          <div key={`${line.productId}:${line.productVariantId ?? "base"}`} className="inventory-line">
            <span>{line.productVariantId ? `${line.productId} / ${line.productVariantId}` : line.productId}</span>
            <span>{line.sellableQuantity}</span>
          </div>
        ))}
      </div>
      <div className="checkout-actions">
        <button onClick={props.onProcessSync}>Process Sync</button>
        <button onClick={props.onReset}>Reset Demo</button>
      </div>
    </section>
  );
}
