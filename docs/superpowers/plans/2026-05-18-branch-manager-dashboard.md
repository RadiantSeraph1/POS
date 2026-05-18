# Branch Manager Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lightweight Branch Manager dashboard with a real hybrid manager command-center page in the desktop shell and browser preview.

**Architecture:** Keep the existing `PosScreenSnapshot` as the only state contract and expand `BranchManagerDashboardPanel` into a composed manager page. Derive all metrics locally in the UI layer, add a focused render test for the manager page, and update styles and docs without introducing a second service or API seam.

**Tech Stack:** React 19, TypeScript, Node test runner, `react-dom/server`, existing desktop browser preview and Electron shell

---

## File Structure

### Existing files to modify

- `apps/desktop/src/ui/components/BranchManagerDashboardPanel.tsx`
  - expand from a simple four-panel page into the approved hybrid dashboard
- `apps/desktop/src/ui/styles.css`
  - add manager-specific layout, KPI, action-lane, and split-column styles
- `apps/desktop/src/README.md`
  - update the desktop UI capability summary
- `README.md`
  - update the top-level summary for the desktop manager surface
- `docs/NEXT_STEPS.md`
  - update the implemented capability list and next UI gap

### New files to create

- `apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx`
  - render-level smoke test for the manager dashboard using `react-dom/server`

No service, preload, or Electron main-process changes are required for this slice.

---

### Task 1: Add a Manager Dashboard Render Test

**Files:**
- Create: `apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx`
- Inspect: `apps/desktop/src/ui/components/BranchManagerDashboardPanel.tsx`
- Test: `apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BranchManagerDashboardPanel } from "./BranchManagerDashboardPanel.tsx";

test("BranchManagerDashboardPanel renders the hybrid manager dashboard sections", () => {
  const markup = renderToStaticMarkup(
    <BranchManagerDashboardPanel
      shift={{
        salesCount: 6,
        grossTotalMinor: 286500,
        syncedSalesCount: 4,
        attentionSalesCount: 2,
        deadLetterSalesCount: 1,
        suspendedDraftCount: 2,
        openCartLineCount: 1,
        readyToClose: false,
        blockers: ["1 dead-letter sale(s)", "2 suspended draft(s)"]
      }}
      sync={{
        pending: 1,
        processing: 0,
        synced: 4,
        failed: 1,
        deadLetter: 1,
        lastError: "HTTP request failed: backend not reachable"
      }}
      inventory={[
        { productId: "prod-a", sellableQuantity: 3 },
        { productId: "prod-b", productVariantId: "var-b", sellableQuantity: 9 }
      ]}
      recentSales={[
        {
          saleId: "sale-1",
          saleNumber: "POS-24051",
          totalMinor: 93750,
          happenedAt: "2026-05-18T09:00:00.000Z",
          syncStatus: "failed",
          eventId: "event-1",
          retryCount: 2,
          itemCount: 2,
          items: [{ name: "PVC Pipe 110mm", quantity: 1, lineTotalMinor: 50000 }],
          payments: [{ method: "cash", amountMinor: 50000 }]
        }
      ]}
      suspendedSales={[
        {
          id: "suspend-1",
          label: "Site Counter Hold",
          totalMinor: 6250,
          itemCount: 1,
          updatedAt: "2026-05-18T09:10:00.000Z"
        }
      ]}
    />
  );

  assert.match(markup, /Sales Today/);
  assert.match(markup, /Transaction Count/);
  assert.match(markup, /Sync Attention/);
  assert.match(markup, /Shift-Close Blockers/);
  assert.match(markup, /Action Queue/);
  assert.match(markup, /Team Activity/);
  assert.match(markup, /Stock Risk/);
  assert.match(markup, /Recent Sales/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test --test-isolation=none "apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx"
```

Expected: FAIL because the current dashboard does not yet render the new section labels and structure.

- [ ] **Step 3: Commit the failing test**

```powershell
git add apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx
git commit -m "test: define Branch Manager dashboard structure"
```

---

### Task 2: Rebuild the Branch Manager Dashboard

**Files:**
- Modify: `apps/desktop/src/ui/components/BranchManagerDashboardPanel.tsx`
- Test: `apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx`

- [ ] **Step 1: Replace the panel with a composed hybrid dashboard**

Use focused local helpers inside `BranchManagerDashboardPanel.tsx` to derive:

- KPI cards
- action queue summary
- team activity summary
- stock risk list
- sync health summary
- blocker list
- recent sales list
- short trend summary

Implementation target:

```tsx
function countLowStockLines(inventory: PosScreenSnapshot["inventory"]): number {
  return inventory.filter((line) => line.sellableQuantity <= 5).length;
}

function buildPrimaryAction(props: BranchManagerDashboardProps): string {
  if (props.shift.deadLetterSalesCount > 0) {
    return `${props.shift.deadLetterSalesCount} dead-letter sale(s) require root-cause review`;
  }
  if (countLowStockLines(props.inventory) > 0) {
    return `${countLowStockLines(props.inventory)} stock line(s) are at or below threshold`;
  }
  if (props.suspendedSales.length > 0) {
    return `${props.suspendedSales.length} suspended cashier draft(s) need follow-up`;
  }
  return "No urgent branch actions right now";
}

function buildLatestActivity(recentSales: PosScreenSnapshot["recovery"]["recentSales"]): string {
  const latest = recentSales[0];
  if (!latest) {
    return "No completed sales yet";
  }
  return `${latest.saleNumber} at ${latest.happenedAt}`;
}
```

Render structure target:

```tsx
return (
  <section className="manager-dashboard">
    <section className="manager-kpi-row">
      {/* Sales Today */}
      {/* Transaction Count */}
      {/* Sync Attention */}
      {/* Shift-Close Blockers */}
    </section>

    <section className="manager-action-lane">
      <section className="panel">{/* Action Queue */}</section>
      <section className="panel">{/* Team Activity */}</section>
    </section>

    <section className="manager-split-layout">
      <div className="manager-ops-column">
        {/* Stock Risk */}
        {/* Sync Health */}
        {/* Open Blockers */}
      </div>
      <div className="manager-performance-column">
        {/* Recent Sales */}
        {/* Cashier Activity */}
        {/* Short Trend */}
      </div>
    </section>
  </section>
);
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
node --test --test-isolation=none "apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx"
```

Expected: PASS

- [ ] **Step 3: Manually inspect the rendered manager page in browser preview**

Run:

```powershell
npm.cmd run dev:web --prefix apps/desktop
```

Expected:

- browser preview starts on `http://127.0.0.1:4173`
- `Branch Manager -> Dashboard` shows the new KPI row, action lane, and split lower layout

- [ ] **Step 4: Commit the dashboard component**

```powershell
git add apps/desktop/src/ui/components/BranchManagerDashboardPanel.tsx apps/desktop/src/ui/components/BranchManagerDashboardPanel.test.tsx
git commit -m "feat: rebuild Branch Manager dashboard"
```

---

### Task 3: Add Manager Dashboard Styling and Documentation

**Files:**
- Modify: `apps/desktop/src/ui/styles.css`
- Modify: `apps/desktop/src/README.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Verify: `apps/desktop/src/ui/App.tsx`

- [ ] **Step 1: Add manager-specific layout and card styles**

Add CSS blocks for:

- `.manager-dashboard`
- `.manager-kpi-row`
- `.manager-kpi-card`
- `.manager-action-lane`
- `.manager-split-layout`
- `.manager-ops-column`
- `.manager-performance-column`
- `.manager-list-card`
- `.manager-trend-grid`

Style target:

```css
.manager-dashboard {
  display: grid;
  gap: 1rem;
}

.manager-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.manager-kpi-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(252,249,243,0.94) 100%);
  display: grid;
  gap: 0.35rem;
}

.manager-action-lane,
.manager-split-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
```

Also add responsive collapse rules under the existing mobile breakpoint so the manager layout stacks correctly in browser preview.

- [ ] **Step 2: Update documentation**

Update the desktop docs to explicitly state that the Branch Manager role now includes:

- balanced KPI header
- alert and team activity lane
- stock risk, sync health, blocker, recent-sales, and trend panels

Text to add or adapt:

```md
- expanded Branch Manager dashboard with balanced KPI header, mixed alert/activity lane, and split operational/performance layout
```

- [ ] **Step 3: Run the full desktop verification gate**

Run:

```powershell
npm.cmd run test --prefix apps/desktop
npm.cmd run typecheck --prefix apps/desktop
npm.cmd run build --prefix apps/desktop
```

Expected:

- all desktop tests pass
- no TypeScript errors
- browser/Electron bundles build successfully

- [ ] **Step 4: Commit the styling and docs**

```powershell
git add apps/desktop/src/ui/styles.css apps/desktop/src/README.md README.md docs/NEXT_STEPS.md
git commit -m "docs: record Branch Manager dashboard baseline"
```

---

## Self-Review

### Spec coverage

- KPI header row: covered in Task 2 render structure and Task 3 styling
- mixed action lane: covered in Task 2 render structure and helper derivation
- lower split layout: covered in Task 2 render structure and Task 3 styling
- current snapshot-only data mapping: covered in Task 2 helper derivation; no service changes planned
- responsive behavior: covered in Task 3 CSS additions
- verification in browser preview and desktop build gates: covered in Tasks 2 and 3

No spec gaps remain.

### Placeholder scan

Plan checked for:

- `TODO`
- `TBD`
- vague “add validation” phrasing
- “similar to”

No unresolved placeholders remain.

### Type consistency

The plan consistently uses:

- `BranchManagerDashboardPanel`
- `PosScreenSnapshot`
- `shift`
- `sync`
- `inventory`
- `recentSales`
- `suspendedSales`

No conflicting names were introduced.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-branch-manager-dashboard.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

In this thread, inline execution is the practical path unless you explicitly want subagents. If you want me to proceed now, I’ll execute it inline.
