import { useEffect, useState } from "react";

import type {
  CancelTransferCommand,
  RejectTransferCommand
} from "../../electron/warehouse-ui-service.ts";
import type { TransferDetailSummary } from "../../transfer-detail.ts";

function canReject(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "requested";
}

function canCancel(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "requested" || status === "approved" || status === "dispatched";
}

export function TransferDetailPanel(props: {
  detail: TransferDetailSummary | null;
  onReject: (input: RejectTransferCommand) => void;
  onCancel: (input: CancelTransferCommand) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [props.detail?.transfer.transferId]);

  if (!props.detail) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Transfer Detail</h2>
            <p className="muted">Select a transfer to inspect discrepancy detail.</p>
          </div>
        </div>
      </section>
    );
  }

  const { transfer, totals, lines } = props.detail;
  const showReasonField = canReject(transfer.status) || canCancel(transfer.status);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Transfer Detail</h2>
          <p className="muted">{transfer.requestNumber}</p>
        </div>
        <div className="warehouse-badge">{transfer.status}</div>
      </div>

      <div className="warehouse-meta">
        <span>{transfer.sourceType}:{transfer.sourceId}</span>
        <span>{transfer.destinationType}:{transfer.destinationId}</span>
        <span>Events {transfer.events.length}</span>
        <span>Updated {transfer.lastUpdatedAt}</span>
      </div>

      <div className="detail-chip-grid">
        <div className="detail-chip"><span>Requested</span><strong>{totals.requestedQuantity}</strong></div>
        <div className="detail-chip"><span>Approved</span><strong>{totals.approvedQuantity}</strong></div>
        <div className="detail-chip"><span>Dispatched</span><strong>{totals.dispatchedQuantity}</strong></div>
        <div className="detail-chip"><span>Received</span><strong>{totals.receivedQuantity}</strong></div>
        <div className="detail-chip discrepancy"><span>Approval Gap</span><strong>{totals.approvalShortfallQuantity}</strong></div>
        <div className="detail-chip discrepancy"><span>Dispatch Gap</span><strong>{totals.dispatchShortfallQuantity}</strong></div>
        <div className="detail-chip discrepancy"><span>Receipt Gap</span><strong>{totals.receiptShortfallQuantity}</strong></div>
      </div>

      <div className="detail-lines">
        {lines.map((line) => (
          <div
            key={line.transferItemId}
            className={`warehouse-line-card ${
              line.hasApprovalShortfall || line.hasDispatchShortfall || line.hasReceiptShortfall
                ? "line-shortfall"
                : ""
            }`}
          >
            <div className="name">
              {line.productVariantId ? `${line.productId} / ${line.productVariantId}` : line.productId}
            </div>
            <div className="detail-line-grid muted">
              <span>req {line.requestedQuantity}</span>
              <span>app {line.approvedQuantity}</span>
              <span>disp {line.dispatchedQuantity}</span>
              <span>recv {line.receivedQuantity}</span>
              <span>app gap {line.approvalShortfallQuantity}</span>
              <span>disp gap {line.dispatchShortfallQuantity}</span>
              <span>recv gap {line.receiptShortfallQuantity}</span>
            </div>
          </div>
        ))}
      </div>

      {transfer.rejectionReason ? <div className="detail-reason">Rejection reason: {transfer.rejectionReason}</div> : null}
      {transfer.cancellationReason ? <div className="detail-reason">Cancellation reason: {transfer.cancellationReason}</div> : null}
      {transfer.notes ? <div className="detail-reason">Notes: {transfer.notes}</div> : null}

      {showReasonField ? (
        <label className="notes-field">
          <span className="muted">Lifecycle reason</span>
          <input
            type="text"
            placeholder="Reason for rejection or cancellation"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : null}

      <div className="secondary-actions">
        {canReject(transfer.status) ? (
          <button
            className="danger"
            onClick={() =>
              props.onReject({
                transferId: transfer.transferId,
                reason
              })
            }
          >
            Reject Transfer
          </button>
        ) : null}
        {canCancel(transfer.status) ? (
          <button
            className="danger"
            onClick={() =>
              props.onCancel({
                transferId: transfer.transferId,
                reason
              })
            }
          >
            Cancel Transfer
          </button>
        ) : null}
      </div>
    </section>
  );
}
