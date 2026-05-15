import type { WarehouseShellSnapshot } from "../electron/warehouse-ui-service.ts";
import type { ReceiveTransferCommand } from "../electron/warehouse-ui-service.ts";

declare global {
  interface Window {
    pipeflowWarehouse: {
      loadSnapshot(): Promise<WarehouseShellSnapshot>;
      seedDemoLifecycle(): Promise<WarehouseShellSnapshot>;
      receiveTransfer(input: ReceiveTransferCommand): Promise<WarehouseShellSnapshot>;
    };
  }
}

export {};
