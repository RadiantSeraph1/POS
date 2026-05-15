import { randomUUID } from "node:crypto";

export const DEMO_REFERENCE_IDS = {
  organization: "11111111-1111-4111-8111-111111111111",
  branch: "22222222-2222-4222-8222-222222222222",
  device: "33333333-3333-4333-8333-333333333333",
  user: "44444444-4444-4444-8444-444444444444",
  customer: "55555555-5555-4555-8555-555555555555",
  shift: "66666666-6666-4666-8666-666666666666",
  category: "77777777-7777-4777-8777-777777777777",
  supplier: "88888888-8888-4888-8888-888888888888",
  productPipe: "99999999-9999-4999-8999-999999999999",
  productElbow: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  variantOneInch: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
} as const;

export function createDemoIds() {
  return {
    ...DEMO_REFERENCE_IDS,
    saleOne: randomUUID(),
    saleTwo: randomUUID(),
    saleThree: randomUUID(),
    saleItemOne: randomUUID(),
    saleItemTwo: randomUUID(),
    saleItemThree: randomUUID(),
    saleItemFour: randomUUID(),
    saleItemFive: randomUUID(),
    paymentCashOne: randomUUID(),
    paymentMomoOne: randomUUID(),
    paymentCashTwo: randomUUID(),
    paymentCashThree: randomUUID(),
    eventOne: randomUUID(),
    eventTwo: randomUUID(),
    eventThree: randomUUID()
  } as const;
}
