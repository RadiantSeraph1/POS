import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopPosService } from "./desktop-pos-service.ts";
import { IPC_CHANNELS } from "./ipc.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
let service: DesktopPosService | null = null;

async function getService(): Promise<DesktopPosService> {
  if (!service) {
    service = await DesktopPosService.createForApp();
  }

  return service;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.loadSnapshot, async () => (await getService()).loadSnapshot());
  ipcMain.handle(IPC_CHANNELS.addCatalogItem, async (_event, input) =>
    (await getService()).addCatalogItem(input)
  );
  ipcMain.handle(IPC_CHANNELS.updateCartQuantity, async (_event, input) =>
    (await getService()).updateCartQuantity(input)
  );
  ipcMain.handle(IPC_CHANNELS.clearCart, async () => (await getService()).clearCart());
  ipcMain.handle(IPC_CHANNELS.suspendCurrentSale, async (_event, label) =>
    (await getService()).suspendCurrentSale(label)
  );
  ipcMain.handle(IPC_CHANNELS.resumeSuspendedSale, async (_event, id) =>
    (await getService()).resumeSuspendedSale(id)
  );
  ipcMain.handle(IPC_CHANNELS.deleteSuspendedSale, async (_event, id) =>
    (await getService()).deleteSuspendedSale(id)
  );
  ipcMain.handle(IPC_CHANNELS.setPayments, async (_event, payments) =>
    (await getService()).setPayments(payments)
  );
  ipcMain.handle(IPC_CHANNELS.submitSale, async () => (await getService()).submitSale());
  ipcMain.handle(IPC_CHANNELS.processSyncQueue, async () => (await getService()).processSyncQueue());
  ipcMain.handle(IPC_CHANNELS.resetDemoState, async () => {
    if (service) {
      await service.dispose();
    }

    service = await DesktopPosService.createForApp();
    return service.loadSnapshot();
  });
}

async function createWindow(): Promise<void> {
  const preloadPath = join(currentDir, "../../dist/electron/preload.js");
  const indexPath = join(currentDir, "../../dist/ui/index.html");

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error(`[pipeflow-desktop] did-fail-load code=${code} description=${description} url=${validatedUrl}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[pipeflow-desktop] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  await win.loadFile(indexPath);

  if (process.env.PIPEFLOW_OPEN_DEVTOOLS === "1") {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  if (service) {
    await service.dispose();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
