import { useEffect, useState } from "react";

import type {
  ReceiveTransferCommand,
  WarehouseShellSnapshot
} from "../../electron/warehouse-ui-service.ts";

export function useWarehouseScreen() {
  const [snapshot, setSnapshot] = useState<WarehouseShellSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.pipeflowWarehouse
      .loadSnapshot()
      .then((next) => {
        setSnapshot(next);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function run(action: Promise<WarehouseShellSnapshot>): Promise<void> {
    setIsLoading(true);
    try {
      const next = await action;
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return {
    snapshot,
    isLoading,
    error,
    seedDemoLifecycle: () => run(window.pipeflowWarehouse.seedDemoLifecycle()),
    receiveTransfer: (input: ReceiveTransferCommand) =>
      run(window.pipeflowWarehouse.receiveTransfer(input))
  };
}
