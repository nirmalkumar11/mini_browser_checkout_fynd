// @ts-check
import { test, expect } from '@playwright/test';

test.describe('GET /api/products', () => {
  test('returns the catalog with integer-cent prices and the quantity limit', async ({ request }) => {
    const res = await request.get('/api/products');
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.maxQuantity).toBe(99);
    expect(body.products).toEqual([
      { id: 'tshirt', name: 'Classic T-Shirt', priceCents: 1999 },
      { id: 'mug', name: 'Coffee Mug', priceCents: 850 },
    ]);
  });

  test('health endpoint reports ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
