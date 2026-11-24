import { MAX_NAME_LENGTH, MAX_QTY, findProduct } from './products.js';

// Validates an order request and returns either { errors } or { name, items }.
// Only `name` and `items[].productId / quantity` are ever read. Any other field a
// client sends (prices, totals, discounts...) is ignored on purpose.
export function validateOrder(body) {
  const errors = [];
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  let name = '';
  if (typeof input.name !== 'string') {
    errors.push({ field: 'name', message: 'Full name is required.' });
  } else {
    name = input.name.trim();
    if (!name) errors.push({ field: 'name', message: 'Full name is required.' });
    else if (name.length > MAX_NAME_LENGTH) {
      errors.push({ field: 'name', message: `Full name must be at most ${MAX_NAME_LENGTH} characters.` });
    }
  }

  const items = [];
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push({ field: 'items', message: 'Your cart is empty. Add at least one item to place an order.' });
  } else {
    const seen = new Set();
    input.items.forEach((item, i) => {
      const at = `items[${i}]`;
      if (!item || typeof item !== 'object') {
        errors.push({ field: at, message: 'Each item must be an object.' });
        return;
      }
      if (typeof item.productId !== 'string' || !findProduct(item.productId)) {
        errors.push({ field: `${at}.productId`, message: 'Unknown product.' });
        return;
      }
      if (seen.has(item.productId)) {
        errors.push({ field: `${at}.productId`, message: 'Duplicate product. Send one line per product.' });
        return;
      }
      seen.add(item.productId);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY) {
        errors.push({ field: `${at}.quantity`, message: `Quantity must be a whole number from 1 to ${MAX_QTY}.` });
        return;
      }
      items.push({ productId: item.productId, quantity: item.quantity });
    });
  }

  return errors.length ? { errors } : { name, items };
}
