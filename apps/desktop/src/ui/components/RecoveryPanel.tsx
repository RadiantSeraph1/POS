import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

function canRetry(status: PosScreenSnapshot["recovery"]["queue"][number]["status"]): boolean {
  return status === "failed" || status === "dead_letter";
}

export function RecoveryPanel(props: {
  recovery: PosScreenSnapshot["recovery"];
  onRetryOne: (id: string) => void;
  onRetryAll: () => void;
}) {
  const recoverableCount = props.recovery.queue.filter((item) => canRetry(item.status)).length;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Recovery</h2>
          <p className="muted">Queue detail and recent local sales</p>
        </div>
        <button onClick={props.onRetryAll} disabled={recoverableCount === 0}>
          Retry All
        </button>
      </div>

      <div className="recovery-section">
        <h3>Queue</h3>
        {props.recovery.queue.length === 0 ? <p className="muted">No queue items yet.</p> : null}
        <div className="recovery-list">
          {props.recovery.queue.map((item) => (
            <div key={item.id} className="recovery-card">
              <div className="recovery-card-header">
                <div>
                  <div className="strong">{item.eventType}</div>
                  <div className="muted">Event {item.eventId}</div>
                </div>
                <span className={`queue-badge queue-${item.status}`}>{item.status}</span>
              </div>
              <div className="recovery-metadata">
                <span>Aggregate {item.aggregateId}</span>
                <span>Retries {item.retryCount}</span>
              </div>
              {item.nextRetryAt ? <p className="muted">Next retry {item.nextRetryAt}</p> : null}
              {item.lastError ? <p className="error-inline">Last error: {item.lastError}</p> : null}
              <div className="checkout-actions">
                <button onClick={() => props.onRetryOne(item.id)} disabled={!canRetry(item.status)}>
                  Retry
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="recovery-section">
        <h3>Recent Sales</h3>
        {props.recovery.recentSales.length === 0 ? <p className="muted">No local sales yet.</p> : null}
        <div className="recovery-list">
          {props.recovery.recentSales.map((sale) => (
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
                <span>Retries {sale.retryCount}</span>
              </div>
              {sale.eventId ? <p className="muted">Event {sale.eventId}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
