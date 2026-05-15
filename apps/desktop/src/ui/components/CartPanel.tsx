import type { PosScreenSnapshot } from "../../electron/desktop-pos-service.ts";

export function CartPanel(props: {
  cart: PosScreenSnapshot["cart"];
  onUpdateQuantity: (input: { stockKey: string; quantity: number }) => void;
  onClearCart: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Cart</h2>
        {props.cart.lines.length > 0 ? (
          <button onClick={props.onClearCart}>Clear Cart</button>
        ) : null}
      </div>
      <div className="cart-list">
        {props.cart.lines.length === 0 ? <p className="muted">No items in cart.</p> : null}
        {props.cart.lines.map((line) => (
          <div key={line.stockKey} className="cart-line">
            <div>
              <div className="name">{line.name}</div>
              <div className="muted">
                Qty {line.quantity} | Unit {line.unitPriceMinor}
              </div>
            </div>
            <div className="cart-actions">
              <button
                onClick={() =>
                  props.onUpdateQuantity({
                    stockKey: line.stockKey,
                    quantity: Math.max(0, line.quantity - 1)
                  })
                }
              >
                -
              </button>
              <span>{line.quantity}</span>
              <button
                onClick={() =>
                  props.onUpdateQuantity({
                    stockKey: line.stockKey,
                    quantity: line.quantity + 1
                  })
                }
              >
                +
              </button>
              <button
                onClick={() =>
                  props.onUpdateQuantity({
                    stockKey: line.stockKey,
                    quantity: 0
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
