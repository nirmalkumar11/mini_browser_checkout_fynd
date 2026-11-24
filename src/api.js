export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new ApiError('Could not load products.', { status: res.status });
  return res.json(); // { products: [{ id, name, priceCents }], maxQuantity }
}

// Sends only what the customer chose (name, product ids, quantities).
// Prices and the total are decided by the server, so they are never sent.
export async function createOrder({ name, items }) {
  let res;
  try {
    res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items }),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError('We could not place your order. Please check your details and try again.', {
      status: res.status,
      details: body?.details,
    });
  }
  return res.json(); // { reference, name, items, totalCents, createdAt }
}
