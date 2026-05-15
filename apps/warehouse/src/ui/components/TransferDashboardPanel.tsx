import type { WarehouseShellSnapshot } from "../../electron/warehouse-ui-service.ts";

export function TransferDashboardPanel(props: {
  dashboard: WarehouseShellSnapshot["dashboard"];
  backendMode: WarehouseShellSnapshot["backendMode"];
  baseUrl: string;
  onSelectTransfer: (transferId: string) => void;
  selectedTransferId: string | null;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Transfer Dashboard</h2>
          <p className="muted">
            {props.backendMode} backend | {props.baseUrl}
          </p>
        </div>
        <div className="dashboard-chip">{props.dashboard.totalTransfers} transfers</div>
      </div>
      <div className="dashboard-stats">
        <div><span>Requested</span><strong>{props.dashboard.requestedTransfers}</strong></div>
        <div><span>Approved</span><strong>{props.dashboard.approvedTransfers}</strong></div>
        <div><span>Dispatched</span><strong>{props.dashboard.dispatchedTransfers}</strong></div>
        <div><span>Partial</span><strong>{props.dashboard.partialReceiptTransfers}</strong></div>
        <div><span>Received</span><strong>{props.dashboard.receivedTransfers}</strong></div>
        <div><span>Rejected</span><strong>{props.dashboard.rejectedTransfers}</strong></div>
        <div><span>Cancelled</span><strong>{props.dashboard.cancelledTransfers}</strong></div>
      </div>
      <div className="warehouse-list">
        {props.dashboard.transfers.map((transfer) => (
          <button
            key={transfer.transferId}
            className={`warehouse-card compact-card card-button ${
              props.selectedTransferId === transfer.transferId ? "selected-card" : ""
            }`}
            onClick={() => props.onSelectTransfer(transfer.transferId)}
          >
            <div className="warehouse-card-header">
              <div>
                <div className="name">{transfer.requestNumber}</div>
                <div className="muted">
                  {transfer.sourceType}:{transfer.sourceId} to {transfer.destinationType}:{transfer.destinationId}
                </div>
              </div>
              <div className="warehouse-badge">{transfer.status}</div>
            </div>
            <div className="warehouse-meta">
              <span>Lines {transfer.lines.length}</span>
              <span>Events {transfer.events.length}</span>
              <span>Updated {transfer.lastUpdatedAt}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
