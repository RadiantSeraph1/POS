import { useMemo, useState } from "react";

import { BranchManagerDashboardPanel } from "./components/BranchManagerDashboardPanel.tsx";
import { CatalogPanel } from "./components/CatalogPanel.tsx";
import { CartPanel } from "./components/CartPanel.tsx";
import { CheckoutPanel } from "./components/CheckoutPanel.tsx";
import { RecoveryPanel } from "./components/RecoveryPanel.tsx";
import { RolePlaceholderPanel } from "./components/RolePlaceholderPanel.tsx";
import { ShiftSummaryPanel } from "./components/ShiftSummaryPanel.tsx";
import { SuspendedSalesPanel } from "./components/SuspendedSalesPanel.tsx";
import { SyncStatusPanel } from "./components/SyncStatusPanel.tsx";
import { usePosScreen } from "./hooks/usePosScreen.ts";

type AppRole = "cashier" | "manager" | "warehouse" | "accountant" | "admin";
type CashierPage = "workspace" | "recovery" | "suspended" | "shift";
type ManagerPage = "dashboard" | "inventory" | "sales";

const ROLE_LABELS: Record<AppRole, string> = {
  cashier: "Cashier",
  manager: "Branch Manager",
  warehouse: "Warehouse",
  accountant: "Accountant",
  admin: "Admin"
};

export function App() {
  const pos = usePosScreen();
  const [activeRole, setActiveRole] = useState<AppRole>("cashier");
  const [cashierPage, setCashierPage] = useState<CashierPage>("workspace");
  const [managerPage, setManagerPage] = useState<ManagerPage>("dashboard");

  const pageTitle = useMemo(() => {
    if (activeRole === "cashier") {
      return {
        title: {
          workspace: "POS Workspace",
          recovery: "Recovery / Sync",
          suspended: "Suspended Sales",
          shift: "Shift History"
        }[cashierPage],
        subtitle: {
          workspace: "Fast checkout workspace with compact operational panels",
          recovery: "Queue recovery, recent sales, and sync investigation",
          suspended: "Resume or delete held cashier drafts",
          shift: "Local shift summary and close-readiness view"
        }[cashierPage]
      };
    }

    if (activeRole === "manager") {
      return {
        title: {
          dashboard: "Branch Dashboard",
          inventory: "Inventory Overview",
          sales: "Sales Overview"
        }[managerPage],
        subtitle: {
          dashboard: "High-level branch operating state",
          inventory: "Inventory attention lines from the local branch snapshot",
          sales: "Recent sales and cashier execution summary"
        }[managerPage]
      };
    }

    return {
      title: ROLE_LABELS[activeRole],
      subtitle: "Planned role area in the shared left-rail workspace"
    };
  }, [activeRole, cashierPage, managerPage]);

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
    <main className="workspace-shell">
      <aside className="app-rail">
        <div className="rail-brand">
          <h1>PipeFlow</h1>
          <p className="muted">RetailOS</p>
        </div>
        <nav className="rail-nav">
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
            <button
              key={role}
              className={`rail-link ${activeRole === role ? "rail-link-active" : ""}`}
              onClick={() => setActiveRole(role)}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <div className="label">{ROLE_LABELS[activeRole]}</div>
            <h2>{pageTitle.title}</h2>
            <p className="muted">{pageTitle.subtitle}</p>
          </div>
          <div className="workspace-chip">
            <span>Mode</span>
            <strong>{activeRole === "cashier" || activeRole === "warehouse" ? "Operational" : "Enterprise"}</strong>
          </div>
        </header>

        {pos.snapshot.status ? (
          <div className={`status-banner status-${pos.snapshot.status.kind}`}>
            {pos.snapshot.status.message}
          </div>
        ) : null}
        {pos.error ? <div className="error-banner">{pos.error}</div> : null}

        {activeRole === "cashier" ? (
          <>
            <div className="subnav">
              <button className={cashierPage === "workspace" ? "primary" : ""} onClick={() => setCashierPage("workspace")}>
                POS Workspace
              </button>
              <button className={cashierPage === "recovery" ? "primary" : ""} onClick={() => setCashierPage("recovery")}>
                Recovery / Sync
              </button>
              <button className={cashierPage === "suspended" ? "primary" : ""} onClick={() => setCashierPage("suspended")}>
                Suspended Sales
              </button>
              <button className={cashierPage === "shift" ? "primary" : ""} onClick={() => setCashierPage("shift")}>
                Shift History
              </button>
            </div>

            {cashierPage === "workspace" ? (
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
                  <SyncStatusPanel
                    sync={pos.snapshot.sync}
                    inventory={pos.snapshot.inventory}
                    lastSubmitResult={pos.snapshot.lastSubmitResult}
                    onProcessSync={pos.processSyncQueue}
                    onReset={pos.resetDemoState}
                  />
                </div>
              </div>
            ) : null}

            {cashierPage === "recovery" ? (
              <RecoveryPanel
                recovery={pos.snapshot.recovery}
                onRetryOne={pos.retryQueueItem}
                onRetryAll={pos.retryAllQueueItems}
              />
            ) : null}

            {cashierPage === "suspended" ? (
              <SuspendedSalesPanel
                suspendedSales={pos.snapshot.suspendedSales}
                onResume={pos.resumeSuspendedSale}
                onDelete={pos.deleteSuspendedSale}
              />
            ) : null}

            {cashierPage === "shift" ? <ShiftSummaryPanel shift={pos.snapshot.reporting.shift} /> : null}
          </>
        ) : null}

        {activeRole === "manager" ? (
          <>
            <div className="subnav">
              <button className={managerPage === "dashboard" ? "primary" : ""} onClick={() => setManagerPage("dashboard")}>
                Dashboard
              </button>
              <button className={managerPage === "inventory" ? "primary" : ""} onClick={() => setManagerPage("inventory")}>
                Inventory
              </button>
              <button className={managerPage === "sales" ? "primary" : ""} onClick={() => setManagerPage("sales")}>
                Sales
              </button>
            </div>

            {managerPage === "dashboard" ? (
              <BranchManagerDashboardPanel
                shift={pos.snapshot.reporting.shift}
                sync={pos.snapshot.sync}
                inventory={pos.snapshot.inventory}
                recentSales={pos.snapshot.recovery.recentSales}
                suspendedSales={pos.snapshot.suspendedSales}
              />
            ) : null}

            {managerPage === "inventory" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Inventory Overview</h2>
                    <p className="muted">Branch-local sellable stock view</p>
                  </div>
                </div>
                <div className="inventory-list">
                  {pos.snapshot.inventory.map((line) => (
                    <div key={`${line.productId}:${line.productVariantId ?? "base"}`} className="inventory-line">
                      <span>{line.productVariantId ? `${line.productId} / ${line.productVariantId}` : line.productId}</span>
                      <span className={line.sellableQuantity <= 5 ? "error-text" : ""}>{line.sellableQuantity}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {managerPage === "sales" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Sales Overview</h2>
                    <p className="muted">Recent branch sales with sync state</p>
                  </div>
                </div>
                <div className="recovery-list">
                  {pos.snapshot.recovery.recentSales.map((sale) => (
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
                        <span>{sale.itemCount} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {activeRole === "warehouse" ? (
          <RolePlaceholderPanel
            roleName="Warehouse"
            summary="Transfer board, approval, dispatch, and receiving remain in the warehouse app shell and are next to align visually."
            pages={["Transfer Board", "Approval / Dispatch", "Receiving Queue", "Warehouse History"]}
          />
        ) : null}

        {activeRole === "accountant" ? (
          <RolePlaceholderPanel
            roleName="Accountant"
            summary="Finance views will sit on replayed and reconciled cloud state rather than branch-local transaction state."
            pages={["Sales Ledger", "Payment Review", "Tax Reports", "Adjustments / Audit"]}
          />
        ) : null}

        {activeRole === "admin" ? (
          <RolePlaceholderPanel
            roleName="Admin"
            summary="System setup pages will come after real auth, user/device identity, and settings flows are implemented."
            pages={["Users & Roles", "Devices", "Catalog Setup", "Organization Settings"]}
          />
        ) : null}
      </section>
    </main>
  );
}
