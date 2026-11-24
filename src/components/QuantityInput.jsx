import { useState } from 'react';

// Quantity rules (documented in the README):
//   digits only; 0 removes the line; above the max is clamped;
//   empty, negative, decimal or non-numeric text is rejected, the last valid
//   quantity stays in the cart and the field reverts to it when committed.
export default function QuantityInput({ productId, productName, quantity, maxQuantity, onChange }) {
  const [draft, setDraft] = useState(null); // text being typed while it is not a valid quantity

  const handleChange = (e) => {
    const raw = e.target.value;
    const text = raw.trim();
    if (!/^\d+$/.test(text)) {
      setDraft(raw); // invalid text waits until the field is committed
      return;
    }
    setDraft(null); // valid: show the accepted (possibly clamped) quantity, e.g. 150 -> 99, 007 -> 7
    onChange(productId, Math.min(Number(text), maxQuantity));
  };

  const commit = () => setDraft(null); // rejected text reverts to the last valid quantity

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`Quantity for ${productName}`}
      data-testid={`qty-${productId}`}
      data-qty={productId}
      value={draft ?? String(quantity)}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
