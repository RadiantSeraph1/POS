# Desktop POS UI Shell Design

Date: 2026-05-15
Status: Drafted from validated repo state
Scope: `apps/desktop`

## Objective

Build the first actual cashier UI shell for the desktop app. This shell should wrap the existing POS model layer rather than replace it. The resulting desktop app should present a real cashier screen with:

- a product/catalog panel
- a cart panel
- totals and split-payment entry
- a compact sync status panel
- sale submission through the existing local transaction path

This slice should introduce the minimum Electron and React runtime needed to host the proven local-first POS behavior. It should not re-implement sales, inventory, or sync logic in the renderer.

## Current Constraint

`apps/desktop` is currently a Node TypeScript package only. It has:

- no Electron bootstrap
- no renderer process
- no React runtime
- no CSS or component system

That means the next UI slice must include runtime scaffolding as part of the design. Any plan that assumes an existing Electron/React surface would be wrong.

## Why This Is The Best Next Step

The local POS model layer now exists and has already been verified:

- catalog lookup
- cart totals
- split-payment validation
- sale submission through `createLocalSale()`
- queue state before and after sync
- oversell blocking

The next gap is no longer backend correctness for checkout. It is that the operator still only sees terminal output. A thin cashier shell is the highest-value remaining step because it turns proven transaction behavior into an actual product surface.

## User Workflow

Primary operator: cashier.

Workflow:

1. Open the desktop POS app.
2. See a single-screen cashier layout.
3. Select products from the local catalog.
4. Add products to cart.
5. Review totals.
6. Enter split payments.
7. Submit one sale.
8. See local sync status update.
9. Trigger sync processing and see status refresh.

## Scope Boundaries

In scope:

- Electron main process bootstrap
- preload bridge exposing desktop POS actions
- React renderer shell
- single cashier screen using current POS model boundaries
- catalog/cart/payment/sync status panels
- sale submission and post-sale refresh
- a minimal local styling system

Out of scope:

- barcode scanner integration
- printer integration
- cashier authentication screen
- refunds
- suspended sales
- warehouse screens inside the desktop app
- advanced routing

## Design Approach Options

### Option A: Thin Electron + React shell over existing POS model

Add Electron main/preload and a renderer that calls a local desktop bridge, while keeping sale and sync logic in the current desktop package.

Pros:

- preserves the current local-first architecture
- uses the existing POS model instead of replacing it
- produces a real cashier UI with limited scope
- clean separation between renderer and local system access

Cons:

- requires initial runtime/tooling setup
- adds dependency footprint

### Option B: Browser-only local shell first

Skip Electron and run a browser-hosted local POS screen on top of the same model.

Pros:

- smaller bootstrap
- easier iteration

Cons:

- not a real desktop shell
- delays the preload/main-process boundary that this product will need

### Option C: Full feature-rich Electron app immediately

Add routing, multiple screens, persistent settings, and richer desktop structure now.

Pros:

- closer to final product shape

Cons:

- too much scope for one slice
- high risk of UI scaffolding outrunning proven behavior

## Recommended Approach

Implement Option A now.

Reasoning:

- the app needs a real desktop shell, not another intermediate demo surface
- the current POS model modules are already shaped well enough to become the renderer’s business layer
- a thin preload bridge prevents renderer code from directly owning SQLite or transaction logic

## Target Architecture

Add these desktop runtime layers:

- Electron main process
- preload bridge
- React renderer app

Proposed file structure:

- `apps/desktop/src/electron/main.ts`
- `apps/desktop/src/electron/preload.ts`
- `apps/desktop/src/electron/ipc.ts`
- `apps/desktop/src/ui/index.html`
- `apps/desktop/src/ui/main.tsx`
- `apps/desktop/src/ui/App.tsx`
- `apps/desktop/src/ui/styles.css`
- `apps/desktop/src/ui/components/CatalogPanel.tsx`
- `apps/desktop/src/ui/components/CartPanel.tsx`
- `apps/desktop/src/ui/components/CheckoutPanel.tsx`
- `apps/desktop/src/ui/components/SyncStatusPanel.tsx`
- `apps/desktop/src/ui/hooks/usePosScreen.ts`

Reuse existing business modules:

- `src/pos/catalog.ts`
- `src/pos/cart.ts`
- `src/pos/checkout.ts`
- `src/pos/sync-panel.ts`
- `src/sales/create-local-sale.ts`
- `src/sync/queue-processor.ts`
- `src/db.ts`

## Runtime Boundary

### Main process

Responsibilities:

- create Electron window
- load renderer entry
- own app lifecycle

### Preload bridge

Responsibilities:

- expose a narrow API to the renderer
- keep Node and SQLite access outside React

Bridge methods:

- `loadCatalog()`
- `loadPosSnapshot()`
- `addToCart(productId, variantId?)`
- `updateCartQuantity(stockKey, quantity)`
- `setPayments(payments)`
- `submitSale()`
- `processSyncQueue()`
- `resetDemoState()`

### Renderer

Responsibilities:

- render cashier screen
- hold view state only
- call preload bridge actions
- re-render from returned snapshots

The renderer must not:

- open SQLite directly
- call `createLocalSale()` directly
- own sync queue processing directly

## Screen Layout

Single-screen cashier layout:

- left: catalog/product selector
- center: cart
- right upper: totals and split payments
- right lower: sync status and inventory summary

The layout should prioritize speed and scanability over visual novelty. This is a cashier workstation, not a marketing surface.

## State Shape

The UI should render from one screen snapshot object returned by the preload bridge.

Minimum snapshot fields:

- catalog items
- cart lines
- cart summary
- payment inputs
- queue summary
- inventory summary
- last submit result
- current error message

This snapshot can be assembled from the existing POS modules and returned as one object to reduce renderer-side orchestration.

## Data Flow

1. App boots Electron main process.
2. Renderer loads and requests initial POS snapshot.
3. Preload-backed service loads catalog, queue summary, inventory summary, and current cart state.
4. Cashier adds items to cart.
5. Renderer sends actions through preload.
6. Preload-backed service updates cart state and returns new snapshot.
7. Cashier submits sale.
8. Backend service validates checkout and calls `createLocalSale()`.
9. Snapshot refresh shows queue `pending`.
10. Cashier triggers sync processing.
11. Snapshot refresh shows queue `synced` or failure state.

## Styling Direction

This first shell should be functional and intentional, not ornate.

Guidelines:

- light workstation-style surface
- dense but readable information layout
- visible quantity and money hierarchy
- clear status colors for queue health
- avoid generic placeholder dashboard styling

Do not spend this slice on a design system. Use one scoped stylesheet and a few small components.

## Error Handling

Handle these cases explicitly:

- preload bridge unavailable
- failed catalog load
- empty cart submit
- payment total mismatch
- oversell rejection
- sync transport failure

Failure behavior:

- show one clear inline error area
- preserve cart state after failed submit
- preserve queue state after failed sync

## Testing Strategy

Minimum for this slice:

1. keep existing POS model tests green
2. add one preload/service test for snapshot assembly if practical without overbuilding harness code
3. run desktop typecheck after new runtime files are added
4. run the Electron/renderer app locally and verify:
   - catalog renders
   - cart updates
   - totals update
   - sale submits
   - sync status updates

## Non-Goals For This Slice

- no offline auth cache UX
- no cross-window workflows
- no advanced navigation
- no warehouse features in this app
- no hardware integrations

## Implementation Notes

- keep the current POS model layer as the business boundary
- do not move transaction logic into React components
- prefer a preload service facade that returns full snapshots over many tiny renderer calls
- introduce only the dependencies needed for the first shell

## Success Criteria

This design is complete when:

- `apps/desktop` boots an actual Electron + React cashier shell
- the renderer shows catalog, cart, totals, payments, and sync status
- sale submission still goes through the existing local transaction path
- sync status refresh works after queue processing
- existing POS model tests still pass
- docs reflect the new desktop runtime shape
