export interface PaymentProvider {
  authorize?(amountMinor: number): Promise<unknown>;
  capture?(reference: string): Promise<unknown>;
  void?(reference: string): Promise<unknown>;
  refund(reference: string, amountMinor: number): Promise<unknown>;
  checkStatus(reference: string): Promise<unknown>;
}

