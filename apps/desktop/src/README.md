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
- React role-based desktop shell
- left-rail workspace navigation
- catalog, cart, checkout, and sync status panels
- catalog search by SKU or product name
- cart remove and clear-cart controls
- suspended sale save, resume, and delete flow
- editable cash and mobile-money split payment inputs
- status banners for sale, cart, payment, sync, and reset actions
- inline checkout mismatch feedback before submit
- sale submission through the same local POS service layer
- recovery panel with recent local sales and raw queue detail
- retry-one and retry-all actions for failed or dead-letter queue records
- shift summary panel with cashier-facing totals and attention counts
- filtered recent-sales and queue views inside the recovery panel
- explicit dead-letter attention banner for operator follow-up
- recent-sale detail inspection with item and payment breakdowns
- shift-close readiness state with explicit blocking reasons
- dead-letter guidance text that turns raw sync errors into operator actions
- first Branch Manager dashboard page using the same local branch snapshot
- role placeholders for Warehouse, Accountant, and Admin areas while their dedicated pages are still being defined

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

Deepen the cashier shell beyond the current operational baseline:

- hardware-aware operator flows
- broader manager-facing summaries
- deeper queue tooling for multi-step remediation and escalation
