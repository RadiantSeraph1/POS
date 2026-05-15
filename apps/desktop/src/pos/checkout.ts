import type { CreateLocalSaleInput } from "../../../../packages/types/src/index.ts";

import type { PosCartState } from "./cart.ts";
import { summarizeCart } from "./cart.ts";

export interface PosPaymentInput {
  paymentId?: string;
  method: string;
  amountMinor: number;
  providerCode?: string;
  externalReference?: string;
  status: string;
  paidAt: string;
}

export function createCheckoutPayments(payments: PosPaymentInput[]): PosPaymentInput[] {
  return payments;
}

export function buildSplitPayments(input: {
  cashAmountMinor: number;
  mobileMoneyAmountMinor: number;
  paidAt: string;
}): PosPaymentInput[] {
  return createCheckoutPayments([
    {
      paymentId: "cash-payment",
      method: "cash",
      amountMinor: input.cashAmountMinor,
      status: "completed",
      paidAt: input.paidAt
    },
    {
      paymentId: "momo-payment",
      method: "mobile_money",
      amountMinor: input.mobileMoneyAmountMinor,
      providerCode: "mtn_momo",
      externalReference: "MM-UI-REF",
      status: "completed",
      paidAt: input.paidAt
    }
  ]);
}

export function assertValidCheckout(cart: PosCartState, payments: PosPaymentInput[]): void {
  if (cart.lines.length === 0) {
    throw new Error("Cart must include at least one line.");
  }

  if (payments.length === 0) {
    throw new Error("Checkout must include at least one payment.");
  }

  const summary = summarizeCart(cart);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  if (totalPaid !== summary.totalMinor) {
    throw new Error("Payment total must match cart total.");
  }
}

export interface BuildSaleInputContext {
  eventId: string;
  saleId: string;
  saleNumber: string;
  organizationId: string;
  branchId: string;
  shiftId: string;
  cashierUserId: string;
  deviceId: string;
  customerId?: string;
  happenedAt: string;
  notes?: string;
}

export function buildCreateLocalSaleInput(
  cart: PosCartState,
  payments: Array<PosPaymentInput & { paymentId: string }>,
  context: BuildSaleInputContext,
  saleItemIds: string[]
): CreateLocalSaleInput {
  assertValidCheckout(cart, payments);
  const summary = summarizeCart(cart);

  return {
    eventId: context.eventId,
    saleId: context.saleId,
    saleNumber: context.saleNumber,
    organizationId: context.organizationId,
    branchId: context.branchId,
    shiftId: context.shiftId,
    cashierUserId: context.cashierUserId,
    deviceId: context.deviceId,
    ...(context.customerId ? { customerId: context.customerId } : {}),
    currencyCode: "GHS",
    subtotalMinor: summary.subtotalMinor,
    discountMinor: summary.discountMinor,
    taxMinor: summary.taxMinor,
    totalMinor: summary.totalMinor,
    happenedAt: context.happenedAt,
    ...(context.notes ? { notes: context.notes } : {}),
    items: cart.lines.map((line, index) => ({
      saleItemId: saleItemIds[index] ?? `sale-item-${index + 1}`,
      productId: line.productId,
      ...(line.productVariantId ? { productVariantId: line.productVariantId } : {}),
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: line.discountMinor,
      taxMinor: line.taxMinor,
      lineTotalMinor: line.lineTotalMinor
    })),
    payments: payments.map((payment) => ({
      paymentId: payment.paymentId,
      method: payment.method,
      amountMinor: payment.amountMinor,
      ...(payment.providerCode ? { providerCode: payment.providerCode } : {}),
      ...(payment.externalReference ? { externalReference: payment.externalReference } : {}),
      status: payment.status,
      paidAt: payment.paidAt
    }))
  };
}
