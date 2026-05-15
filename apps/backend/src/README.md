# Backend App Notes

The backend now exposes a lightweight HTTP sync ingestion endpoint.

## Current Endpoints

- `GET /health`
- `GET /sync/health`
- `GET /sync/events`
- `POST /sync/events`

## Current Behavior

`POST /sync/events`:

- validates batch structure
- validates each event envelope
- stores accepted events through a repository abstraction
- treats repeated `eventId` values as duplicates
- returns per-event acknowledgement results
- is already exercised by the desktop app over real local HTTP in the current demo
- persists accepted events through either SQLite development storage or PostgreSQL cloud storage

`GET /sync/events`:

- lists ingested sync events from the active repository
- works with both SQLite development storage and PostgreSQL-backed storage
- helps verify what actually landed in the backend without querying the database directly

`GET /sync/health`:

- reports backend sync operational health
- includes sale replay worker status when `SYNC_REPLAY_WORKER` is enabled
- shows worker interval, limit, run count, failure count, last run timestamp, last summary, and last error when present

`replay:sales:postgres`:

- scans unreplayed `SALE_CREATED` events from PostgreSQL `inventory_events`
- projects them into `sales`, `sale_items`, `payments`, and branch `inventory_levels`
- records each projected event in `sync_replay_log`
- records per-event replay failures in `sync_replay_failures`
- is safe to rerun because already-projected events are skipped

`replay:transfers:postgres`:

- scans unreplayed stock transfer lifecycle events from PostgreSQL `inventory_events`
- supports `STOCK_TRANSFER_REQUESTED`, `STOCK_TRANSFER_APPROVED`, `STOCK_TRANSFER_DISPATCHED`, and `STOCK_TRANSFER_RECEIVED`
- projects requests into `stock_transfers` and `transfer_items`
- projects approvals into approved transfer item quantities without regressing already-dispatched or received transfer status
- projects dispatches into `warehouse_dispatches` and dispatched transfer item quantities
- projects receipts into `warehouse_receipts`, received transfer item quantities, and destination branch `inventory_levels`
- records each projected event in `sync_replay_log`
- records per-event replay failures in `sync_replay_failures`
- is safe to rerun because already-projected events are skipped

`reconcile:sales:postgres`:

- compares accepted `SALE_CREATED` event payloads with projected cloud rows
- checks sale totals, sale item count, payment count, and payment totals
- reports unreplayed events separately from drifted projections
- does not modify data

`reconcile:inventory:postgres`:

- compares sold quantities from replayed `SALE_CREATED` event lines with branch `inventory_levels`
- reports product-level quantity drift by organization, branch, product, and variant
- does not modify data

`reconcile:transfers:postgres`:

- compares stock transfer lifecycle event payloads with projected transfer rows
- checks requested, approved, dispatched, and received quantities
- checks projected transfer status
- reports unreplayed lifecycle events separately from drifted transfer projections
- does not modify data

Operational job commands now also write to PostgreSQL `sync_job_runs`:

- `replay:sales:postgres`
- `replay:transfers:postgres`
- `reconcile:sales:postgres`
- `reconcile:inventory:postgres`
- `reconcile:transfers:postgres`

Each run records `job_type`, `job_name`, `status`, JSON summary data, error message if failed, and start/finish timestamps.

## Local PostgreSQL Setup

After PostgreSQL is installed and running, this command creates the target database if needed, applies the cloud schema, and inserts demo organization, branch, warehouse, device, cashier, customer, supplier, category, product, and variant rows:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run init:postgres --prefix apps/backend
```

## Running

SQLite development mode:

```powershell
node apps/backend/src/main.ts
```

PostgreSQL mode:

```powershell
$env:BACKEND_SYNC_REPOSITORY='postgres'
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
node apps/backend/src/main.ts
```

PostgreSQL mode with controlled background sale replay:

```powershell
$env:BACKEND_SYNC_REPOSITORY='postgres'
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
$env:SYNC_REPLAY_WORKER='enabled'
$env:SYNC_REPLAY_WORKER_INTERVAL_MS='30000'
$env:SYNC_REPLAY_WORKER_LIMIT='100'
node apps/backend/src/main.ts
```

Token-protected mode:

```powershell
$env:BACKEND_AUTH_MODE='token'
$env:BACKEND_AUTH_TOKENS='ingest-token=sync_ingest;read-token=sync_read;admin-token=sync_admin'
node apps/backend/src/main.ts
```

In token mode:

- `GET /health` remains public
- `POST /sync/events` requires `sync_ingest` or `sync_admin`
- `GET /sync/events` requires `sync_read` or `sync_admin`
- `GET /sync/health` requires `sync_read` or `sync_admin`

Use:

```powershell
$headers = @{ Authorization = 'Bearer read-token' }
Invoke-RestMethod http://localhost:3000/sync/health -Headers $headers
```

Inspect worker health:

```powershell
Invoke-RestMethod http://localhost:3000/sync/health
```

If port `3000` is already busy:

```powershell
$env:PORT='3001'
node apps/backend/src/main.ts
```

Replay accepted sale events into cloud projections:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run replay:sales:postgres --prefix apps/backend
```

Replay accepted stock transfer lifecycle events into cloud projections:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run replay:transfers:postgres --prefix apps/backend
```

Reconcile accepted sale events against cloud projections:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run reconcile:sales:postgres --prefix apps/backend
```

Reconcile inventory projection quantities:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run reconcile:inventory:postgres --prefix apps/backend
```

Reconcile stock transfer lifecycle projections:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run reconcile:transfers:postgres --prefix apps/backend
```

Inspect recent operational job runs:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
node -e "import('pg').then(async ({Pool}) => { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const result = await pool.query('SELECT job_type, status, summary_json, error_message, started_at, finished_at FROM sync_job_runs ORDER BY started_at DESC LIMIT 10'); console.log(JSON.stringify(result.rows, null, 2)); await pool.end(); })"
```

Inspect event-level replay failures:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
node -e "import('pg').then(async ({Pool}) => { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const result = await pool.query('SELECT event_id, event_type, error_message, failed_at FROM sync_replay_failures ORDER BY failed_at DESC LIMIT 10'); console.log(JSON.stringify(result.rows, null, 2)); await pool.end(); })"
```

## Repository Selection

- `BACKEND_SYNC_REPOSITORY=sqlite` uses the local durable development store
- `BACKEND_SYNC_REPOSITORY=postgres` uses the PostgreSQL bootstrap path and requires `DATABASE_URL` plus the `pg` dependency
