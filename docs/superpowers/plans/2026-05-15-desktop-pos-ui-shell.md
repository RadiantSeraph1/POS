# Desktop POS UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Electron + React cashier shell for `apps/desktop` while keeping the existing local sale, cart, checkout, and sync logic as the business layer.

**Architecture:** Introduce a `DesktopPosService` in the desktop package that owns SQLite setup, catalog/cart/payment state, sale submission, and sync processing. Wrap that service with Electron main/preload code and a React renderer that renders one cashier screen from full POS snapshots returned by the preload bridge.

**Tech Stack:** Electron, React, React DOM, esbuild, TypeScript, existing SQLite desktop modules, existing sync queue processor

---

### Task 1: Add runtime dependencies and a failing service test

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/electron/desktop-pos-service.test.ts`
- Create: `apps/desktop/src/electron/desktop-pos-service.ts`

- [ ] **Step 1: Install Electron/React build dependencies**

Run:

```powershell
npm.cmd install --prefix apps/desktop react react-dom electron esbuild
npm.cmd install --prefix apps/desktop --save-dev @types/react @types/react-dom
```

Expected:
- `apps/desktop/package.json` includes the runtime dependencies
- `apps/desktop/package-lock.json` updates cleanly

- [ ] **Step 2: Write the failing desktop service test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { DesktopPosService } from "./desktop-pos-service.ts";

test("DesktopPosService returns a populated initial snapshot", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();

    assert.ok(snapshot.catalog.length >= 2);
    assert.equal(snapshot.cart.lines.length, 0);
    assert.equal(snapshot.sync.pending, 0);
  } finally {
    await service.dispose();
  }
});

test("DesktopPosService adds a catalog item to cart and updates totals", async () => {
  const service = await DesktopPosService.createForTest();

  try {
    const snapshot = await service.loadSnapshot();
    const product = snapshot.catalog[0];
    assert.ok(product);

    const updated = await service.addCatalogItem({
      productId: product.productId,
      productVariantId: product.productVariantId
    });

    assert.equal(updated.cart.lines.length, 1);
    assert.ok(updated.cart.summary.totalMinor > 0);
  } finally {
    await service.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```powershell
node --test --test-isolation=none "apps/desktop/src/electron/desktop-pos-service.test.ts"
```

Expected:
- FAIL with module or export not found for `DesktopPosService`

- [ ] **Step 4: Write minimal service implementation**

Implement a test-friendly service that:

- creates or resets a local SQLite branch database
- applies the existing schema
- seeds reference data using the current desktop seed logic
- exposes `loadSnapshot()` and `addCatalogItem()`

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
node --test --test-isolation=none "apps/desktop/src/electron/desktop-pos-service.test.ts"
```

Expected:
- PASS

### Task 2: Expand service methods to cover cashier actions

**Files:**
- Modify: `apps/desktop/src/electron/desktop-pos-service.ts`
- Modify: `apps/desktop/src/pos/flow.ts`
- Modify: `apps/desktop/src/pos/catalog.ts`

- [ ] **Step 1: Define the UI snapshot contract in the service**

The service snapshot must include:

```ts
{
  catalog,
  cart: {
    lines,
    summary
  },
  payments,
  sync,
  inventory,
  lastSubmitResult,
  errorMessage
}
```

- [ ] **Step 2: Add cashier action methods**

Implement methods:

```ts
loadSnapshot()
addCatalogItem(input)
updateCartQuantity(input)
setPayments(payments)
submitSale()
processSyncQueue()
resetDemoState()
dispose()
```

Rules:
- `submitSale()` must still go through `buildCreateLocalSaleInput()` and `createLocalSale()`
- `processSyncQueue()` must still go through `SyncQueueProcessor`
- cart/payment state lives in the service, not in React

- [ ] **Step 3: Reuse or extract desktop seed logic**

Move any duplicated seeding/setup out of `src/main.ts` as needed so both:
- CLI demo path
- Electron service path

can use the same setup functions.

- [ ] **Step 4: Keep existing POS tests green**

Run:

```powershell
node --test --test-isolation=none "apps/desktop/src/pos/cart.test.ts" "apps/desktop/src/pos/checkout.test.ts" "apps/desktop/src/electron/desktop-pos-service.test.ts"
```

Expected:
- PASS

### Task 3: Add Electron main/preload bootstrap

**Files:**
- Create: `apps/desktop/src/electron/main.ts`
- Create: `apps/desktop/src/electron/preload.ts`
- Create: `apps/desktop/src/electron/ipc.ts`
- Modify: `apps/desktop/tsconfig.json`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add desktop build/dev scripts**

Update `apps/desktop/package.json` scripts to include:

```json
{
  "dev": "node scripts/dev-desktop.mjs",
  "dev:cli": "node --watch src/main.ts",
  "build": "node scripts/build-desktop.mjs",
  "build:cli": "tsc -p tsconfig.json",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "test": "node --test --test-isolation=none \"src/**/*.test.ts\""
}
```

Also add an Electron main entry:

```json
{
  "main": "dist/electron/main.js"
}
```

- [ ] **Step 2: Add Electron main process**

Main process responsibilities:
- create `BrowserWindow`
- point preload to built preload file
- load built `src/ui/index.html`
- open devtools only if explicitly enabled by env

- [ ] **Step 3: Add preload bridge**

Expose a narrow `window.pipeflowPos` API:

```ts
loadSnapshot()
addCatalogItem(input)
updateCartQuantity(input)
setPayments(payments)
submitSale()
processSyncQueue()
resetDemoState()
```

- [ ] **Step 4: Add IPC module**

Keep IPC channels centralized in one file so the renderer and preload agree on names and payload shapes.

- [ ] **Step 5: Run desktop typecheck**

Run:

```powershell
npm.cmd run typecheck --prefix apps/desktop
```

Expected:
- PASS

### Task 4: Add React renderer shell

**Files:**
- Create: `apps/desktop/src/ui/index.html`
- Create: `apps/desktop/src/ui/main.tsx`
- Create: `apps/desktop/src/ui/App.tsx`
- Create: `apps/desktop/src/ui/styles.css`
- Create: `apps/desktop/src/ui/hooks/usePosScreen.ts`
- Create: `apps/desktop/src/ui/components/CatalogPanel.tsx`
- Create: `apps/desktop/src/ui/components/CartPanel.tsx`
- Create: `apps/desktop/src/ui/components/CheckoutPanel.tsx`
- Create: `apps/desktop/src/ui/components/SyncStatusPanel.tsx`

- [ ] **Step 1: Add a minimal renderer entry**

The renderer must:
- mount React
- load one cashier screen
- import one scoped stylesheet

- [ ] **Step 2: Add `usePosScreen()` hook**

This hook should:
- call `window.pipeflowPos.loadSnapshot()` on mount
- hold `snapshot`, `isLoading`, and `error`
- wrap bridge calls and refresh local state from returned snapshots

- [ ] **Step 3: Add cashier components**

Component roles:
- `CatalogPanel`: render catalog items and add-to-cart action
- `CartPanel`: render cart lines and quantity controls
- `CheckoutPanel`: render totals, payment buttons/inputs, submit action
- `SyncStatusPanel`: render queue health and sync action

- [ ] **Step 4: Compose single-screen layout**

`App.tsx` should render:
- left catalog column
- center cart column
- right column with checkout and sync panels
- one inline error area

- [ ] **Step 5: Add minimal cashier styling**

Use one CSS file with:
- a light workstation-style palette
- dense grid layout
- clear totals hierarchy
- clear sync status coloring

### Task 5: Add build scripts and runtime verification

**Files:**
- Create: `apps/desktop/scripts/build-desktop.mjs`
- Create: `apps/desktop/scripts/dev-desktop.mjs`
- Modify: `apps/desktop/src/README.md`
- Modify: `docs/NEXT_STEPS.md`

- [ ] **Step 1: Add esbuild-based renderer/main/preload build**

`build-desktop.mjs` should:
- bundle `src/ui/main.tsx` to `dist/ui/main.js`
- bundle `src/electron/main.ts` to `dist/electron/main.js`
- bundle `src/electron/preload.ts` to `dist/electron/preload.js`
- copy `src/ui/index.html`
- copy or emit `src/ui/styles.css`

- [ ] **Step 2: Add desktop dev runner**

`dev-desktop.mjs` should:
- build once
- start Electron against the built output

For this slice, a simple build-then-run dev flow is enough. Do not overbuild hot reload.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm.cmd run test --prefix apps/desktop
npm.cmd run typecheck --prefix apps/desktop
npm.cmd run build --prefix apps/desktop
```

Expected:
- tests pass
- typecheck passes
- build emits `dist/electron` and `dist/ui`

- [ ] **Step 4: Launch the desktop shell**

Run:

```powershell
npm.cmd run dev --prefix apps/desktop
```

Expected:
- Electron window opens
- catalog renders
- cart updates
- totals render
- sale submit works
- sync panel updates

- [ ] **Step 5: Update docs**

Document:
- new Electron/React runtime shape
- `dev` vs `dev:cli`
- how the cashier shell still uses the same local transaction and sync services
