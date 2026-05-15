# Warehouse App Notes

The warehouse app now has two runnable surfaces:

- a terminal receiving-first workbench
- an Electron + React warehouse shell

## Current Shell

The Electron shell presents two coordinated views on top of the existing backend projection layer:

- `Inbound Receiving Queue`
  - actionable inbound transfers
  - per-line received quantity entry
  - receipt submission
  - demo transfer seeding for embedded/local testing
- `Transfer Dashboard`
  - projected transfer counts by lifecycle state
  - broader transfer visibility beyond the actionable queue

The warehouse shell uses the existing receiving and dashboard logic instead of duplicating business rules in the renderer.

## Current Workflow

`src/main.ts` still supports the terminal workbench:

- reads backend URL and optional auth tokens from environment
- creates a stock transfer lifecycle scenario
- emits `STOCK_TRANSFER_REQUESTED`
- emits `STOCK_TRANSFER_APPROVED`
- emits `STOCK_TRANSFER_DISPATCHED`
- reads back `GET /sync/events`
- projects actionable inbound transfers into a receiving queue
- submits one `STOCK_TRANSFER_RECEIVED` event with validated received quantities
- re-reads backend events
- prints the receiving queue before and after receipt submission
- prints the projected warehouse dashboard after the receipt lands

`src/electron/main.ts` and `src/ui/*` now provide:

- Electron main process bootstrap
- preload bridge for warehouse actions
- React warehouse shell
- embedded backend mode when no external sync URL is supplied
- receiving queue panel
- broader transfer dashboard panel

## Warehouse Commands

Electron shell:

```powershell
npm.cmd run dev --prefix apps/warehouse
```

Terminal receiving flow:

```powershell
npm.cmd run dev:cli --prefix apps/warehouse
```

Build warehouse shell:

```powershell
npm.cmd run build --prefix apps/warehouse
```

## Required Environment

For a live backend:

- `PIPEFLOW_SYNC_BASE_URL`
- `PIPEFLOW_SYNC_WRITE_TOKEN` or `PIPEFLOW_SYNC_ADMIN_TOKEN`
- `PIPEFLOW_SYNC_READ_TOKEN` or `PIPEFLOW_SYNC_ADMIN_TOKEN`

Example:

```powershell
$env:PIPEFLOW_SYNC_BASE_URL='http://127.0.0.1:3000'
$env:PIPEFLOW_SYNC_ADMIN_TOKEN='admin-token'
npm.cmd run dev --prefix apps/warehouse
```

If `PIPEFLOW_SYNC_BASE_URL` is not set, the shell starts an embedded SQLite-backed backend for self-test.

## Purpose

This is the first real warehouse UI shell on the current stack: it exercises transfer receipt against the protected backend, keeps the actionable receiving queue visible, and provides a broader transfer dashboard for context while partial receipts remain open.

## Next Step

Deepen the warehouse shell with richer discrepancy handling, clearer transfer detail views, and eventually approval/dispatch operator surfaces.
