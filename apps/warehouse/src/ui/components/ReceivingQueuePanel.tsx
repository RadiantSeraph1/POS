import { useEffect, useState } from "react";

import type { ReceiveTransferCommand, WarehouseShellSnapshot } from "../../electron/warehouse-ui-service.ts";

type QueueTransfer = WarehouseShellSnapshot["queue"]["transfers"][number];

function buildDefaultQuantities(transfer: QueueTransfer): Record<string, number> {
  return Object.fromEntries(
    transfer.lines.map((line) => [line.transferItemId, line.outstandingQuantity])
  );
}

export function ReceivingQueuePanel(props: {
  queue: WarehouseShellSnapshot["queue"];
  onReceive: (input: ReceiveTransferCommand) => void;
  onSeedDemo: () => void;
}) {
  const [quantitiesByTransferId, setQuantitiesByTransferId] = useState<Record<string, Record<string, number>>>({});
  const [notesByTransferId, setNotesByTransferId] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextQuantities: Record<string, Record<string, number>> = {};
    for (const transfer of props.queue.transfers) {
      nextQuantities[transfer.transferId] = buildDefaultQuantities(transfer);
    }
    setQuantitiesByTransferId(nextQuantities);
  }, [props.queue]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Inbound Receiving Queue</h2>
          <p className="muted">Actionable inbound transfers for branch receiving.</p>
        </div>
        <button onClick={props.onSeedDemo}>Load Demo Transfer</button>
      </div>
      {props.queue.transfers.length === 0 ? <p className="muted">No inbound transfers ready to receive.</p> : null}
      <div className="warehouse-list">
        {props.queue.transfers.map((transfer) => (
          <div key={transfer.transferId} className="warehouse-card">
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
              <span>Outstanding {transfer.totalOutstandingQuantity}</span>
              <span>Updated {transfer.lastUpdatedAt}</span>
            </div>
            <div className="warehouse-lines">
              {transfer.lines.map((line) => (
                <div key={line.transferItemId} className="warehouse-line-card">
                  <div>
                    <div className="name">
                      {line.productVariantId
                        ? `${line.productId} / ${line.productVariantId}`
                        : line.productId}
                    </div>
                    <div className="muted">
                      req {line.requestedQuantity} | app {line.approvedQuantity} | disp {line.dispatchedQuantity} | recv {line.receivedQuantity}
                    </div>
                  </div>
                  <label className="compact-field">
                    <span className="muted">Receive now</span>
                    <input
                      type="number"
                      min="0"
                      max={line.outstandingQuantity}
                      step="1"
                      value={String(quantitiesByTransferId[transfer.transferId]?.[line.transferItemId] ?? 0)}
                      onChange={(event) =>
                        setQuantitiesByTransferId((current) => ({
                          ...current,
                          [transfer.transferId]: {
                            ...current[transfer.transferId],
                            [line.transferItemId]: Math.max(0, Math.floor(Number(event.target.value) || 0))
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <label className="notes-field">
              <span className="muted">Notes</span>
              <input
                type="text"
                placeholder="Receiving notes"
                value={notesByTransferId[transfer.transferId] ?? ""}
                onChange={(event) =>
                  setNotesByTransferId((current) => ({
                    ...current,
                    [transfer.transferId]: event.target.value
                  }))
                }
              />
            </label>
            <div className="checkout-actions">
              <button
                className="primary"
                onClick={() =>
                  props.onReceive({
                    transferId: transfer.transferId,
                    quantitiesByTransferItemId:
                      quantitiesByTransferId[transfer.transferId] ?? buildDefaultQuantities(transfer),
                    ...(notesByTransferId[transfer.transferId]
                      ? { notes: notesByTransferId[transfer.transferId] }
                      : {})
                  })
                }
              >
                Receive Transfer
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
