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
        <div>Open Cart Lines</div>
        <div>{props.shift.openCartLineCount}</div>
      </div>
      <div className={`status-banner ${props.shift.readyToClose ? "status-success" : "status-error"}`}>
        {props.shift.readyToClose ? "Shift can be closed." : "Shift close blocked."}
      </div>
      {props.shift.blockers.length > 0 ? (
        <div className="bullet-block">
          {props.shift.blockers.map((blocker) => (
            <div key={blocker} className="muted">
              - {blocker}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
