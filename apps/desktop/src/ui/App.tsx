import { CatalogPanel } from "./components/CatalogPanel.tsx";
import { CartPanel } from "./components/CartPanel.tsx";
import { CheckoutPanel } from "./components/CheckoutPanel.tsx";
import { RecoveryPanel } from "./components/RecoveryPanel.tsx";
import { ShiftSummaryPanel } from "./components/ShiftSummaryPanel.tsx";
import { SuspendedSalesPanel } from "./components/SuspendedSalesPanel.tsx";
import { SyncStatusPanel } from "./components/SyncStatusPanel.tsx";
import { usePosScreen } from "./hooks/usePosScreen.ts";

export function App() {
  const pos = usePosScreen();

  if (pos.isLoading) {
    return (
      <main className="app-shell">
        <p>Loading POS shell...</p>
      </main>
    );
  }

  if (!pos.snapshot) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <h1>PipeFlow POS</h1>
          <p className="muted">Offline-first cashier shell</p>
        </header>
        <div className="error-banner">
          {pos.error ?? "The POS shell could not load its local state."}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>PipeFlow POS</h1>
        <p className="muted">Offline-first cashier shell</p>
      </header>
      {pos.snapshot.status ? (
        <div className={`status-banner status-${pos.snapshot.status.kind}`}>
          {pos.snapshot.status.message}
        </div>
      ) : null}
      {pos.error ? <div className="error-banner">{pos.error}</div> : null}
      <div className="screen-grid">
        <CatalogPanel catalog={pos.snapshot.catalog} onAdd={pos.addCatalogItem} />
        <CartPanel
          cart={pos.snapshot.cart}
          onUpdateQuantity={pos.updateCartQuantity}
          onClearCart={pos.clearCart}
          onSuspendSale={() => pos.suspendCurrentSale()}
        />
        <div className="right-column">
          <CheckoutPanel
            cart={pos.snapshot.cart}
            payments={pos.snapshot.payments}
            onSetPayments={pos.setPayments}
            onSubmit={pos.submitSale}
          />
          <ShiftSummaryPanel shift={pos.snapshot.reporting.shift} />
          <SyncStatusPanel
            sync={pos.snapshot.sync}
            inventory={pos.snapshot.inventory}
            lastSubmitResult={pos.snapshot.lastSubmitResult}
            onProcessSync={pos.processSyncQueue}
            onReset={pos.resetDemoState}
          />
          <RecoveryPanel
            recovery={pos.snapshot.recovery}
            onRetryOne={pos.retryQueueItem}
            onRetryAll={pos.retryAllQueueItems}
          />
          <SuspendedSalesPanel
            suspendedSales={pos.snapshot.suspendedSales}
            onResume={pos.resumeSuspendedSale}
            onDelete={pos.deleteSuspendedSale}
          />
        </div>
      </div>
    </main>
  );
}
