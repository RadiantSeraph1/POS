import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function loadBranchManagerDashboardPanel() {
  const entryPoint = fileURLToPath(new URL("./BranchManagerDashboardPanel.tsx", import.meta.url));
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "node",
    write: false
  });

  const moduleUrl = `data:text/javascript,${encodeURIComponent(result.outputFiles[0].text)}`;
  return import(moduleUrl);
}

test("BranchManagerDashboardPanel renders the hybrid manager dashboard sections", async () => {
  const { BranchManagerDashboardPanel } = await loadBranchManagerDashboardPanel();
  const markup = renderToStaticMarkup(
    React.createElement(BranchManagerDashboardPanel, {
      shift: {
        salesCount: 6,
        grossTotalMinor: 286500,
        syncedSalesCount: 4,
        attentionSalesCount: 2,
        deadLetterSalesCount: 1,
        suspendedDraftCount: 2,
        openCartLineCount: 1,
        readyToClose: false,
        blockers: ["1 dead-letter sale(s)", "2 suspended draft(s)"]
      },
      sync: {
        pending: 1,
        processing: 0,
        synced: 4,
        failed: 1,
        deadLetter: 1,
        lastError: "HTTP request failed: backend not reachable"
      },
      inventory: [
        { productId: "prod-a", sellableQuantity: 3 },
        { productId: "prod-b", productVariantId: "var-b", sellableQuantity: 9 }
      ],
      recentSales: [
        {
          saleId: "sale-1",
          saleNumber: "POS-24051",
          totalMinor: 93750,
          happenedAt: "2026-05-18T09:00:00.000Z",
          syncStatus: "failed",
          eventId: "event-1",
          retryCount: 2,
          itemCount: 2,
          items: [{ name: "PVC Pipe 110mm", quantity: 1, lineTotalMinor: 50000 }],
          payments: [{ method: "cash", amountMinor: 50000 }]
        }
      ],
      suspendedSales: [
        {
          id: "suspend-1",
          label: "Site Counter Hold",
          totalMinor: 6250,
          itemCount: 1,
          updatedAt: "2026-05-18T09:10:00.000Z"
        }
      ]
    })
  );

  assert.match(markup, /Sales Today/);
  assert.match(markup, /Transaction Count/);
  assert.match(markup, /Sync Attention/);
  assert.match(markup, /Shift-Close Blockers/);
  assert.match(markup, /Action Queue/);
  assert.match(markup, /Team Activity/);
  assert.match(markup, /Stock Risk/);
  assert.match(markup, /Recent Sales/);
});
