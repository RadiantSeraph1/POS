export const IPC_CHANNELS = {
  loadSnapshot: "pipeflow-warehouse:loadSnapshot",
  seedDemoLifecycle: "pipeflow-warehouse:seedDemoLifecycle",
  receiveTransfer: "pipeflow-warehouse:receiveTransfer",
  approveTransfer: "pipeflow-warehouse:approveTransfer",
  dispatchTransfer: "pipeflow-warehouse:dispatchTransfer",
  rejectTransfer: "pipeflow-warehouse:rejectTransfer",
  cancelTransfer: "pipeflow-warehouse:cancelTransfer"
} as const;
