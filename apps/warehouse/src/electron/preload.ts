import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "./ipc.ts";
import type {
  ApproveTransferCommand,
  CancelTransferCommand,
  DispatchTransferCommand,
  ReceiveTransferCommand,
  RejectTransferCommand
} from "./warehouse-ui-service.ts";

const api = {
  loadSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.loadSnapshot),
  seedDemoLifecycle: () => ipcRenderer.invoke(IPC_CHANNELS.seedDemoLifecycle),
  receiveTransfer: (input: ReceiveTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.receiveTransfer, input),
  approveTransfer: (input: ApproveTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.approveTransfer, input),
  dispatchTransfer: (input: DispatchTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.dispatchTransfer, input),
  rejectTransfer: (input: RejectTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.rejectTransfer, input),
  cancelTransfer: (input: CancelTransferCommand) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelTransfer, input)
};

contextBridge.exposeInMainWorld("pipeflowWarehouse", api);
