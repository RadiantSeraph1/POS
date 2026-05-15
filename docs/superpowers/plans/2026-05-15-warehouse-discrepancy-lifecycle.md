# Warehouse Discrepancy And Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the warehouse shell and transfer replay stack with discrepancy detail plus rejected/cancelled transfer lifecycle events.

**Architecture:** Add new transfer lifecycle events to the shared sync contract, project them through backend replay and reconciliation, and expose the resulting state through the warehouse Electron service and React shell. Keep the receiving queue/action flow event-driven and derive all dashboard/detail state from the backend event stream.

**Tech Stack:** TypeScript, Node test runner, Electron, React, esbuild, SQLite dev sync repository, PostgreSQL replay/reconciliation layer

---

### Task 1: Add failing tests for new transfer lifecycle contracts and projections

**Files:**
- Modify: `apps/backend/src/sync/repository.test.ts`
- Modify: `apps/backend/src/sync/transfer-replay.test.ts`
- Modify: `apps/warehouse/src/receiving-model.test.ts`
- Create: `apps/warehouse/src/transfer-detail.test.ts`

- [ ] Add repository tests proving rejected/cancelled events use the correct actor field.
- [ ] Add replay tests proving rejected/cancelled events update `stock_transfers.status`.
- [ ] Add warehouse projection tests proving rejected/cancelled transfers drop out of the actionable receiving queue.
- [ ] Add transfer-detail tests proving discrepancy totals and shortfall fields are computed correctly.
- [ ] Run the targeted tests and confirm they fail for the new behavior.

### Task 2: Implement shared transfer event contracts and backend ingestion support

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/backend/src/sync/repository.ts`

- [ ] Add `STOCK_TRANSFER_REJECTED` and `STOCK_TRANSFER_CANCELLED` to the shared event union.
- [ ] Add rejected/cancelled payload interfaces.
- [ ] Extend actor resolution in backend repository ingestion.
- [ ] Re-run the repository tests until green.

### Task 3: Implement backend replay and reconciliation for rejected/cancelled transfers

**Files:**
- Modify: `apps/backend/src/sync/transfer-replay.ts`
- Modify: `apps/backend/src/sync/reconciliation.ts`
- Modify: `apps/backend/src/sync/index.ts` if exports need updating

- [ ] Add payload parsers and replay handlers for rejected/cancelled events.
- [ ] Extend pending replay event selection to include the new event types.
- [ ] Update reconciliation expected-status logic to accept rejected/cancelled terminal states.
- [ ] Run backend transfer replay/reconciliation tests until green.

### Task 4: Implement warehouse discrepancy/detail projection and action helpers

**Files:**
- Modify: `apps/warehouse/src/models.ts`
- Modify: `apps/warehouse/src/projector.ts`
- Modify: `apps/warehouse/src/receiving-model.ts`
- Create: `apps/warehouse/src/transfer-detail.ts`
- Create: `apps/warehouse/src/transfer-actions.ts`

- [ ] Extend transfer status model with rejected/cancelled.
- [ ] Add derived transfer-detail and discrepancy summary helpers.
- [ ] Add reject/cancel action builders that generate sync events with required reasons and timestamps.
- [ ] Keep receiving-queue derivation limited to actionable statuses.
- [ ] Run the new warehouse projection tests until green.

### Task 5: Extend warehouse Electron service and IPC surface

**Files:**
- Modify: `apps/warehouse/src/electron/warehouse-ui-service.ts`
- Modify: `apps/warehouse/src/electron/warehouse-ui-service.test.ts`
- Modify: `apps/warehouse/src/electron/ipc.ts`
- Modify: `apps/warehouse/src/electron/preload.ts`
- Modify: `apps/warehouse/src/electron/main.ts`
- Modify: `apps/warehouse/src/ui/global.d.ts`
- Modify: `apps/warehouse/src/ui/hooks/useWarehouseScreen.ts`

- [ ] Add selected transfer detail to the shell snapshot.
- [ ] Add `selectTransfer`, `rejectTransfer`, and `cancelTransfer` flows.
- [ ] Make service status messages explicit for success and invalid-state failures.
- [ ] Run warehouse service tests until green.

### Task 6: Build the warehouse UI detail/discrepancy surface

**Files:**
- Modify: `apps/warehouse/src/ui/App.tsx`
- Modify: `apps/warehouse/src/ui/components/ReceivingQueuePanel.tsx`
- Modify: `apps/warehouse/src/ui/components/TransferDashboardPanel.tsx`
- Create: `apps/warehouse/src/ui/components/TransferDetailPanel.tsx`
- Modify: `apps/warehouse/src/ui/styles.css`

- [ ] Add transfer selection in the queue and dashboard.
- [ ] Add a right-side detail panel with header status, event count, discrepancy chips, line-level shortfall table, and notes/reason display.
- [ ] Add reject/cancel controls with reason entry and eligibility gating.
- [ ] Preserve receiving as the only quantity mutation flow.
- [ ] Run warehouse typecheck and build until green.

### Task 7: Verify end to end, update docs, and publish

**Files:**
- Modify: `apps/warehouse/src/README.md`
- Modify: `apps/backend/src/README.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`

- [ ] Run:
  - `npm.cmd run test --prefix apps/backend`
  - `npm.cmd run test --prefix apps/warehouse`
  - `npm.cmd run typecheck --prefix apps/warehouse`
  - `npm.cmd run build --prefix apps/warehouse`
- [ ] Update docs to describe discrepancy detail plus reject/cancel lifecycle support.
- [ ] Commit with a focused message.
- [ ] Push to `origin/main`.
