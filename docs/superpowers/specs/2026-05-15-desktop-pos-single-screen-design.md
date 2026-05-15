# Desktop POS Single-Screen Model Design

Date: 2026-05-15
Status: Drafted from validated repo state
Scope: `apps/desktop`

## Objective

Build the next desktop-facing POS slice as a single-screen cashier model layer rather than a raw database demo. The goal is to show a cashier-oriented flow that can:

- load products from the local SQLite catalog
- build a cart
- calculate totals
- validate split payments
- submit a sale through the existing local transaction boundary
- surface local sync queue status before and after sync processing

This slice should reuse the existing local SQLite schema, `createLocalSale()` transaction path, and `SyncQueueProcessor` rather than introducing a parallel sale system.

## Why This Is The Best Next Step

The current desktop app already has the critical back-end behavior for a cashier workflow:

- local SQLite writes
- atomic sale persistence
- inventory mutation
- oversell blocking
- sync queue persistence
- queue retry and dead-letter behavior
- real backend sync transport

What is missing is an operator-facing model. Right now, the desktop entrypoint proves infrastructure. It does not yet represent a cashier screen. A single-screen POS model is the smallest useful bridge between proven inventory/sync logic and a real UI shell.

## User Workflow

Primary operator: cashier.

Workflow:

1. Load the local sellable catalog for the branch.
2. Search or select products.
3. Add products and variants to cart.
4. Review quantities and totals.
5. Enter split payment amounts.
6. Submit one sale.
7. See immediate local queue status.
8. Run sync processing.
9. See queue and inventory state after sync.

## Scope Boundaries

In scope:

- product lookup from local SQLite
- cart state and total calculation
- split payment validation
- sale input assembly for `createLocalSale()`
- queue summary projection from local SQLite
- single-screen terminal renderer
- scripted cashier flow in `main.ts`
- tests for cart totals and checkout validation

Out of scope for this slice:

- React/Electron screen components
- barcode device capture
- suspended sales
- customer search UX beyond seeded ids
- receipt printing
- refund flow
- local auth/session UX

## Design Approach Options

### Option A: Single-screen POS model layer

Add focused POS modules for catalog lookup, cart state, checkout validation, sync status projection, and terminal rendering.

Pros:

- matches current repo maturity
- reuses proven sale/sync logic directly
- gives a real cashier-oriented flow quickly
- easy to test and verify

Cons:

- still terminal-rendered
- not yet a visual desktop shell

### Option B: Checkout-only model

Skip a full single-screen model and build only sale input assembly around `createLocalSale()`.

Pros:

- smallest code change
- very low risk

Cons:

- too narrow to count as a cashier surface
- still leaves catalog/cart behavior implicit

### Option C: React/Electron POS shell now

Start visual UI immediately and wire the model later.

Pros:

- visible UI progress
- closer to final product surface

Cons:

- higher surface area
- mixes behavior design with rendering decisions too early
- higher risk of a shallow UI over incomplete transactional logic

## Recommended Approach

Implement Option A now.

Reasoning:

- The repo already has the transaction and sync primitives this approach needs.
- The warehouse app has already shown the value of adding a model/workbench layer before a GUI shell.
- A single-screen cashier model keeps offline and sync behavior visible in the same operator surface.

## Target Architecture

Extend `apps/desktop/src` with a focused POS module set:

- `pos/catalog.ts`
- `pos/cart.ts`
- `pos/checkout.ts`
- `pos/sync-panel.ts`
- `pos/renderer.ts`
- `pos/flow.ts`
- `pos/cart.test.ts`
- `pos/checkout.test.ts`

Existing modules to reuse:

- `db.ts`
- `sales/create-local-sale.ts`
- `sync/queue-processor.ts`
- `demo-ids.ts`
- `main.ts`

## Component Responsibilities

### `pos/catalog.ts`

Purpose:

- read locally sellable products and variants from SQLite
- provide simple lookup helpers for the cashier flow

Rules:

- include both base products and variants
- return enough fields for cart display and sale assembly
- use existing SQLite tables only

Minimum returned fields:

- product id
- optional variant id
- SKU or variant code
- product name
- optional variant name
- current sellable quantity

### `pos/cart.ts`

Purpose:

- hold cart item state
- calculate totals deterministically

Rules:

- support base products and variant products
- quantity changes must be explicit
- cart totals must be derived, not stored redundantly

Cart calculations:

- subtotal
- discount
- tax
- total
- total item count

### `pos/checkout.ts`

Purpose:

- validate payment split input
- convert the cart into `CreateLocalSaleInput`

Rules:

- reject empty carts
- reject empty payment sets
- require payment total to equal sale total
- carry through customer, branch, shift, user, and device context
- generate sale, payment, item, and event ids from the existing demo-id strategy for the scripted flow

### `pos/sync-panel.ts`

Purpose:

- derive a compact sync summary from local `sync_queue`

Displayable state:

- pending count
- processing count
- synced count
- failed count
- dead-letter count
- most recent queue error if present

### `pos/renderer.ts`

Purpose:

- render a single-screen cashier-oriented terminal view

Display sections:

- product/catalog summary
- cart lines
- totals
- payment split
- queue summary
- post-sale inventory summary

### `pos/flow.ts`

Purpose:

- orchestrate the scripted single-screen cashier demo

Flow:

1. load catalog
2. choose one base product and one variant product
3. build a cart
4. render pre-sale screen
5. validate checkout
6. submit sale through `createLocalSale()`
7. render queue state before sync
8. run queue processor
9. render queue state after sync
10. render updated inventory state

## Data Flow

1. Local SQLite is seeded as today.
2. Catalog module reads products, variants, and inventory levels.
3. Cart module creates the sale basket.
4. Checkout module builds `CreateLocalSaleInput`.
5. `createLocalSale()` commits the sale locally.
6. Sync panel reads queue state from SQLite.
7. `SyncQueueProcessor` processes local pending events.
8. Sync panel re-reads queue state.
9. Renderer prints before/after cashier state.

## Error Handling

Handle these cases explicitly:

- product not found in catalog
- invalid cart quantity
- empty cart submission
- payment total mismatch
- oversell rejection from `createLocalSale()`
- sync transport failure reflected in queue state

Failure behavior:

- fail fast with a precise error
- do not silently normalize payment mismatches
- do not mutate cart totals manually

## Testing Strategy

Minimum tests for this slice:

1. cart totals test
   - subtotal, discount, and total are derived correctly
2. cart quantity aggregation test
   - repeated additions to the same line accumulate correctly
3. checkout payment validation test
   - split payments must equal sale total
4. checkout empty cart test
   - empty cart submission is rejected

Verification run:

- run desktop app against embedded backend
- confirm cashier-oriented screen output before sale
- confirm sale commits locally
- confirm queue state changes after sync processing

## Non-Goals For This Slice

- no React/Electron components yet
- no warehouse integration changes
- no customer loyalty UX
- no printer/device abstraction work
- no backend replay changes

## Implementation Notes

- Keep this slice aligned with the existing local-first transaction design.
- Do not bypass `createLocalSale()`.
- Prefer small modules with clear boundaries so a later React/Electron layer can wrap them directly.
- Reuse seeded data and current demo ids to keep the flow deterministic and easy to verify.

## Success Criteria

This design is complete when:

- the desktop app renders a single-screen cashier model before sale submission
- it submits one real local sale through `createLocalSale()`
- queue status is visible before and after sync processing
- tests cover cart totals and checkout validation
- README and `docs/NEXT_STEPS.md` reflect the new POS model layer
