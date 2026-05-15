# Warehouse Receiving-First UI Design

Date: 2026-05-15
Status: Drafted from validated repo state
Scope: `apps/warehouse`

## Objective

Build the next warehouse-facing UI slice around inbound receiving, not the full transfer lifecycle. The goal is to give branch or receiving operators a clear queue of inbound transfers, show expected quantities, capture actual received quantities, and emit `STOCK_TRANSFER_RECEIVED` events through the existing protected backend.

This slice should reuse the current backend event ingestion, transfer projector, and dashboard model rather than introducing a separate transfer state store.

## Why This Is The Best Next Step

The current system already has:

- protected backend ingestion for transfer lifecycle events
- event storage with idempotency
- replay and reconciliation for transfer lifecycle events
- a warehouse workbench that can emit request, approval, dispatch, and receipt events
- a projector that derives transfer status and line quantity rollups from backend events

The narrowest useful next UI surface is receiving because it sits at the operational point where discrepancies become business-relevant. It is smaller and safer than a full warehouse board, but more operationally meaningful than continuing to extend a generic event demo.

## User Workflow

Primary operator: warehouse receiving or branch receiving user.

Workflow:

1. Load inbound transfers relevant to the receiving location.
2. See which transfers are ready to receive.
3. Inspect line-level requested, approved, and dispatched quantities.
4. Enter actual received quantities per line.
5. Optionally enter notes for discrepancies or short receipt conditions.
6. Submit one `STOCK_TRANSFER_RECEIVED` event for the selected transfer.
7. Refresh projected state from backend events.
8. See the transfer move to `received` or `partial_receipt`.

## Scope Boundaries

In scope:

- receiving-focused warehouse state model
- inbound transfer queue derived from projected backend events
- line-level receiving command generation
- discrepancy-aware receive payload generation
- backend submission of `STOCK_TRANSFER_RECEIVED`
- re-rendering after submission
- README and operator usage notes
- tests for projection filtering and payload generation

Out of scope for this slice:

- approval editing
- dispatch editing
- request creation UI
- transfer rejection
- transfer cancellation
- React/Electron screens
- persistent local warehouse DB

## Design Approach Options

### Option A: Receiving-first console/model layer

Add a receiving-specific model, action layer, and renderer on top of the current event-driven dashboard.

Pros:

- fastest path to useful operator workflow
- aligns with current warehouse app architecture
- preserves focus on business logic before GUI scaffolding
- easy to validate against live backend

Cons:

- still not a visual desktop screen
- operator interaction remains scripted or command-driven

### Option B: Full transfer board first

Replace the current workbench with a broad transfer board that covers request, approval, dispatch, and receipt.

Pros:

- more complete transfer overview
- closer to final warehouse UI vision

Cons:

- broader scope
- more decision surface and UI complexity
- delays useful receiving-specific behavior

### Option C: React/Electron receiving screen now

Skip model-first work and build visual UI immediately.

Pros:

- visible UI progress
- closer to final product surface

Cons:

- higher implementation complexity
- state and behavior decisions become mixed with rendering concerns
- higher risk of shallow UI over incomplete operational logic

## Recommended Approach

Implement Option A now.

Reasoning:

- The repo already has the exact backend and projection primitives this approach needs.
- The warehouse app is already organized as a backend-facing model/workbench rather than a finished UI.
- This keeps behavior testable and narrow before we spend time on rendering and Electron concerns.

## Target Architecture

Extend `apps/warehouse/src` with receiving-specific modules:

- `receiving-model.ts`
- `receiving-actions.ts`
- `receiving-renderer.ts`
- `receiving-model.test.ts`
- `receiving-actions.test.ts`

Existing modules to reuse:

- `backend-client.ts`
- `projector.ts`
- `models.ts`
- `dashboard.ts`
- `main.ts`

## Component Responsibilities

### `receiving-model.ts`

Purpose:

- derive a receiving queue from `WarehouseDashboardState`
- filter transfers down to those that are actionable for receiving

Rules:

- include transfers with status `dispatched` or `partial_receipt`
- exclude fully `received` transfers
- present each line with:
  - product id
  - optional variant id
  - requested quantity
  - approved quantity
  - dispatched quantity
  - already received quantity
  - outstanding quantity to receive
- surface a transfer-level summary:
  - transfer id
  - request number
  - source and destination
  - current status
  - line count
  - total outstanding quantity

### `receiving-actions.ts`

Purpose:

- convert receiving input into a valid `STOCK_TRANSFER_RECEIVED` event payload
- submit it through `WarehouseBackendClient`

Rules:

- require one selected transfer
- require received quantities for at least one line
- allow partial receipt
- default unspecified line quantities to zero additional receipt unless explicitly disallowed by validation
- compute whether the event will leave the transfer in `partial_receipt` or `received` after projection
- include operator notes when present

Validation:

- no received line may be negative
- no received line may exceed remaining dispatched quantity
- transfer item ids must map to known projected lines

### `receiving-renderer.ts`

Purpose:

- render receiving queue summaries and one transfer detail view clearly in terminal output

Display requirements:

- inbound transfer list
- selected transfer header
- line-level columns for dispatched, previously received, newly received, and remaining
- discrepancy cues where newly received is less than remaining dispatched quantity

### `main.ts`

Update behavior to support a receiving-first run mode. The warehouse app should be able to:

1. bootstrap or connect to backend
2. ensure there is an inbound transfer scenario available
3. project backend events
4. render the receiving queue
5. submit a receiving event
6. re-fetch and re-render the queue

This can remain scripted for now; it does not need interactive prompts in this slice.

## Data Flow

1. Backend client reads `/sync/events`.
2. `projectWarehouseDashboard()` derives transfer summaries.
3. `deriveReceivingQueue()` filters and reshapes inbound transfers for receiving.
4. Renderer prints the queue and transfer detail.
5. A scripted receive command builds a `STOCK_TRANSFER_RECEIVED` payload.
6. Backend client posts the receive event to `/sync/events`.
7. App reads `/sync/events` again.
8. Projector recomputes status and quantities.
9. Renderer shows updated state.

## Error Handling

Handle these cases explicitly:

- backend auth failure
- empty inbound queue
- selected transfer not found in projected state
- invalid received quantity
- over-receipt beyond dispatched remainder
- backend write accepted failure or rejected batch result

Failure behavior should be simple:

- fail fast with a precise error
- do not silently clip or auto-correct quantities
- do not mutate local state without a backend acknowledgement

## Testing Strategy

Minimum tests for this slice:

1. receiving model test
   - given mixed transfer statuses, only actionable receiving transfers are returned
2. outstanding quantity test
   - remaining quantity is computed correctly from dispatched minus already received
3. receive payload generation test
   - generated payload contains expected transfer item ids and received quantities
4. over-receipt validation test
   - payload generation rejects quantities above remaining dispatched quantity

Verification run:

- run warehouse app against embedded backend
- confirm a receive event is ingested
- confirm re-projection shows `partial_receipt` or `received` correctly

## Non-Goals For This Slice

- no browser/Electron UI
- no local offline warehouse queue yet
- no warehouse-side persistence layer
- no role-based workflow branching in the warehouse app itself
- no product catalog enrichment beyond ids already present in event payloads

## Implementation Notes

- Keep this slice aligned with the existing event-sourced flow.
- Do not create a separate transfer table or local cache in the warehouse app.
- Prefer deterministic demo data and UUIDs consistent with the rest of the repo.
- Keep modules small and composable so a later React/Electron layer can wrap them directly.

## Success Criteria

This design is complete when:

- the warehouse app can derive a receiving queue from backend events
- it can submit a valid `STOCK_TRANSFER_RECEIVED` event for one transfer
- the backend accepts the event
- re-projection updates transfer status correctly
- tests cover receiving queue derivation and payload validation
- README documents how to run the receiving-first flow
