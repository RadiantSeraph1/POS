import { ReceivingQueuePanel } from "./components/ReceivingQueuePanel.tsx";
import { TransferDashboardPanel } from "./components/TransferDashboardPanel.tsx";
import { useWarehouseScreen } from "./hooks/useWarehouseScreen.ts";

export function App() {
  const warehouse = useWarehouseScreen();

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
        />
        <TransferDashboardPanel
          dashboard={warehouse.snapshot.dashboard}
          backendMode={warehouse.snapshot.backendMode}
          baseUrl={warehouse.snapshot.baseUrl}
        />
      </div>
    </main>
  );
}
