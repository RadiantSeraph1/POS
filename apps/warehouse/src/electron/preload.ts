import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "./ipc.ts";
import type { ReceiveTransferCommand } from "./warehouse-ui-service.ts";

const api = {
  loadSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.loadSnapshot),
  seedDemoLifecycle: () => ipcRenderer.invoke(IPC_CHANNELS.seedDemoLifecycle),
  receiveTransfer: (input: ReceiveTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.receiveTransfer, input)
};

contextBridge.exposeInMainWorld("pipeflowWarehouse", api);
