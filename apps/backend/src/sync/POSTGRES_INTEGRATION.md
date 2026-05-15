# PostgreSQL Sync Repository

The backend includes a working `PostgresSyncEventRepository` and a `pg` adapter for persisting accepted sync events into the cloud `inventory_events` table.

## What Exists Now

- `PostgresSyncEventRepository`
- `PostgresQueryClient` interface
- `createPgQueryClient()` lazy loader for `pg`
- cloud-oriented insert and lookup logic against `inventory_events`
- backend bootstrap that switches on `BACKEND_SYNC_REPOSITORY`
- `init:postgres` setup script that creates the database, applies schema, and seeds demo rows
- `replay:sales:postgres` projection command for `SALE_CREATED` events
- sale and inventory reconciliation commands
- stock transfer lifecycle reconciliation command
- `sync_job_runs` ledger for replay and reconciliation command history
- `sync_replay_failures` ledger for event-level replay errors
- controlled background `SALE_CREATED` replay worker behind `SYNC_REPLAY_WORKER`
- `GET /sync/health` for replay worker status
- `replay:transfers:postgres` projection command for stock transfer request, approval, dispatch, and receipt events

## Setup

```powershell
npm.cmd install --prefix apps/backend
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run init:postgres --prefix apps/backend
```

Then run:

```powershell
$env:BACKEND_SYNC_REPOSITORY='postgres'
node apps/backend/src/main.ts
```

To run with background sale replay:

```powershell
$env:BACKEND_SYNC_REPOSITORY='postgres'
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
$env:SYNC_REPLAY_WORKER='enabled'
$env:SYNC_REPLAY_WORKER_INTERVAL_MS='30000'
$env:SYNC_REPLAY_WORKER_LIMIT='100'
node apps/backend/src/main.ts
```

## Expected Client Shape

The repository expects:

```ts
interface PostgresQueryClient {
  query<T>(text: string, params?: ReadonlyArray<unknown>): Promise<{ rows: T[] }>;
}
```

## Important Contract Assumptions

- `eventId` maps to `inventory_events.id`
- `organizationId` must be present in the sync payload
- `cashierUserId` is used as the actor user ID for sale events
- `requestedByUserId` is used as the actor user ID for stock transfer request events
- `approvedByUserId` is used as the actor user ID for stock transfer approval events
- `dispatchedByUserId` is used as the actor user ID for stock transfer dispatch events
- `receivedByUserId` is used as the actor user ID for stock transfer receipt events
- `deviceId` is written into the cloud event row

## Projection And Reconciliation Commands

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run replay:sales:postgres --prefix apps/backend
npm.cmd run replay:transfers:postgres --prefix apps/backend
npm.cmd run reconcile:sales:postgres --prefix apps/backend
npm.cmd run reconcile:inventory:postgres --prefix apps/backend
npm.cmd run reconcile:transfers:postgres --prefix apps/backend
```

These commands write job history into `sync_job_runs`. Replay failures for individual events are written to `sync_replay_failures`.

## Current Limitation

The sale replay worker is controlled by environment variables and reports status. Transfer request/approval/dispatch/receipt replay and transfer reconciliation exist, but auth/RBAC and UI workflows are not implemented yet.

## Recommended Next Implementation

1. Add auth/RBAC around sync and operational endpoints.
2. Start warehouse UI once approval and partial fulfillment are modeled.
3. Add POS UI on top of the proven local sale path.
4. Add transfer cancellation/rejection events.
