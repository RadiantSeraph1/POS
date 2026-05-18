import type { PosPaymentInput } from "../pos/checkout.ts";
import type { PosScreenSnapshot } from "../electron/desktop-pos-service.ts";

export interface PipeflowPosBridge {
  loadSnapshot(): Promise<PosScreenSnapshot>;
  addCatalogItem(input: { productId: string; productVariantId?: string }): Promise<PosScreenSnapshot>;
  updateCartQuantity(input: { stockKey: string; quantity: number }): Promise<PosScreenSnapshot>;
  clearCart(): Promise<PosScreenSnapshot>;
  suspendCurrentSale(label?: string): Promise<PosScreenSnapshot>;
  resumeSuspendedSale(id: string): Promise<PosScreenSnapshot>;
  deleteSuspendedSale(id: string): Promise<PosScreenSnapshot>;
  setPayments(payments: PosPaymentInput[]): Promise<PosScreenSnapshot>;
  submitSale(): Promise<PosScreenSnapshot>;
  processSyncQueue(): Promise<PosScreenSnapshot>;
  retryQueueItem(id: string): Promise<PosScreenSnapshot>;
  retryAllQueueItems(): Promise<PosScreenSnapshot>;
  resetDemoState(): Promise<PosScreenSnapshot>;
}
