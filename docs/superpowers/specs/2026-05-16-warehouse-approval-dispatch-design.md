# Warehouse Approval And Dispatch Design

## Goal

Extend the warehouse Electron shell so operators can complete the upstream transfer lifecycle from the same selected-transfer panel:

- approve requested transfers with editable approved quantities
- dispatch approved transfers with editable dispatched quantities
- keep receive, reject, cancel, and discrepancy detail in the same shell

This keeps the warehouse UI aligned with the existing event-driven backend path. Approval and dispatch actions must submit real sync events, refresh from backend state, and render the replayed result instead of mutating local UI state optimistically.

## Scope

### In scope

- Add approval command builders in `apps/warehouse`
- Add dispatch command builders in `apps/warehouse`
- Add approval and dispatch actions to the warehouse Electron service and preload bridge
- Extend the selected transfer detail panel with:
  - editable approved quantities for `requested` transfers
  - editable dispatched quantities for `approved` transfers
- Validate quantity ceilings:
  - approved quantity cannot exceed requested quantity
  - dispatched quantity cannot exceed approved quantity
- Refresh the projected transfer state after every submit
- Add tests for action builders, service actions, and shell refresh behavior

### Out of scope

- Editing requested quantities
- Direct approval/dispatch actions from the dashboard cards
- Multi-step picking/packing workflows
- Inventory reservation logic beyond the current event model
- User/device identity changes beyond the current demo operator pattern

## Current State

The warehouse shell already supports:

- receiving queue for `dispatched` and `partial_receipt` transfers
- selected transfer discrepancy detail
- reject/cancel lifecycle actions
- backend replay and reconciliation for request/approve/dispatch/receive/reject/cancel

What is still missing is operator control over the two lifecycle stages before receipt:

- deciding approved quantities
- deciding dispatched quantities

Without those, the warehouse shell still depends on seeded or external approval/dispatch state.

## Approaches

### Option 1: Approval-only first

Pros:
- Smallest next step
- Good if requested transfers are the dominant operational bottleneck

Cons:
- Leaves dispatch outside the shell
- Splits one operator flow across multiple iterations

### Option 2: Dispatch-only first

Pros:
- Useful for warehouse outbound execution

Cons:
- Wrong sequencing because dispatch depends on approved quantities
- Leaves the requested stage unhandled

### Option 3: Unified approval + dispatch detail panel

Pros:
- Completes the core warehouse operator path
- Reuses the selected transfer detail surface already in place
- Avoids adding another screen or navigation model

Cons:
- Slightly larger UI and service change set

### Recommendation

Use option 3.

The current shell already centers work around the selected transfer detail panel. Adding approval and dispatch there is the cleanest continuation: one panel handles the lifecycle stages in order, and the backend remains the source of truth through real sync-event submission and replayed refresh.

## Data And Event Model

No new sync event types are required. This slice uses the existing contracts:

- `STOCK_TRANSFER_APPROVED`
- `STOCK_TRANSFER_DISPATCHED`

The warehouse app will build those payloads from the selected transfer detail state.

### Approval rules

- allowed only when transfer status is `requested`
- each line gets an editable `approvedQuantity`
- approved quantity per line must satisfy:
  - `0 <= approvedQuantity <= requestedQuantity`
- zero-quantity approval is allowed per line
- the transfer can still move to `approved` even if some lines are zero

### Dispatch rules

- allowed only when transfer status is `approved`
- each line gets an editable `dispatchedQuantity`
- dispatched quantity per line must satisfy:
  - `0 <= dispatchedQuantity <= approvedQuantity`
- zero-quantity dispatch is allowed per line

## Warehouse App Design

### New action builders

Add a dedicated module for approval and dispatch command construction, parallel to the existing receive/reject/cancel helpers.

Expected responsibilities:

- validate editable quantities
- construct the event payload
- construct the sync envelope
- submit through the existing `WarehouseBackendClient`

### Warehouse service

Extend `WarehouseUiService` with:

- `approveTransfer(command)`
- `dispatchTransfer(command)`

These methods must:

- resolve the current transfer from the latest snapshot
- enforce status eligibility
- submit the sync event
- refresh projected backend state
- return a new `WarehouseShellSnapshot` with operator-facing status text

### Snapshot model

No new authoritative backend state is required for the snapshot. The renderer can continue deriving editable form state client-side from the selected transfer.

## UI Design

### Selected transfer panel

The existing `TransferDetailPanel` becomes the operator work surface for all transfer stages.

For `requested` transfers:

- show an approval editor
- one numeric input per line
- default input values equal the requested quantity
- submit action: `Approve Transfer`

For `approved` transfers:

- show a dispatch editor
- one numeric input per line
- default input values equal the approved quantity
- submit action: `Dispatch Transfer`

For `dispatched` and `partial_receipt` transfers:

- preserve the current receive-focused view

For `received`, `rejected`, and `cancelled` transfers:

- read-only detail only

### Visual behavior

- keep discrepancy chips and line summaries visible during editing
- visually differentiate:
  - requested quantity baseline
  - approved quantity
  - dispatched quantity
- keep destructive actions (`Reject`, `Cancel`) visually separate from forward lifecycle actions (`Approve`, `Dispatch`, `Receive`)

## Error Handling

- invalid quantities must fail before any event submit
- service-level status messages should stay explicit:
  - success on approved/dispatch submit
  - error when transfer status is stale or ineligible
- snapshot refresh after action remains authoritative

## Testing

Required tests:

- action builder tests for:
  - valid approval payload
  - valid dispatch payload
  - approval overflow rejection
  - dispatch overflow rejection
- warehouse service tests for:
  - approving a requested transfer
  - dispatching an approved transfer
- existing warehouse tests must remain green

Verification commands:

- `npm.cmd run test --prefix apps/warehouse`
- `npm.cmd run typecheck --prefix apps/warehouse`
- `npm.cmd run build --prefix apps/warehouse`

## Success Criteria

- Requested transfers can be approved from the warehouse shell.
- Approved transfers can be dispatched from the warehouse shell.
- Approval and dispatch quantities refresh from backend-projected state after submit.
- Quantity validation prevents invalid operator input from generating sync events.
- The selected transfer detail panel remains the single place to inspect and operate on a transfer lifecycle.
