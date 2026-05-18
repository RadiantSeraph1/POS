import { useMemo, useState } from "react";

import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

function canRetry(status: PosScreenSnapshot["recovery"]["queue"][number]["status"]): boolean {
  return status === "failed" || status === "dead_letter";
}

type QueueFilter = "all" | "attention" | "dead_letter";
type SaleFilter = "all" | "attention" | "synced";

function suggestQueueAction(item: PosScreenSnapshot["recovery"]["queue"][number]): string | null {
  const message = item.lastError?.toLowerCase() ?? "";

  if (item.status !== "dead_letter") {
    return null;
  }

  if (message.includes("http request failed") || message.includes("fetch")) {
    return "Check branch connectivity or backend availability before retrying.";
  }

  if (message.includes("duplicate")) {
    return "Verify whether the event already landed in the cloud before retrying.";
  }

  if (message.includes("rejected")) {
    return "Inspect the payload or server-side validation rules before retrying.";
  }

  return "Review the error details and confirm the root cause before retrying.";
}

export function RecoveryPanel(props: {
  recovery: PosScreenSnapshot["recovery"];
  onRetryOne: (id: string) => void;
  onRetryAll: () => void;
}) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [saleFilter, setSaleFilter] = useState<SaleFilter>("all");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const recoverableCount = props.recovery.queue.filter((item) => canRetry(item.status)).length;
  const deadLetterCount = props.recovery.queue.filter((item) => item.status === "dead_letter").length;
  const filteredQueue = useMemo(() => {
    switch (queueFilter) {
      case "attention":
        return props.recovery.queue.filter((item) => canRetry(item.status));
      case "dead_letter":
        return props.recovery.queue.filter((item) => item.status === "dead_letter");
      default:
        return props.recovery.queue;
    }
  }, [props.recovery.queue, queueFilter]);
  const filteredSales = useMemo(() => {
    switch (saleFilter) {
      case "attention":
        return props.recovery.recentSales.filter((sale) => sale.syncStatus !== "synced");
      case "synced":
        return props.recovery.recentSales.filter((sale) => sale.syncStatus === "synced");
      default:
        return props.recovery.recentSales;
    }
  }, [props.recovery.recentSales, saleFilter]);
  const selectedSale =
    filteredSales.find((sale) => sale.saleId === selectedSaleId) ??
    props.recovery.recentSales.find((sale) => sale.saleId === selectedSaleId) ??
    filteredSales[0] ??
    null;

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
      {deadLetterCount > 0 ? (
        <div className="status-banner status-error">
          {deadLetterCount} dead-letter item(s) need review. Retry them only after the root cause is understood.
        </div>
      ) : null}

      <div className="recovery-section">
        <div className="panel-header">
          <h3>Queue</h3>
          <div className="filter-group">
            <button onClick={() => setQueueFilter("all")} className={queueFilter === "all" ? "primary" : ""}>
              All
            </button>
            <button
              onClick={() => setQueueFilter("attention")}
              className={queueFilter === "attention" ? "primary" : ""}
            >
              Attention
            </button>
            <button
              onClick={() => setQueueFilter("dead_letter")}
              className={queueFilter === "dead_letter" ? "primary" : ""}
            >
              Dead Letter
            </button>
          </div>
        </div>
        {filteredQueue.length === 0 ? <p className="muted">No queue items for this filter.</p> : null}
        <div className="recovery-list">
          {filteredQueue.map((item) => (
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
              {suggestQueueAction(item) ? <p className="muted">Suggested action: {suggestQueueAction(item)}</p> : null}
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
        <div className="panel-header">
          <h3>Recent Sales</h3>
          <div className="filter-group">
            <button onClick={() => setSaleFilter("all")} className={saleFilter === "all" ? "primary" : ""}>
              All
            </button>
            <button
              onClick={() => setSaleFilter("attention")}
              className={saleFilter === "attention" ? "primary" : ""}
            >
              Attention
            </button>
            <button
              onClick={() => setSaleFilter("synced")}
              className={saleFilter === "synced" ? "primary" : ""}
            >
              Synced
            </button>
          </div>
        </div>
        {filteredSales.length === 0 ? <p className="muted">No local sales for this filter.</p> : null}
        <div className="recovery-list">
          {filteredSales.map((sale) => (
            <button
              key={sale.saleId}
              type="button"
              className={`recovery-card selectable-card ${selectedSale?.saleId === sale.saleId ? "selected-card" : ""}`}
              onClick={() => setSelectedSaleId(sale.saleId)}
            >
              <div className="recovery-card-header">
                <div>
                  <div className="strong">{sale.saleNumber}</div>
                  <div className="muted">{sale.happenedAt}</div>
                </div>
                <span className={`queue-badge queue-${sale.syncStatus}`}>{sale.syncStatus}</span>
              </div>
              <div className="recovery-metadata">
                <span>Total {sale.totalMinor}</span>
                <span>Items {sale.itemCount}</span>
              </div>
              {sale.eventId ? <p className="muted">Event {sale.eventId}</p> : null}
            </button>
          ))}
        </div>
        {selectedSale ? (
          <div className="recovery-card detail-card">
            <div className="recovery-card-header">
              <div>
                <div className="strong">{selectedSale.saleNumber}</div>
                <div className="muted">{selectedSale.happenedAt}</div>
              </div>
              <span className={`queue-badge queue-${selectedSale.syncStatus}`}>{selectedSale.syncStatus}</span>
            </div>
            <div className="recovery-metadata">
              <span>Total {selectedSale.totalMinor}</span>
              <span>Retries {selectedSale.retryCount}</span>
            </div>
            <div className="detail-section">
              <div className="strong">Items</div>
              {selectedSale.items.map((item) => (
                <div key={`${selectedSale.saleId}:${item.name}`} className="recovery-metadata">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span>{item.lineTotalMinor}</span>
                </div>
              ))}
            </div>
            <div className="detail-section">
              <div className="strong">Payments</div>
              {selectedSale.payments.map((payment, index) => (
                <div key={`${selectedSale.saleId}:${payment.method}:${index}`} className="recovery-metadata">
                  <span>{payment.method}</span>
                  <span>{payment.amountMinor}</span>
                </div>
              ))}
            </div>
            {selectedSale.eventId ? <p className="muted">Event {selectedSale.eventId}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
