import { randomBytes } from 'node:crypto';
import { findProduct } from './products.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const REFERENCE_PATTERN = /^ORD-[A-Z0-9]{8}$/;

// 8 uppercase alphanumerics; bytes >= 252 are skipped to avoid modulo bias.
function randomReference() {
  let ref = '';
  while (ref.length < 8) {
    for (const byte of randomBytes(16)) {
      if (byte < 252 && ref.length < 8) ref += ALPHABET[byte % 36];
    }
  }
  return `ORD-${ref}`;
}

// In-memory order store. Gone when the process stops, by design (no database).
export function createOrderStore() {
  const orders = new Map();

  return {
    // Prices come from the server catalog, never from the request.
    create({ name, items }) {
      const lines = items.map(({ productId, quantity }) => {
        const product = findProduct(productId);
        return {
          productId,
          name: product.name,
          quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents: product.priceCents * quantity,
        };
      });
      const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

      let reference = randomReference();
      while (orders.has(reference)) reference = randomReference();

      const order = { reference, name, items: lines, totalCents, createdAt: new Date().toISOString() };
      orders.set(reference, order);
      return order;
    },
    get: (reference) => orders.get(reference),
    size: () => orders.size,
  };
}
