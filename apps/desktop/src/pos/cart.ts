export interface PosCartLineInput {
  productId: string;
  productVariantId?: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
}

export interface PosCartLine extends PosCartLineInput {
  lineTotalMinor: number;
  stockKey: string;
}

export interface PosCartState {
  lines: PosCartLine[];
}

export interface PosCartSummary {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  totalItemCount: number;
}

export function createCartState(): PosCartState {
  return { lines: [] };
}

function buildStockKey(input: PosCartLineInput): string {
  return `${input.productId}:${input.productVariantId ?? "base"}`;
}

export function addCartLine(cart: PosCartState, input: PosCartLineInput): PosCartState {
  const stockKey = buildStockKey(input);
  const existing = cart.lines.find((line) => line.stockKey === stockKey);

  if (!existing) {
    return {
      lines: [
        ...cart.lines,
        {
          ...input,
          stockKey,
          lineTotalMinor: input.unitPriceMinor * input.quantity - input.discountMinor + input.taxMinor
        }
      ]
    };
  }

  return {
    lines: cart.lines.map((line) =>
      line.stockKey !== stockKey
        ? line
        : {
            ...line,
            quantity: line.quantity + input.quantity,
            discountMinor: line.discountMinor + input.discountMinor,
            taxMinor: line.taxMinor + input.taxMinor,
            lineTotalMinor:
              line.unitPriceMinor * (line.quantity + input.quantity) -
              (line.discountMinor + input.discountMinor) +
              (line.taxMinor + input.taxMinor)
          }
    )
  };
}

export function summarizeCart(cart: PosCartState): PosCartSummary {
  const subtotalMinor = cart.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const discountMinor = cart.lines.reduce((sum, line) => sum + line.discountMinor, 0);
  const taxMinor = cart.lines.reduce((sum, line) => sum + line.taxMinor, 0);

  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: subtotalMinor - discountMinor + taxMinor,
    totalItemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0)
  };
}
