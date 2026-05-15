# PipeFlow POS

Offline-first POS and retail operations platform for a multi-branch plumbing retail chain.

This project is intentionally built around the failure modes that break retail trust:

- branch internet outages
- backend downtime
- inventory corruption
- sync conflicts
- replay drift between local and cloud state

The current implementation is no longer just a scaffold. It includes a working local sale path, a protected backend sync path, PostgreSQL-backed replay and reconciliation, a warehouse receiving flow, an Electron cashier shell, and a first warehouse Electron shell.

## Current Implementation

### Desktop / Branch

- Local SQLite branch database
- Atomic local sale write through:
  - `sales`
  - `sale_items`
  - `payments`
  - `receipts`
  - `inventory_events`
  - `inventory_levels`
  - `sync_queue`
- Oversell protection before sale commit
- Sync queue processing with retry, backoff, and dead-letter behavior
- Terminal POS demo flow
- Electron + React cashier shell with:
  - catalog panel
  - cart quantity/remove/clear controls
  - suspended sale save, resume, and delete flow
  - editable cash and mobile-money split payments
  - operator feedback banners and inline checkout validation
  - sync status panel

### Backend / Cloud

- HTTP sync ingestion API
- Token-protected sync inspection and ingest endpoints
- Durable sync storage in SQLite or PostgreSQL
- Idempotent event ingest by `eventId`
- PostgreSQL replay into business projection tables
- PostgreSQL reconciliation for:
  - sales
  - inventory
  - stock transfers
- Replay worker health endpoint
- Operational job-run and replay-failure tracking

### Warehouse

- Transfer lifecycle support for:
  - `STOCK_TRANSFER_REQUESTED`
  - `STOCK_TRANSFER_APPROVED`
  - `STOCK_TRANSFER_DISPATCHED`
  - `STOCK_TRANSFER_RECEIVED`
  - `STOCK_TRANSFER_REJECTED`
  - `STOCK_TRANSFER_CANCELLED`
- Receiving-first warehouse flow
- Projected inbound receiving queue
- Validated receive submission and discrepancy-aware projection updates
- Electron + React warehouse shell with:
  - inbound receiving queue panel
  - transfer dashboard panel
  - selected transfer detail and discrepancy summary
  - reject/cancel lifecycle actions for eligible transfers
  - embedded or external backend mode

## Verified Flows

- Local branch sale commits to SQLite and updates inventory correctly
- Oversell attempts are rejected before commit
- Pending queue events sync over HTTP to the backend
- Duplicate event posts are treated as duplicates, not double-ingested
- Accepted events persist in PostgreSQL
- Accepted sale events replay into cloud `sales`, `sale_items`, `payments`, and `inventory_levels`
- Accepted transfer lifecycle events replay into cloud transfer projection tables, including rejected and cancelled terminal states
- Reconciliation commands report projection drift separately from unreplayed events
- The Electron cashier shell launches and renders against the desktop POS service
- The Electron warehouse shell launches and renders against the warehouse projection and receiving service

## Repository Layout

```text
/apps
  /backend
  /desktop
  /warehouse

/packages
  /auth
  /inventory
  /payments
  /reporting
  /sync-engine
  /types

/infrastructure
  /sql

/docs
  /adr
  /api
  /migration
  /superpowers
```

## Quick Start

### Desktop cashier shell

```powershell
npm.cmd run dev --prefix apps/desktop
```

### Desktop terminal flow

```powershell
npm.cmd run dev:cli --prefix apps/desktop
```

### Backend in local SQLite mode

```powershell
node apps/backend/src/main.ts
```

### Backend in PostgreSQL mode

```powershell
$env:BACKEND_SYNC_REPOSITORY='postgres'
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
node apps/backend/src/main.ts
```

### Initialize PostgreSQL schema and demo reference data

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run init:postgres --prefix apps/backend
```

### Replay accepted sale events

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run replay:sales:postgres --prefix apps/backend
```

### Replay accepted transfer events

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@localhost:5432/pipeflow'
npm.cmd run replay:transfers:postgres --prefix apps/backend
```

### Warehouse shell

```powershell
npm.cmd run dev --prefix apps/warehouse
```

## Important References

- Product and architecture overview:
  [PIPEFLOW_POS_ARCHITECTURE.md](./PIPEFLOW_POS_ARCHITECTURE.md)
- Current continuation and implementation backlog:
  [docs/NEXT_STEPS.md](./docs/NEXT_STEPS.md)
- Desktop implementation notes:
  [apps/desktop/src/README.md](./apps/desktop/src/README.md)
- Backend implementation notes:
  [apps/backend/src/README.md](./apps/backend/src/README.md)
- Warehouse implementation notes:
  [apps/warehouse/src/README.md](./apps/warehouse/src/README.md)

## Immediate Next Work

1. Deepen the Electron cashier shell with more advanced cashier recovery/reporting workflows.
2. Add approval/dispatch operator surfaces to the warehouse shell.
3. Replace token auth with real user/device auth and RBAC integration.
4. Add richer operational audit views and reporting.

## Core Principle

Branches must keep operating even when the cloud is unavailable. Cloud synchronization is important, but local correctness is non-negotiable.
