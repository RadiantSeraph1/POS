export const IPC_CHANNELS = {
  loadSnapshot: "pipeflow-pos:loadSnapshot",
  addCatalogItem: "pipeflow-pos:addCatalogItem",
  updateCartQuantity: "pipeflow-pos:updateCartQuantity",
  clearCart: "pipeflow-pos:clearCart",
  setPayments: "pipeflow-pos:setPayments",
  submitSale: "pipeflow-pos:submitSale",
  processSyncQueue: "pipeflow-pos:processSyncQueue",
  resetDemoState: "pipeflow-pos:resetDemoState"
} as const;
