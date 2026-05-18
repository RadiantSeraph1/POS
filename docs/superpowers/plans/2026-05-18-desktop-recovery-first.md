# Desktop Recovery-First Cashier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detailed queue recovery visibility and retry controls to the Electron cashier shell.

**Architecture:** Extend the desktop POS service with local queries for recent sales and sync queue records, add recovery actions that reset failed/dead-letter records back to pending, and render that data in a dedicated recovery panel inside the existing single-screen cashier shell.

**Tech Stack:** TypeScript, Node test runner, Electron, React, SQLite via `node:sqlite`

---

### Task 1: Add failing service tests for recovery data and retry actions

**Files:**
- Modify: `apps/desktop/src/electron/desktop-pos-service.test.ts`

- [ ] Add a test that committed sales appear in recent local sale history with queue status.
- [ ] Add a test that a failed or dead-letter queue record appears in recovery data.
- [ ] Add a test that retrying one recoverable queue record resets it to `pending`.
- [ ] Add a test that retrying all recoverable queue records resets each failed/dead-letter record to `pending`.
- [ ] Run `npm.cmd run test --prefix apps/desktop` and confirm the new tests fail for the missing behavior.

### Task 2: Extend the desktop POS service snapshot and queue reset actions

**Files:**
- Modify: `apps/desktop/src/electron/desktop-pos-service.ts`

- [ ] Add snapshot types for recent sales and detailed queue records.
- [ ] Add local query helpers for recent sales and sync queue rows.
- [ ] Add `retryQueueRecord(recordId)` with recoverable-state validation.
- [ ] Add `retryAllRecoverableQueueRecords()` with informative status when nothing is recoverable.
- [ ] Re-run `npm.cmd run test --prefix apps/desktop` until the new service tests pass.

### Task 3: Expose recovery actions through the Electron bridge

**Files:**
- Modify: `apps/desktop/src/electron/ipc.ts`
- Modify: `apps/desktop/src/electron/preload.ts`
- Modify: `apps/desktop/src/electron/main.ts`
- Modify: `apps/desktop/src/ui/global.d.ts`
- Modify: `apps/desktop/src/ui/hooks/usePosScreen.ts`

- [ ] Add IPC channels for retry-one and retry-all actions.
- [ ] Expose both actions to the renderer through preload.
- [ ] Add hook methods that refresh the snapshot after each action.

### Task 4: Build the cashier recovery panel

**Files:**
- Create: `apps/desktop/src/ui/components/RecoveryPanel.tsx`
- Modify: `apps/desktop/src/ui/App.tsx`
- Modify: `apps/desktop/src/ui/styles.css`
- Modify: `apps/desktop/src/ui/components/SyncStatusPanel.tsx` only if compact summary wording needs adjustment

- [ ] Render recent local sales with sync-state badges.
- [ ] Render queue records grouped or listed with status, retry count, last error, and next retry time.
- [ ] Add `Retry` for individual recoverable records.
- [ ] Add `Retry All Recoverable`.
- [ ] Keep the compact sync summary visible while moving detail into the new recovery panel.

### Task 5: Verify and update docs

**Files:**
- Modify: `apps/desktop/src/README.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`

- [ ] Run:
  - `npm.cmd run test --prefix apps/desktop`
  - `npm.cmd run typecheck --prefix apps/desktop`
  - `npm.cmd run build --prefix apps/desktop`
- [ ] Update desktop and top-level docs to reflect recovery-first shell support.
- [ ] Commit the change set.
- [ ] Push to `origin/main`.
