import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "./ipc.ts";
import type {
  CancelTransferCommand,
  ReceiveTransferCommand,
  RejectTransferCommand
} from "./warehouse-ui-service.ts";

const api = {
  loadSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.loadSnapshot),
  seedDemoLifecycle: () => ipcRenderer.invoke(IPC_CHANNELS.seedDemoLifecycle),
  receiveTransfer: (input: ReceiveTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.receiveTransfer, input),
  rejectTransfer: (input: RejectTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.rejectTransfer, input),
  cancelTransfer: (input: CancelTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelTransfer, input)
};

contextBridge.exposeInMainWorld("pipeflowWarehouse", api);
