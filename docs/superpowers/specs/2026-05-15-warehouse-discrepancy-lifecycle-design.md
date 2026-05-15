# Warehouse Discrepancy And Lifecycle Design

## Goal

Deepen the warehouse Electron shell from a receiving-first demo into a fuller operator surface by adding:

- selectable transfer detail
- discrepancy-first summaries for requested, approved, dispatched, and received quantities
- explicit rejection and cancellation lifecycle events
- end-to-end backend replay and reconciliation support for those new events

This stays within the current architecture: immutable sync events remain the source of truth, backend replay still projects into relational transfer tables, and the warehouse UI only mutates state by submitting lifecycle events.

## Scope

### In scope

- Add `STOCK_TRANSFER_REJECTED` and `STOCK_TRANSFER_CANCELLED` to shared event contracts.
- Extend backend ingestion persistence actor resolution for the new event types.
- Extend backend transfer replay to project rejected and cancelled transfers into `stock_transfers`.
- Extend transfer reconciliation to understand `rejected` and `cancelled` projected states.
- Extend warehouse projection models with rejected/cancelled states and discrepancy summaries.
- Add a selectable transfer detail panel in the warehouse Electron shell.
- Add reject/cancel actions for eligible transfers.
- Keep receiving as the only line-item mutation flow.

### Out of scope

- Approval editing UI
- Dispatch editing UI
- Multi-user identity beyond the existing demo/operator identity pattern
- New auth modes beyond the current token-protected backend
- Historical audit explorer screens

## Approach Options

### Option 1: UI-only discrepancy rendering on top of existing statuses

Pros:
- Fastest UI work
- No backend replay changes

Cons:
- Cannot represent rejected/cancelled transfers truthfully
- Leaves lifecycle gap between UI and replayed Postgres state
- Inconsistent with the event-sourced architecture already established

### Option 2: Full-stack lifecycle extension with new event types

Pros:
- Preserves the current event-driven transfer architecture
- Keeps warehouse shell aligned with backend replay and reconciliation
- Makes reject/cancel behavior durable and testable

Cons:
- Touches shared types, backend, and warehouse app together

### Option 3: Separate admin command path outside sync events

Pros:
- Can be implemented with direct table updates

Cons:
- Breaks the event-first consistency model
- Introduces drift risk between branch behavior and cloud projection
- Not acceptable for this codebase

### Recommendation

Use option 2.

The codebase already proved the transfer lifecycle through replay and reconciliation. Rejection and cancellation should enter through the same sync path and project through the same replay layer. That keeps the warehouse shell honest and avoids parallel state systems.

## Event Contracts

Add two new event types:

- `STOCK_TRANSFER_REJECTED`
- `STOCK_TRANSFER_CANCELLED`

Add two new payload contracts:

- `StockTransferRejectedPayload`
  - `transferId`
  - `rejectedByUserId`
  - `rejectedAt`
  - `reason`

- `StockTransferCancelledPayload`
  - `transferId`
  - `cancelledByUserId`
  - `cancelledAt`
  - `reason`

These payloads do not carry item-level quantity changes. They terminate or reject the transfer lifecycle at the transfer header level.

## Backend Design

### Repository ingestion

`PostgresSyncEventRepository` must resolve actor IDs for the two new transfer event types:

- rejected uses `rejectedByUserId`
- cancelled uses `cancelledByUserId`

### Replay

`transfer-replay.ts` will:

- parse the new payloads
- claim replay idempotently through `sync_replay_log`
- update `stock_transfers.status`
- set `updated_at` from the event timestamp

Projection rules:

- `rejected` is valid only before dispatch or receipt
- `cancelled` is valid only before receipt
- a rejected/cancelled event must not regress an already received transfer

This slice will keep the rule simple and deterministic:

- if transfer is already `received`, ignore later reject/cancel updates
- otherwise allow the latest valid reject/cancel event to set the projected status

No changes are required to `transfer_items` for these two events.

### Reconciliation

Transfer reconciliation must treat `rejected` and `cancelled` as healthy projected end states when they match the latest lifecycle event stream for a transfer.

## Warehouse Projection Design

### Status model

Extend `TransferLifecycleStatus` with:

- `rejected`
- `cancelled`

### Detail/discrepancy model

Add a derived detail projection for a selected transfer that includes:

- header-level lifecycle summary
- event timeline
- totals:
  - requested total
  - approved total
  - dispatched total
  - received total
  - shortfall total
- per-line discrepancy fields:
  - requested minus approved
  - approved minus dispatched
  - dispatched minus received
  - booleans for approval shortfall, dispatch shortfall, receipt shortfall

The receiving queue remains derived only from `dispatched` and `partial_receipt` transfers.

## Warehouse UI Design

### Layout

Keep the current two-panel shell but deepen the right side:

- left: receiving queue with explicit transfer selection
- right: transfer dashboard summary plus selected transfer detail

### Selected transfer detail panel

Show:

- request number and lifecycle badge
- source and destination
- event count and last updated time
- transfer-level discrepancy summary chips
- line table with requested, approved, dispatched, received, and shortfall columns
- notes/reason when present

### Operator actions

Available actions by status:

- `requested`: reject, cancel
- `approved`: cancel
- `dispatched`: receive, cancel
- `partial_receipt`: receive additional quantities
- `received`, `rejected`, `cancelled`: read-only

This slice intentionally keeps approval/dispatch editing out of the UI.

## Error Handling

- Reject/cancel actions require a non-empty reason.
- Reject/cancel actions against transfers no longer in an eligible state return a user-visible error status.
- Receiving validation remains unchanged: no negative quantities and no over-receipt.
- Snapshot refresh after every action remains authoritative.

## Testing

Required tests:

- backend repository actor resolution for rejected/cancelled events
- backend transfer replay tests for rejected/cancelled projection
- backend reconciliation tests for rejected/cancelled healthy states
- warehouse projection tests for discrepancy totals and terminal statuses
- warehouse service tests for reject/cancel command flows

Verification commands:

- `npm.cmd run test --prefix apps/backend`
- `npm.cmd run test --prefix apps/warehouse`
- `npm.cmd run typecheck --prefix apps/warehouse`
- `npm.cmd run build --prefix apps/warehouse`

## Success Criteria

- Warehouse shell can select a transfer and show discrepancy detail.
- Operators can reject or cancel eligible transfers through the same protected sync path used for receiving.
- Backend replay and reconciliation understand the new lifecycle events.
- Receiving queue excludes rejected/cancelled transfers automatically.
- Docs and GitHub repo state reflect the new warehouse behavior.
