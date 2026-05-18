export const IPC_CHANNELS = {
  loadSnapshot: "pipeflow-pos:loadSnapshot",
  addCatalogItem: "pipeflow-pos:addCatalogItem",
  updateCartQuantity: "pipeflow-pos:updateCartQuantity",
  clearCart: "pipeflow-pos:clearCart",
  suspendCurrentSale: "pipeflow-pos:suspendCurrentSale",
  resumeSuspendedSale: "pipeflow-pos:resumeSuspendedSale",
  deleteSuspendedSale: "pipeflow-pos:deleteSuspendedSale",
  setPayments: "pipeflow-pos:setPayments",
  submitSale: "pipeflow-pos:submitSale",
  processSyncQueue: "pipeflow-pos:processSyncQueue",
  retryQueueItem: "pipeflow-pos:retryQueueItem",
  retryAllQueueItems: "pipeflow-pos:retryAllQueueItems",
  resetDemoState: "pipeflow-pos:resetDemoState"
} as const;
