import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "./ipc.ts";

const api = {
  loadSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.loadSnapshot),
  addCatalogItem: (input: { productId: string; productVariantId?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.addCatalogItem, input),
  updateCartQuantity: (input: { stockKey: string; quantity: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateCartQuantity, input),
  clearCart: () => ipcRenderer.invoke(IPC_CHANNELS.clearCart),
  setPayments: (
    payments: Array<{
      paymentId?: string;
      method: string;
      amountMinor: number;
      providerCode?: string;
      externalReference?: string;
      status: string;
      paidAt: string;
    }>
  ) => ipcRenderer.invoke(IPC_CHANNELS.setPayments, payments),
  submitSale: () => ipcRenderer.invoke(IPC_CHANNELS.submitSale),
  processSyncQueue: () => ipcRenderer.invoke(IPC_CHANNELS.processSyncQueue),
  resetDemoState: () => ipcRenderer.invoke(IPC_CHANNELS.resetDemoState)
};

contextBridge.exposeInMainWorld("pipeflowPos", api);
