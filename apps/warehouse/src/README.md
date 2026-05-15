# Warehouse App Notes

The warehouse app is now a receiving-first transfer workbench rather than a placeholder.

## Current Workflow

`src/main.ts`:

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

## Required Environment

- `PIPEFLOW_SYNC_WRITE_TOKEN` or `PIPEFLOW_SYNC_ADMIN_TOKEN`
- `PIPEFLOW_SYNC_READ_TOKEN` or `PIPEFLOW_SYNC_ADMIN_TOKEN`

Example:

```powershell
$env:PIPEFLOW_SYNC_BASE_URL='http://127.0.0.1:3000'
$env:PIPEFLOW_SYNC_ADMIN_TOKEN='admin-token'
node apps/warehouse/src/main.ts
```

If `PIPEFLOW_SYNC_BASE_URL` is not set, the workbench starts an embedded SQLite-backed backend on port `3103` for self-test.

## Purpose

This is the narrowest useful warehouse UI slice on the current stack: it exercises transfer receipt against the protected backend, shows which transfers are still actionable for receiving, and demonstrates how partial receipts stay visible after projection.
