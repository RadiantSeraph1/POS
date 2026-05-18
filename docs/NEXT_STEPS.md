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
45. supports SKU and product-name search in the Electron cashier shell catalog
46. shows explicit operator status banners for sale, payment, cart, sync, and reset actions in the Electron cashier shell
47. shows inline payment mismatch feedback before checkout submit
48. supports suspended sale save, resume, and delete flows in the Electron cashier shell
49. persists suspended sale drafts in a dedicated local SQLite table instead of mixing drafts into completed sales
50. exposes queue detail and recent local sale history in the Electron cashier shell
51. supports retry-one and retry-all recovery actions for failed or dead-letter queue records in the Electron cashier shell
52. exposes shift summary totals and cashier attention counts in the Electron cashier shell
53. supports filtered queue and recent-sales recovery views in the Electron cashier shell
54. highlights dead-letter queue records with explicit operator warning state in the Electron cashier shell
55. exposes recent-sale detail inspection with item and payment breakdowns in the Electron cashier shell
56. reports shift-close readiness and explicit cashier blockers in the Electron cashier shell
57. translates dead-letter queue errors into explicit operator guidance in the Electron cashier shell
58. wraps the desktop UI in a role-based left-rail workspace shell
59. exposes a first Branch Manager dashboard page from the local branch snapshot
60. keeps explicit placeholder role areas for Warehouse, Accountant, and Admin while their pages are being defined
61. boots an Electron + React warehouse shell on top of the receiving queue and transfer dashboard projection layer
62. supports embedded or external backend mode in the warehouse shell
63. submits transfer receipt quantities from the warehouse shell through the protected backend
64. projects `STOCK_TRANSFER_REJECTED` and `STOCK_TRANSFER_CANCELLED` through backend replay and reconciliation
65. supports selected transfer discrepancy detail in the warehouse shell
66. supports reject/cancel lifecycle actions for eligible transfers in the warehouse shell
67. supports approval quantity editing and `STOCK_TRANSFER_APPROVED` submission from the warehouse shell
68. supports dispatch quantity editing and `STOCK_TRANSFER_DISPATCHED` submission from the warehouse shell

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

1. Expand the desktop shell from cashier-plus-manager into deeper role pages, hardware-aware operator workflows, and richer manager-facing summaries.
2. Replace token auth with real user/device auth once the auth package is implemented.
3. Add warehouse lifecycle audit/history views on top of the replayed cloud state.
4. Add broader reporting views on top of the replayed and reconciled cloud state.

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

The cloud now stores accepted events idempotently, replays sale events into business tables, reconciles sale/payment/inventory projections, records replay/reconciliation command history, records event-level replay failures, exposes sync worker health, replays transfer request/approval/dispatch/receipt/reject/cancel events, reconciles warehouse transfer lifecycle projections, and has been verified with a live non-empty desktop sale plus a warehouse shell that supports approval, dispatch, receipt, reject, and cancel actions. The next gap is moving the cashier shell from the current reporting baseline into hardware-aware operator workflows and broader manager-facing summaries, then adding richer warehouse audit/history surfaces.
