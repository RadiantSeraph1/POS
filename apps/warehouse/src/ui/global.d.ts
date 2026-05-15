import type {
  CancelTransferCommand,
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
      rejectTransfer(input: RejectTransferCommand): Promise<WarehouseShellSnapshot>;
      cancelTransfer(input: CancelTransferCommand): Promise<WarehouseShellSnapshot>;
    };
  }
}

export {};
