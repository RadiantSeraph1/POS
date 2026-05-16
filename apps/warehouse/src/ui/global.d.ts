import type {
  ApproveTransferCommand,
  CancelTransferCommand,
  DispatchTransferCommand,
  ReceiveTransferCommand,
  RejectTransferCommand,
  WarehouseShellSnapshot
} from "../electron/warehouse-ui-service.ts";

declare global {
  interface Window {
    pipeflowWarehouse: {
      loadSnapshot(): Promise<WarehouseShellSnapshot>;
      seedDemoLifecycle(): Promise<WarehouseShellSnapshot>;
      receiveTransfer(input: ReceiveTransferCommand): Promise<WarehouseShellSnapshot>;
      approveTransfer(input: ApproveTransferCommand): Promise<WarehouseShellSnapshot>;
      dispatchTransfer(input: DispatchTransferCommand): Promise<WarehouseShellSnapshot>;
      rejectTransfer(input: RejectTransferCommand): Promise<WarehouseShellSnapshot>;
      cancelTransfer(input: CancelTransferCommand): Promise<WarehouseShellSnapshot>;
    };
  }
}

export {};
