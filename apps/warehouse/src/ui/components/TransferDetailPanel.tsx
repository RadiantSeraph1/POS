import { useEffect, useState } from "react";

import type {
  ApproveTransferCommand,
  CancelTransferCommand,
  DispatchTransferCommand,
  RejectTransferCommand
} from "../../electron/warehouse-ui-service.ts";
import type { TransferDetailSummary } from "../../transfer-detail.ts";

function canApprove(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "requested";
}

function canDispatch(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "approved";
}

function canReject(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "requested";
}

function canCancel(status: TransferDetailSummary["transfer"]["status"]): boolean {
  return status === "requested" || status === "approved" || status === "dispatched";
}

function defaultQuantities(detail: TransferDetailSummary | null): Record<string, number> {
  if (!detail) {
    return {};
  }

  return Object.fromEntries(
    detail.lines.map((line) => [
      line.transferItemId,
      detail.transfer.status === "approved" ? line.approvedQuantity : line.requestedQuantity
    ])
  );
}

export function TransferDetailPanel(props: {
  detail: TransferDetailSummary | null;
  onApprove: (input: ApproveTransferCommand) => void;
  onDispatch: (input: DispatchTransferCommand) => void;
  onReject: (input: RejectTransferCommand) => void;
  onCancel: (input: CancelTransferCommand) => void;
}) {
  const [reason, setReason] = useState("");
  const [quantitiesByTransferItemId, setQuantitiesByTransferItemId] = useState<Record<string, number>>({});

  useEffect(() => {
    setReason("");
    setQuantitiesByTransferItemId(defaultQuantities(props.detail));
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
  const showReasonField =
    !canApprove(transfer.status) && !canDispatch(transfer.status) && (canReject(transfer.status) || canCancel(transfer.status));

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
            {canApprove(transfer.status) ? (
              <label className="compact-field action-editor">
                <span className="muted">Approve quantity</span>
                <input
                  type="number"
                  min="0"
                  max={line.requestedQuantity}
                  step="1"
                  value={String(quantitiesByTransferItemId[line.transferItemId] ?? line.requestedQuantity)}
                  onChange={(event) =>
                    setQuantitiesByTransferItemId((current) => ({
                      ...current,
                      [line.transferItemId]: Math.max(0, Math.floor(Number(event.target.value) || 0))
                    }))
                  }
                />
              </label>
            ) : null}
            {canDispatch(transfer.status) ? (
              <label className="compact-field action-editor">
                <span className="muted">Dispatch quantity</span>
                <input
                  type="number"
                  min="0"
                  max={line.approvedQuantity}
                  step="1"
                  value={String(quantitiesByTransferItemId[line.transferItemId] ?? line.approvedQuantity)}
                  onChange={(event) =>
                    setQuantitiesByTransferItemId((current) => ({
                      ...current,
                      [line.transferItemId]: Math.max(0, Math.floor(Number(event.target.value) || 0))
                    }))
                  }
                />
              </label>
            ) : null}
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
        {canApprove(transfer.status) ? (
          <button
            className="primary"
            onClick={() =>
              props.onApprove({
                transferId: transfer.transferId,
                quantitiesByTransferItemId
              })
            }
          >
            Approve Transfer
          </button>
        ) : null}
        {canDispatch(transfer.status) ? (
          <button
            className="primary"
            onClick={() =>
              props.onDispatch({
                transferId: transfer.transferId,
                quantitiesByTransferItemId
              })
            }
          >
            Dispatch Transfer
          </button>
        ) : null}
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
