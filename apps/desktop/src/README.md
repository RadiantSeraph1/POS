# Desktop App Notes

The desktop app now has two runnable surfaces on top of the existing local sale transaction boundary:

- a terminal-driven POS model flow
- an Electron + React cashier shell

Current code demonstrates how a cashier-oriented screen should behave while still using the same local transaction write set:

- `sales`
- `sale_items`
- `payments`
- `receipts`
- `inventory_events`
- `inventory_levels`
- `sync_queue`

## Current State

The desktop app includes a real SQLite transaction runner using Node's built-in `node:sqlite` module.

`src/main.ts` currently:

- creates a local SQLite database in `data/desktop`
- applies the branch schema
- seeds minimum reference data
- loads a local sellable catalog
- builds a cashier cart with one base product and one variant product
- renders a single-screen POS view with totals and split payments
- submits one real local sale through `createLocalSale()`
- shows sync queue state before and after queue processing
- blocks one intentional oversell attempt
- simulates repeated transport failures until a queue item reaches `dead_letter`
- generates fresh sale, item, payment, and event IDs per run so live backend demos do not collide with older cloud data

`src/electron/main.ts` and `src/ui/*` now provide:

- Electron main process bootstrap
- preload bridge for desktop POS actions
- React cashier shell
- catalog, cart, checkout, and sync status panels
- cart remove and clear-cart controls
- editable cash and mobile-money split payment inputs
- sale submission through the same local POS service layer

## Desktop Commands

Electron shell:

```powershell
npm.cmd run dev --prefix apps/desktop
```

Terminal POS flow:

```powershell
npm.cmd run dev:cli --prefix apps/desktop
```

Build desktop shell:

```powershell
npm.cmd run build --prefix apps/desktop
```

## Live Backend Mode

You can point the desktop demo at an already-running backend instead of the embedded self-test backend.

Set:

- `PIPEFLOW_SYNC_BASE_URL=http://127.0.0.1:3000`

Then run the desktop entrypoint. It will:

- keep the local SQLite branch simulation
- render the cashier-oriented POS flow locally
- sync to the live backend URL
- fetch `GET /sync/events` afterward to show what the backend stored
- leave the accepted event ready for `npm.cmd run replay:sales:postgres --prefix apps/backend`

## Next Step

Replace the first cashier shell with a more complete production UI layer: better product search, suspended sales, clearer sale/sync feedback, and hardware-aware operator flows.
