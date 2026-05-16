import { useEffect, useState } from "react";

import { summarizeTransferDetail } from "../transfer-detail.ts";
import { ReceivingQueuePanel } from "./components/ReceivingQueuePanel.tsx";
import { TransferDashboardPanel } from "./components/TransferDashboardPanel.tsx";
import { TransferDetailPanel } from "./components/TransferDetailPanel.tsx";
import { useWarehouseScreen } from "./hooks/useWarehouseScreen.ts";

export function App() {
  const warehouse = useWarehouseScreen();
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  useEffect(() => {
    if (!warehouse.snapshot) {
      setSelectedTransferId(null);
      return;
    }

    const stillExists = warehouse.snapshot.dashboard.transfers.some(
      (transfer) => transfer.transferId === selectedTransferId
    );
    if (stillExists) {
      return;
    }

    setSelectedTransferId(
      warehouse.snapshot.queue.transfers[0]?.transferId ??
        warehouse.snapshot.dashboard.transfers[0]?.transferId ??
        null
    );
  }, [selectedTransferId, warehouse.snapshot]);

  if (warehouse.isLoading) {
    return (
      <main className="warehouse-shell">
        <p>Loading warehouse shell...</p>
      </main>
    );
  }

  if (!warehouse.snapshot) {
    return (
      <main className="warehouse-shell">
        <header className="topbar">
          <h1>PipeFlow Warehouse</h1>
          <p className="muted">Receiving-first transfer shell</p>
        </header>
        <div className="error-banner">
          {warehouse.error ?? "The warehouse shell could not load backend state."}
        </div>
      </main>
    );
  }

  const selectedTransfer =
    warehouse.snapshot.dashboard.transfers.find((transfer) => transfer.transferId === selectedTransferId) ?? null;
  const selectedDetail = selectedTransfer ? summarizeTransferDetail(selectedTransfer) : null;

  return (
    <main className="warehouse-shell">
      <header className="topbar">
        <h1>PipeFlow Warehouse</h1>
        <p className="muted">Receiving-first transfer shell</p>
      </header>
      {warehouse.snapshot.status ? (
        <div className={`status-banner status-${warehouse.snapshot.status.kind}`}>
          {warehouse.snapshot.status.message}
        </div>
      ) : null}
      {warehouse.error ? <div className="error-banner">{warehouse.error}</div> : null}
      <div className="warehouse-grid">
        <ReceivingQueuePanel
          queue={warehouse.snapshot.queue}
          onSeedDemo={warehouse.seedDemoLifecycle}
          onReceive={warehouse.receiveTransfer}
          onSelectTransfer={setSelectedTransferId}
          selectedTransferId={selectedTransferId}
        />
        <div className="warehouse-right-column">
          <TransferDashboardPanel
            dashboard={warehouse.snapshot.dashboard}
            backendMode={warehouse.snapshot.backendMode}
            baseUrl={warehouse.snapshot.baseUrl}
            onSelectTransfer={setSelectedTransferId}
            selectedTransferId={selectedTransferId}
          />
          <TransferDetailPanel
            detail={selectedDetail}
            onApprove={warehouse.approveTransfer}
            onDispatch={warehouse.dispatchTransfer}
            onReject={warehouse.rejectTransfer}
            onCancel={warehouse.cancelTransfer}
          />
        </div>
      </div>
    </main>
  );
}
