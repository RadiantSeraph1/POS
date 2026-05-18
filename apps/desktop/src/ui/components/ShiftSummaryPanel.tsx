import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

export function ShiftSummaryPanel(props: {
  shift: PosScreenSnapshot["reporting"]["shift"];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Shift Summary</h2>
          <p className="muted">Cashier progress for the active local shift</p>
        </div>
      </div>
      <div className="totals">
        <div>Sales</div>
        <div>{props.shift.salesCount}</div>
        <div>Gross Total</div>
        <div>{props.shift.grossTotalMinor}</div>
        <div>Synced Sales</div>
        <div>{props.shift.syncedSalesCount}</div>
        <div>Attention Sales</div>
        <div className={props.shift.attentionSalesCount > 0 ? "error-text" : "strong"}>
          {props.shift.attentionSalesCount}
        </div>
        <div>Dead Letter</div>
        <div className={props.shift.deadLetterSalesCount > 0 ? "error-text" : "strong"}>
          {props.shift.deadLetterSalesCount}
        </div>
        <div>Suspended Drafts</div>
        <div>{props.shift.suspendedDraftCount}</div>
      </div>
      {props.shift.deadLetterSalesCount > 0 ? (
        <p className="error-inline">
          Dead-letter sales need operator attention before the shift can be closed cleanly.
        </p>
      ) : null}
    </section>
  );
}
