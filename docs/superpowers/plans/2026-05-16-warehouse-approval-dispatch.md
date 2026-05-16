# Warehouse Approval And Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the warehouse shell so operators can approve requested transfers and dispatch approved transfers from the selected transfer detail panel.

**Architecture:** Reuse the existing transfer sync event model and warehouse Electron service. Add approval/dispatch action builders in the warehouse app, expose them through the Electron IPC bridge, and render approval/dispatch editors in the selected transfer panel based on the projected transfer status.

**Tech Stack:** TypeScript, Node test runner, Electron, React, esbuild

---

### Task 1: Add failing tests for approval and dispatch builders and service flows

**Files:**
- Modify: `apps/warehouse/src/electron/warehouse-ui-service.test.ts`
- Create: `apps/warehouse/src/transfer-actions.test.ts`

- [ ] Add action-builder tests for valid approval payload generation.
- [ ] Add action-builder tests for valid dispatch payload generation.
- [ ] Add action-builder tests that reject approval quantities above requested.
- [ ] Add action-builder tests that reject dispatch quantities above approved.
- [ ] Add service tests for approving a requested transfer and dispatching an approved transfer.
- [ ] Run `npm.cmd run test --prefix apps/warehouse` and confirm the new tests fail for the missing behavior.

### Task 2: Implement approval and dispatch action builders

**Files:**
- Modify: `apps/warehouse/src/transfer-actions.ts`

- [ ] Add typed approval input and dispatch input shapes.
- [ ] Add helpers to build `STOCK_TRANSFER_APPROVED` and `STOCK_TRANSFER_DISPATCHED` envelopes.
- [ ] Add submit helpers that post those envelopes through `WarehouseBackendClient`.
- [ ] Re-run `npm.cmd run test --prefix apps/warehouse` until the builder tests pass.

### Task 3: Extend the warehouse Electron service and IPC bridge

**Files:**
- Modify: `apps/warehouse/src/electron/warehouse-ui-service.ts`
- Modify: `apps/warehouse/src/electron/ipc.ts`
- Modify: `apps/warehouse/src/electron/preload.ts`
- Modify: `apps/warehouse/src/electron/main.ts`
- Modify: `apps/warehouse/src/ui/global.d.ts`
- Modify: `apps/warehouse/src/ui/hooks/useWarehouseScreen.ts`

- [ ] Add `ApproveTransferCommand` and `DispatchTransferCommand`.
- [ ] Add `approveTransfer()` and `dispatchTransfer()` service methods with status eligibility checks.
- [ ] Expose both actions through IPC, preload, and renderer hook accessors.
- [ ] Re-run `npm.cmd run test --prefix apps/warehouse` until the service tests pass.

### Task 4: Add approval/dispatch editors to the transfer detail panel

**Files:**
- Modify: `apps/warehouse/src/ui/components/TransferDetailPanel.tsx`
- Modify: `apps/warehouse/src/ui/styles.css`
- Modify: `apps/warehouse/src/ui/App.tsx` only if wiring changes are needed

- [ ] Render approval quantity inputs when status is `requested`.
- [ ] Render dispatch quantity inputs when status is `approved`.
- [ ] Default approval quantities from requested values.
- [ ] Default dispatch quantities from approved values.
- [ ] Keep discrepancy detail visible while editing.
- [ ] Wire submit buttons to the new renderer actions.

### Task 5: Verify and update docs

**Files:**
- Modify: `apps/warehouse/src/README.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`

- [ ] Run:
  - `npm.cmd run test --prefix apps/warehouse`
  - `npm.cmd run typecheck --prefix apps/warehouse`
  - `npm.cmd run build --prefix apps/warehouse`
- [ ] Update the warehouse docs and top-level backlog to reflect approval/dispatch support.
- [ ] Commit the change set.
- [ ] Push to `origin/main`.
