# Next Steps

The repository now has:

- architecture and product documentation
- monorepo scaffold
- starter shared packages
- first draft SQL schemas for SQLite and PostgreSQL

## Current Best Next Coding Task

Start the actual warehouse UI and POS UI on top of the protected backend and proven local services.

The desktop transaction service now:

1. `sales`
2. `sale_items`
3. `payments`
4. `receipts`
5. `inventory_events`
6. `inventory_levels`
7. `sync_queue`
8. blocks oversell attempts before commit
9. processes pending queue records through a mock sync transport
10. retries failed events with backoff and dead-letters them after a threshold
11. syncs accepted events to the backend over real local HTTP
12. persists backend-accepted events durably on disk across process restarts
13. exposes `GET /sync/events` for inspection of ingested backend events
14. persists accepted backend events into PostgreSQL `inventory_events`
15. initializes PostgreSQL with one command via `npm.cmd run init:postgres --prefix apps/backend`
16. replays accepted `SALE_CREATED` events into cloud `sales`, `sale_items`, `payments`, and branch `inventory_levels`
17. prevents duplicate replay with `sync_replay_log`
18. reconciles accepted `SALE_CREATED` payloads against cloud sale, item, and payment projections
19. reconciles replayed sale line quantities against branch `inventory_levels`
20. records replay and reconciliation command runs in PostgreSQL `sync_job_runs`
21. seeds demo customer/catalog records needed for non-empty sale replay
22. runs a live desktop SQLite sale sync against a PostgreSQL-backed backend
23. replays and reconciles that live sale with zero sale/payment/inventory drift
24. records event-level replay failure details in PostgreSQL `sync_replay_failures`
25. runs controlled background `SALE_CREATED` replay with `SYNC_REPLAY_WORKER=enabled`
26. exposes `GET /sync/health` with replay worker status
27. ingests live `STOCK_TRANSFER_REQUESTED` events through `POST /sync/events`
28. replays transfer requests into `stock_transfers` and `transfer_items`
29. ingests live `STOCK_TRANSFER_DISPATCHED` and `STOCK_TRANSFER_RECEIVED` events
30. replays transfer dispatches into `warehouse_dispatches` and dispatched item quantities
31. replays transfer receipts into `warehouse_receipts`, received item quantities, and destination branch `inventory_levels`
32. reconciles stock transfer lifecycle payloads against projected transfer rows
33. ingests and replays `STOCK_TRANSFER_APPROVED` events
34. supports partial fulfillment quantities through approved, dispatched, and received transfer item columns
35. protects sync and inspection endpoints with token-based auth/RBAC
36. ships a warehouse transfer workbench that emits request/approve/dispatch/receive events against the backend
37. derives a receiving-first warehouse queue from projected backend transfer events
38. submits validated `STOCK_TRANSFER_RECEIVED` events from the warehouse app and re-renders projected state
39. renders a single-screen POS model in the desktop app using the local SQLite catalog, cart totals, split payments, and sync queue state
40. submits a real local sale through the same `createLocalSale()` boundary while showing queue state before and after sync processing
41. boots an Electron + React cashier shell on top of the desktop POS service layer
42. exposes desktop POS actions through an Electron preload bridge instead of letting the renderer touch SQLite directly
43. supports cart remove and clear-cart actions in the Electron cashier shell
44. supports editable cash and mobile-money split payments in the Electron cashier shell

## Why This Is Next

This is the next integration point that matters:

- checkout speed
- atomic local writes
- inventory correctness
- queue durability
- recovery after connectivity issues
- acknowledgement tracking
- branch-to-cloud contract shape
- cloud event replay
- drift detection between branch-local and cloud projections

## Immediate Follow-Up After That

1. Replace the receiving-first warehouse workbench with a proper React/Electron warehouse UI.
2. Expand the first cashier shell into a fuller production POS UI with search, better feedback, and suspended sale recovery.
3. Add transfer cancellation/rejection events.
4. Replace token auth with real user/device auth once the auth package is implemented.

## Useful Verification Commands

When the backend is running:

- `Invoke-RestMethod http://localhost:3000/health`
- `Invoke-RestMethod http://localhost:3000/sync/health`
- `Invoke-RestMethod http://localhost:3000/sync/events`

When setting up PostgreSQL:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run init:postgres --prefix apps/backend`

When replaying accepted sale events:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run replay:sales:postgres --prefix apps/backend`

When replaying accepted stock transfer lifecycle events:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run replay:transfers:postgres --prefix apps/backend`

When reconciling sale projections:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run reconcile:sales:postgres --prefix apps/backend`

When reconciling inventory projections:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run reconcile:inventory:postgres --prefix apps/backend`

When reconciling warehouse transfer projections:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `npm.cmd run reconcile:transfers:postgres --prefix apps/backend`

When inspecting replay and reconciliation job history:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `node -e "import('pg').then(async ({Pool}) => { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const result = await pool.query('SELECT job_type, status, summary_json, error_message FROM sync_job_runs ORDER BY started_at DESC LIMIT 10'); console.log(JSON.stringify(result.rows, null, 2)); await pool.end(); })"`

When inspecting event-level replay failures:

- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `node -e "import('pg').then(async ({Pool}) => { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const result = await pool.query('SELECT event_id, event_type, error_message, failed_at FROM sync_replay_failures ORDER BY failed_at DESC LIMIT 10'); console.log(JSON.stringify(result.rows, null, 2)); await pool.end(); })"`

When port `3000` is busy:

- `$env:PORT='3001'`
- `node apps/backend/src/main.ts`

When enabling the background sale replay worker:

- `$env:BACKEND_SYNC_REPOSITORY='postgres'`
- `$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'`
- `$env:SYNC_REPLAY_WORKER='enabled'`
- `$env:SYNC_REPLAY_WORKER_INTERVAL_MS='30000'`
- `$env:SYNC_REPLAY_WORKER_LIMIT='100'`
- `node apps/backend/src/main.ts`

When you want the desktop demo to use the live backend:

- `$env:PIPEFLOW_SYNC_BASE_URL='http://127.0.0.1:3000'`
- `node apps/desktop/src/main.ts`

## Known Gap After PostgreSQL Cutover

The cloud now stores accepted events idempotently, replays sale events into business tables, reconciles sale/payment/inventory projections, records replay/reconciliation command history, records event-level replay failures, exposes sync worker health, replays transfer request/approval/dispatch/receipt events, reconciles warehouse transfer lifecycle projections, and has been verified with a live non-empty desktop sale plus a live receiving-first warehouse flow. The next gap is deepening the first POS and warehouse shells into fuller operator-ready UIs instead of terminal or demo-grade workbenches.
