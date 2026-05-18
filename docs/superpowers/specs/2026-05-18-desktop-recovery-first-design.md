# Desktop Recovery-First Cashier Design

## Goal

Deepen the Electron cashier shell with operator recovery tooling around the local sync queue.

This slice adds:

- visible queue state beyond the compact summary
- actionable retry controls for failed and dead-letter events
- recent sale and sync history for the current device/session
- clearer distinction between local commit success and cloud sync state

The intent is operational recovery, not analytics. Cashiers and branch managers should be able to tell what committed locally, what synced, what failed, and what needs manual attention.

## Scope

### In scope

- Expand the desktop POS shell with a recovery panel
- Show pending, processing, failed, dead-letter, and synced queue records
- Show recent locally committed sales with their sync state
- Add explicit retry actions for failed and dead-letter queue items
- Add a local query path in the desktop service for recent sales and queue records
- Keep recovery fully local-first; do not depend on cloud reads

### Out of scope

- Financial reporting dashboards
- Shift-close summaries
- Refunds and returns
- Cross-device reconciliation UI
- Manager approval workflows

## Current State

The cashier shell already supports:

- local cart and checkout
- split payments
- suspended sale save/resume/delete
- sale submit through the real local sale boundary
- compact sync status summary
- operator status banners

The gap is that the operator can see aggregate queue counts but cannot inspect or act on individual queue records. That leaves recovery opaque when sync failures happen.

## Approaches

### Option 1: Read-only sync log

Pros:
- Fastest UI change
- Lower service surface area

Cons:
- Does not actually improve recovery
- Operator still cannot retry failed/dead-letter records

### Option 2: Recovery panel with retry actions

Pros:
- Directly addresses offline-first operational needs
- Uses existing queue model and processor
- High value without broadening into reporting

Cons:
- Requires service-level retry/reset hooks

### Option 3: Full backoffice console inside the desktop shell

Pros:
- Broad visibility

Cons:
- Too wide for the next slice
- Blends cashier recovery with manager analytics

### Recommendation

Use option 2.

The codebase already has queue state, retry/backoff logic, and dead-letter handling. The highest-value next step is to expose those mechanics cleanly in the cashier shell, not to build summary charts first.

## Desktop Service Design

Add recovery-oriented snapshot data to the existing desktop POS service.

### New snapshot sections

- `recentSales`
  - sale id
  - sale number
  - happened at
  - total
  - sync status derived from local queue/inventory event linkage

- `queueRecords`
  - queue record id
  - event id
  - queue status
  - retry count
  - last error
  - next retry at
  - created at
  - synced at

### New actions

- `processSyncQueue()`
  - already exists and stays available

- `retryQueueRecord(recordId)`
  - resets one failed or dead-letter record back to `pending`
  - does not mutate already-synced records

- `retryAllRecoverableQueueRecords()`
  - resets all `failed` and `dead_letter` records to `pending`

This slice does not require direct record deletion from the UI.

## Local Data Rules

### Queue retry rules

- `failed` can be retried
- `dead_letter` can be retried manually
- `pending`, `processing`, and `synced` cannot be manually reset

### Sale history rules

- local sale history is based on committed `sales`
- sync state is derived from the corresponding queue/event record
- a locally committed sale remains visible even if cloud sync is broken

## UI Design

### Layout

Keep the current single-screen cashier shell and add a recovery section instead of a separate route.

Recommended layout:

- catalog
- cart
- checkout
- sync summary
- recovery panel

### Recovery panel contents

- queue-status tabs or grouped sections:
  - pending
  - failed
  - dead-letter
  - recent synced
- per-record metadata:
  - event id
  - retry count
  - last error
  - next retry time
- retry action buttons:
  - `Retry` on individual failed/dead-letter records
  - `Retry All Recoverable`
- recent committed sales list:
  - sale number
  - happened at
  - total
  - local/cloud state badge

### Operator messaging

Status banners should clearly distinguish:

- sale committed locally
- queue item queued for sync
- sync succeeded
- retry reset succeeded
- no recoverable records found

## Error Handling

- retrying a non-recoverable queue record returns a clear error status
- retrying when there are no recoverable records returns an info status
- queue and sales snapshot refresh after every action remains authoritative

## Testing

Required tests:

- desktop service test for listing recent queue records
- desktop service test for retrying one dead-letter or failed record
- desktop service test for retrying all recoverable records
- keep existing desktop tests green

Verification commands:

- `npm.cmd run test --prefix apps/desktop`
- `npm.cmd run typecheck --prefix apps/desktop`
- `npm.cmd run build --prefix apps/desktop`

## Success Criteria

- Cashier shell shows recent committed sales and detailed sync queue records.
- Failed and dead-letter records can be reset to pending from the UI.
- Queue summary and recent sales refresh correctly after retry and process actions.
- The shell makes local commit success visibly distinct from cloud sync success.
