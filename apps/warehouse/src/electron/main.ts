import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { IPC_CHANNELS } from "./ipc.ts";
import { WarehouseUiService } from "./warehouse-ui-service.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
let service: WarehouseUiService | null = null;

async function getService(): Promise<WarehouseUiService> {
  if (!service) {
    service = await WarehouseUiService.createForApp();
  }

  return service;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.loadSnapshot, async () => (await getService()).loadSnapshot());
  ipcMain.handle(IPC_CHANNELS.seedDemoLifecycle, async () => (await getService()).seedDemoLifecycle());
  ipcMain.handle(IPC_CHANNELS.receiveTransfer, async (_event, input) =>
    (await getService()).receiveTransfer(input)
  );
  ipcMain.handle(IPC_CHANNELS.rejectTransfer, async (_event, input) =>
    (await getService()).rejectTransfer(input)
  );
  ipcMain.handle(IPC_CHANNELS.cancelTransfer, async (_event, input) =>
    (await getService()).cancelTransfer(input)
  );
}

async function createWindow(): Promise<void> {
  const preloadPath = join(currentDir, "../../dist/electron/preload.js");
  const indexPath = join(currentDir, "../../dist/ui/index.html");

  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error(`[pipeflow-warehouse] did-fail-load code=${code} description=${description} url=${validatedUrl}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[pipeflow-warehouse] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
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
