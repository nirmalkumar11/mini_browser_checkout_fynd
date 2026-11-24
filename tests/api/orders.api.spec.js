// @ts-check
import { test, expect } from '@playwright/test';

const valid = (overrides = {}) => ({
  name: 'Ada Lovelace',
  items: [{ productId: 'tshirt', quantity: 1 }],
  ...overrides,
});

test.describe('POST /api/orders: happy path', () => {
  test('creates an order and returns a reference, lines and the server-computed total', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: valid({ items: [{ productId: 'tshirt', quantity: 3 }, { productId: 'mug', quantity: 1 }] }),
    });

    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order.reference).toMatch(/^ORD-[A-Z0-9]{8}$/);
    expect(res.headers()['location']).toBe(`/api/orders/${order.reference}`);
    expect(order.name).toBe('Ada Lovelace');
    expect(order.items).toEqual([
      { productId: 'tshirt', name: 'Classic T-Shirt', quantity: 3, unitPriceCents: 1999, lineTotalCents: 5997 },
      { productId: 'mug', name: 'Coffee Mug', quantity: 1, unitPriceCents: 850, lineTotalCents: 850 },
    ]);
    expect(order.totalCents).toBe(6847); // 3 x 19.99 + 8.50, exact in integer cents
  });

  test('trims the name', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ name: '   Ada   ' }) });
    expect(res.status()).toBe(201);
    expect((await res.json()).name).toBe('Ada');
  });

  test('accepts the boundary quantity 99', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ items: [{ productId: 'tshirt', quantity: 99 }] }) });
    expect(res.status()).toBe(201);
    expect((await res.json()).totalCents).toBe(99 * 1999);
  });

  test('accepts a 100-character name', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ name: 'A'.repeat(100) }) });
    expect(res.status()).toBe(201);
  });

  test('the order can be read back and matches what was returned', async ({ request }) => {
    const created = await (await request.post('/api/orders', { data: valid() })).json();
    const res = await request.get(`/api/orders/${created.reference}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  test('references are unique across many orders', async ({ request }) => {
    const refs = await Promise.all(
      Array.from({ length: 25 }, async () => (await (await request.post('/api/orders', { data: valid() })).json()).reference),
    );
    expect(new Set(refs).size).toBe(25);
  });
});

// The point of moving the total to the server: a client cannot choose what it pays.
test.describe('POST /api/orders: total cannot be tampered with', () => {
  test('ignores a client-supplied total', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: valid({ totalCents: 1, total: '0.01', amount: 1 }),
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).totalCents).toBe(1999);
  });

  test('ignores client-supplied prices on line items', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: valid({
        items: [{ productId: 'tshirt', quantity: 2, priceCents: 1, unitPriceCents: 1, lineTotalCents: 2, discount: 100 }],
      }),
    });
    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order.items[0].unitPriceCents).toBe(1999);
    expect(order.items[0].lineTotalCents).toBe(3998);
    expect(order.totalCents).toBe(3998);
  });

  test('the stored order keeps the real total, not the tampered one', async ({ request }) => {
    const created = await (await request.post('/api/orders', { data: valid({ totalCents: 1 }) })).json();
    const stored = await (await request.get(`/api/orders/${created.reference}`)).json();
    expect(stored.totalCents).toBe(1999);
  });

  for (const [label, quantity] of [
    ['negative (would reduce the total)', -1],
    ['zero', 0],
    ['fractional', 1.5],
    ['above the maximum', 100],
    ['a numeric string', '3'],
    ['null', null],
    ['exponent notation', 1e3],
  ]) {
    test(`rejects quantity that is ${label}`, async ({ request }) => {
      const res = await request.post('/api/orders', { data: valid({ items: [{ productId: 'tshirt', quantity }] }) });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('validation_failed');
      expect(body.details[0].field).toBe('items[0].quantity');
    });
  }

  test('rejects a missing quantity', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ items: [{ productId: 'tshirt' }] }) });
    expect(res.status()).toBe(400);
  });
});

test.describe('POST /api/orders: validation', () => {
  test('rejects an empty cart', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ items: [] }) });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.details).toEqual([
      { field: 'items', message: 'Your cart is empty. Add at least one item to place an order.' },
    ]);
  });

  test('rejects missing or non-array items', async ({ request }) => {
    for (const items of [undefined, null, 'tshirt', { productId: 'tshirt', quantity: 1 }]) {
      const res = await request.post('/api/orders', { data: valid({ items }) });
      expect(res.status(), `items=${JSON.stringify(items)}`).toBe(400);
    }
  });

  for (const [label, name] of [
    ['missing', undefined],
    ['empty', ''],
    ['whitespace only', '   \t  '],
    ['not a string', 42],
    ['101 characters', 'A'.repeat(101)],
  ]) {
    test(`rejects a name that is ${label}`, async ({ request }) => {
      const res = await request.post('/api/orders', { data: valid({ name }) });
      expect(res.status()).toBe(400);
      expect((await res.json()).details[0].field).toBe('name');
    });
  }

  test('reports every problem at once', async ({ request }) => {
    const res = await request.post('/api/orders', { data: { name: ' ', items: [] } });
    expect(res.status()).toBe(400);
    const fields = (await res.json()).details.map((d) => d.field);
    expect(fields).toEqual(['name', 'items']);
  });

  test('rejects an unknown product', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ items: [{ productId: 'hoodie', quantity: 1 }] }) });
    expect(res.status()).toBe(400);
    expect((await res.json()).details[0].field).toBe('items[0].productId');
  });

  test('rejects prototype-style product ids', async ({ request }) => {
    for (const productId of ['__proto__', 'constructor', 'toString']) {
      const res = await request.post('/api/orders', { data: valid({ items: [{ productId, quantity: 1 }] }) });
      expect(res.status(), productId).toBe(400);
    }
  });

  test('rejects the same product sent twice (no splitting a line to dodge the limit)', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: valid({ items: [{ productId: 'mug', quantity: 99 }, { productId: 'mug', quantity: 99 }] }),
    });
    expect(res.status()).toBe(400);
  });

  test('rejects malformed JSON', async ({ request }) => {
    const res = await request.post('/api/orders', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"name": "Ada", ',
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  test('rejects a body that is not an object', async ({ request }) => {
    const res = await request.post('/api/orders', { data: [1, 2, 3] });
    expect(res.status()).toBe(400);
  });

  test('rejects an oversized payload', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ name: 'A'.repeat(20_000) }) });
    expect(res.status()).toBe(413);
  });

  test('a rejected order response carries no order reference', async ({ request }) => {
    const res = await request.post('/api/orders', { data: valid({ items: [] }) });
    expect(res.status()).toBe(400);
    expect(await res.json()).not.toHaveProperty('reference');
  });
});

test.describe('GET /api/orders/:reference', () => {
  test('returns 404 for an unknown reference', async ({ request }) => {
    const res = await request.get('/api/orders/ORD-ZZZZZZZZ');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: 'order_not_found' });
  });

  test('returns 404 for a malformed reference', async ({ request }) => {
    for (const ref of ['abc', 'ord-aaaaaaaa', '__proto__', 'ORD-1234567890']) {
      const res = await request.get(`/api/orders/${ref}`);
      expect(res.status(), ref).toBe(404);
    }
  });

  test('unknown API routes return a JSON 404', async ({ request }) => {
    const res = await request.get('/api/nope');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
