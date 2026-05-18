import type { PosScreenSnapshot } from "../electron/desktop-pos-service.ts";

declare global {
  interface Window {
    pipeflowPos: {
      loadSnapshot(): Promise<PosScreenSnapshot>;
      addCatalogItem(input: { productId: string; productVariantId?: string }): Promise<PosScreenSnapshot>;
      updateCartQuantity(input: { stockKey: string; quantity: number }): Promise<PosScreenSnapshot>;
      clearCart(): Promise<PosScreenSnapshot>;
      suspendCurrentSale(label?: string): Promise<PosScreenSnapshot>;
      resumeSuspendedSale(id: string): Promise<PosScreenSnapshot>;
      deleteSuspendedSale(id: string): Promise<PosScreenSnapshot>;
      setPayments(
        payments: Array<{
          paymentId?: string;
          method: string;
          amountMinor: number;
          providerCode?: string;
          externalReference?: string;
          status: string;
          paidAt: string;
        }>
      ): Promise<PosScreenSnapshot>;
      submitSale(): Promise<PosScreenSnapshot>;
      processSyncQueue(): Promise<PosScreenSnapshot>;
      retryQueueItem(id: string): Promise<PosScreenSnapshot>;
      retryAllQueueItems(): Promise<PosScreenSnapshot>;
      resetDemoState(): Promise<PosScreenSnapshot>;
    };
  }
}

export {};
