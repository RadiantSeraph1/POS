import { useEffect, useState } from "react";

import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

export function usePosScreen() {
  const [snapshot, setSnapshot] = useState<PosScreenSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.pipeflowPos
      .loadSnapshot()
      .then((next) => {
        setSnapshot(next);
        setError(next.errorMessage ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function run(action: Promise<PosScreenSnapshot>): Promise<void> {
    setIsLoading(true);
    try {
      const next = await action;
      setSnapshot(next);
      setError(next.errorMessage ?? null);
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
    addCatalogItem: (input: { productId: string; productVariantId?: string }) =>
      run(window.pipeflowPos.addCatalogItem(input)),
    updateCartQuantity: (input: { stockKey: string; quantity: number }) =>
      run(window.pipeflowPos.updateCartQuantity(input)),
    clearCart: () => run(window.pipeflowPos.clearCart()),
    suspendCurrentSale: (label?: string) => run(window.pipeflowPos.suspendCurrentSale(label)),
    resumeSuspendedSale: (id: string) => run(window.pipeflowPos.resumeSuspendedSale(id)),
    deleteSuspendedSale: (id: string) => run(window.pipeflowPos.deleteSuspendedSale(id)),
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
    ) => run(window.pipeflowPos.setPayments(payments)),
    submitSale: () => run(window.pipeflowPos.submitSale()),
    processSyncQueue: () => run(window.pipeflowPos.processSyncQueue()),
    retryQueueItem: (id: string) => run(window.pipeflowPos.retryQueueItem(id)),
    retryAllQueueItems: () => run(window.pipeflowPos.retryAllQueueItems()),
    resetDemoState: () => run(window.pipeflowPos.resetDemoState())
  };
}
