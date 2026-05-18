# Branch Manager Dashboard Design

Date: 2026-05-18
Area: `apps/desktop` manager shell
Status: Draft approved in conversation, written for review before implementation

## Goal

Replace the current lightweight Branch Manager dashboard with a real manager-facing operations page inside the role-based desktop shell.

This page should feel like a branch command center rather than a placeholder. It must work in the current desktop browser preview and Electron shell without introducing a second state system.

## Scope

This slice covers only the `Branch Manager -> Dashboard` page.

It does not include:

- new backend endpoints
- cloud reporting queries
- new warehouse pages
- Accountant or Admin implementation
- hardware integration
- persistent manager-specific settings

## Design Summary

The dashboard uses a hybrid layout:

- top KPI header row with balanced health and performance metrics
- mixed action lane beneath it, combining alerts and team activity
- lower split layout with operational panels on the left and performance context on the right

The page remains driven by the existing desktop `PosScreenSnapshot` so that browser preview and Electron keep sharing the same UI contract.

## Information Architecture

### Header row

The KPI header contains four cards:

1. `Sales Today`
   - value: shift gross total
   - support text: current shift sales count

2. `Transaction Count`
   - value: shift sales count
   - support text: synced vs attention sales

3. `Sync Attention`
   - value: count of queue items needing attention
   - support text: failed plus dead-letter counts

4. `Shift-Close Blockers`
   - value: blocker count
   - support text: `Ready to close` when zero, otherwise strongest blocker summary

This is intentionally balanced: two performance metrics and two branch-health metrics.

### Mixed action lane

This lane is a two-column strip directly under the KPI row.

Left card: `Action Queue`

- low-stock count
- failed sync count
- dead-letter count
- suspended draft count
- top required action text

Right card: `Team Activity`

- latest cashier activity summary from recent sales
- open shift attention count
- latest sale timestamp
- suspended draft count as a cashier follow-up signal

The action lane is not a full task manager. It is a fast manager triage surface.

### Lower split layout

The lower half is split into two columns.

Left column: operational stack

- `Stock Risk`
  - show the lowest sellable stock lines first
  - highlight items at or below threshold
- `Sync Health`
  - show pending, failed, dead-letter, and last known error
- `Open Blockers`
  - show explicit shift-close blockers from the existing shift summary

Right column: performance context stack

- `Recent Sales`
  - latest branch sales with sync state badge
- `Cashier Activity`
  - derived summary from the recent local sales list
  - this remains synthetic for now because the current snapshot is shift-centric, not multi-cashier
- `Short Trend`
  - lightweight summary cards, not a full chart
  - examples: synced share, attention share, suspended drafts trend marker

The right column should feel analytical, but still grounded in current local data instead of pretending to be full BI.

## Component Plan

### `BranchManagerDashboardPanel`

This component will be expanded into a composed page container rather than a single simple panel.

Responsibilities:

- derive manager-oriented metrics from `PosScreenSnapshot`
- render the dashboard sections in the approved layout
- keep display logic local to the manager surface

### Suggested subcomponents

Create focused presentational components under `apps/desktop/src/ui/components`:

- `ManagerKpiRow.tsx`
- `ManagerActionLane.tsx`
- `ManagerOperationalColumn.tsx`
- `ManagerPerformanceColumn.tsx`

If these stay small, they can remain inside one file. If the panel becomes hard to scan, split them.

## Data Mapping

Use only current desktop snapshot inputs:

- `reporting.shift`
  - sales count
  - gross total
  - synced sales count
  - attention sales count
  - dead-letter sales count
  - suspended draft count
  - ready-to-close state
  - blockers

- `sync`
  - pending
  - processing
  - synced
  - failed
  - deadLetter
  - lastError

- `inventory`
  - low-stock and inventory watch lists

- `recovery.recentSales`
  - recent sales cards
  - team activity summaries
  - latest sale timestamps

- `suspendedSales`
  - manager draft attention count

No new service work is required for this slice unless implementation reveals a truly missing derived field.

## Visual Direction

Follow the selected product direction:

- modern enterprise base system
- operational variant for role surfaces that supervise live work

Manager screens should be calmer than Cashier but still denser than pure executive reporting.

Specific visual rules:

- retain the existing left rail shell
- keep the current neutral surface palette and green accent family
- use larger KPI cards than the current metric tiles
- keep operational warning states visible but not loud
- use compact badges and short helper text
- avoid full data tables in this first manager dashboard slice

## Responsive Behavior

Desktop-first, but the browser preview should remain usable at narrower widths.

Expected behavior:

- KPI row collapses from 4 columns to 2 columns, then 1 column on narrow widths
- action lane stacks vertically on smaller widths
- lower split layout stacks into a single column below desktop breakpoint

## Error and Empty States

- if there are no recent sales, show a calm empty state instead of blank space
- if there are no blockers, show `Ready to close`
- if there are no low-stock items, show a normal-state message instead of an error tone
- if no sync errors exist, suppress the last-error emphasis

## Testing

Update or add UI-oriented tests only where current coverage makes sense.

Required verification gates:

- `npm.cmd run test --prefix apps/desktop`
- `npm.cmd run typecheck --prefix apps/desktop`
- `npm.cmd run build --prefix apps/desktop`

Manual verification:

- `npm.cmd run dev:web --prefix apps/desktop`
- open `http://127.0.0.1:4173`
- inspect the Branch Manager dashboard in the browser preview

## Acceptance Criteria

This slice is complete when:

1. the Branch Manager dashboard visually matches the approved hybrid structure
2. the KPI row emphasizes balanced health and performance metrics
3. the upper lane combines alerts and team activity in one compact section
4. the lower half clearly separates operational issues from performance context
5. the dashboard uses only the current desktop snapshot contract
6. the browser preview and Electron shell both render the same manager page structure
7. docs reflect the new manager dashboard baseline

## Out of Scope Next

After this page lands, the next likely manager UI slices are:

- dedicated Inventory page
- dedicated Sales page
- broader Warehouse shell visual alignment
- Accountant and Admin role pages
