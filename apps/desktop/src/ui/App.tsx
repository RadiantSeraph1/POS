import { CatalogPanel } from "./components/CatalogPanel.tsx";
import { CartPanel } from "./components/CartPanel.tsx";
import { CheckoutPanel } from "./components/CheckoutPanel.tsx";
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
      {pos.error ? <div className="error-banner">{pos.error}</div> : null}
      <div className="screen-grid">
        <CatalogPanel catalog={pos.snapshot.catalog} onAdd={pos.addCatalogItem} />
        <CartPanel
          cart={pos.snapshot.cart}
          onUpdateQuantity={pos.updateCartQuantity}
          onClearCart={pos.clearCart}
        />
        <div className="right-column">
          <CheckoutPanel
            cart={pos.snapshot.cart}
            payments={pos.snapshot.payments}
            onSetPayments={pos.setPayments}
            onSubmit={pos.submitSale}
          />
          <SyncStatusPanel
            sync={pos.snapshot.sync}
            inventory={pos.snapshot.inventory}
            lastSubmitResult={pos.snapshot.lastSubmitResult}
            onProcessSync={pos.processSyncQueue}
            onReset={pos.resetDemoState}
          />
        </div>
      </div>
    </main>
  );
}
