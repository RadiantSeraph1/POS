import { useEffect, useState } from "react";

import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";
import { buildSplitPayments, type PosPaymentInput } from "../../pos/checkout.ts";

function parseMinorAmount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function CheckoutPanel(props: {
  cart: PosScreenSnapshot["cart"];
  payments: PosPaymentInput[];
  onSetPayments: (payments: PosPaymentInput[]) => void;
  onSubmit: () => void;
}) {
  const [cashAmount, setCashAmount] = useState("0");
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState("0");

  useEffect(() => {
    const cashPayment = props.payments.find((payment) => payment.method === "cash");
    const mobileMoneyPayment = props.payments.find((payment) => payment.method === "mobile_money");

    if (props.payments.length > 0) {
      setCashAmount(String(cashPayment?.amountMinor ?? 0));
      setMobileMoneyAmount(String(mobileMoneyPayment?.amountMinor ?? 0));
      return;
    }

    const total = props.cart.summary.totalMinor;
    const splitCash = Math.floor(total / 2);
    setCashAmount(String(splitCash));
    setMobileMoneyAmount(String(total - splitCash));
  }, [props.cart.summary.totalMinor, props.payments]);

  const enteredTotal = parseMinorAmount(cashAmount) + parseMinorAmount(mobileMoneyAmount);
  const remainingAmount = props.cart.summary.totalMinor - enteredTotal;

  const activePayments = buildSplitPayments({
    cashAmountMinor: parseMinorAmount(cashAmount),
    mobileMoneyAmountMinor: parseMinorAmount(mobileMoneyAmount),
    paidAt: new Date().toISOString()
  });

  function applyEnteredPayments(): void {
    props.onSetPayments(activePayments);
  }

  function useEvenSplit(): void {
    const total = props.cart.summary.totalMinor;
    const splitCash = Math.floor(total / 2);
    const splitMobileMoney = total - splitCash;
    setCashAmount(String(splitCash));
    setMobileMoneyAmount(String(splitMobileMoney));
    props.onSetPayments(
      buildSplitPayments({
        cashAmountMinor: splitCash,
        mobileMoneyAmountMinor: splitMobileMoney,
        paidAt: new Date().toISOString()
      })
    );
  }

  return (
    <section className="panel">
      <h2>Checkout</h2>
      <div className="totals">
        <div>Subtotal</div>
        <div>{props.cart.summary.subtotalMinor}</div>
        <div>Discount</div>
        <div>{props.cart.summary.discountMinor}</div>
        <div>Total</div>
        <div className="strong">{props.cart.summary.totalMinor}</div>
      </div>
      <div className="payments-form">
        <label className="payment-input">
          <span>Cash</span>
          <input
            type="number"
            min="0"
            step="1"
            value={cashAmount}
            onChange={(event) => setCashAmount(event.target.value)}
          />
        </label>
        <label className="payment-input">
          <span>Mobile Money</span>
          <input
            type="number"
            min="0"
            step="1"
            value={mobileMoneyAmount}
            onChange={(event) => setMobileMoneyAmount(event.target.value)}
          />
        </label>
      </div>
      <div className="totals payment-summary">
        <div>Entered</div>
        <div>{enteredTotal}</div>
        <div>Remaining</div>
        <div className={remainingAmount === 0 ? "strong" : "error-text"}>{remainingAmount}</div>
      </div>
      {remainingAmount !== 0 ? (
        <p className="error-inline">Payments must match the sale total before checkout.</p>
      ) : (
        <p className="muted">Payments balanced. Ready to submit.</p>
      )}
      <div className="checkout-actions">
        <button onClick={useEvenSplit}>Use Even Split</button>
        <button onClick={applyEnteredPayments}>Apply Payments</button>
        <button className="primary" onClick={props.onSubmit}>
          Submit Sale
        </button>
      </div>
    </section>
  );
}
