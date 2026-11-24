import { useEffect, useRef } from 'react';
import { formatCents } from '../money.js';

// Everything shown here comes from the server's response, including the total.
export default function Confirmation({ order, onNewOrder }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <section ref={ref} role="status" tabIndex={-1} className="confirmation" data-testid="confirmation">
      <h2>Order confirmed</h2>
      <p>Reference: <strong data-testid="order-reference">{order.reference}</strong></p>
      <p>Name: <span data-field="name">{order.name}</span></p>
      <p>Total: <strong data-testid="confirmation-total">{formatCents(order.totalCents)}</strong></p>
      <button type="button" data-testid="new-order" onClick={onNewOrder}>Start new order</button>
    </section>
  );
}
