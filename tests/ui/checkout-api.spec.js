// @ts-check
import { test, expect } from '@playwright/test';

// These tests cover the seam between the React app and the Express API.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('add-tshirt')).toBeVisible(); // catalog loaded from /api/products
});

/** @param {import('@playwright/test').Page} page */
function trackOrderRequests(page) {
  /** @type {import('@playwright/test').Request[]} */
  const requests = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') requests.push(r);
  });
  return requests;
}

test('Prices on the page come from the API catalog', async ({ page }) => {
  await expect(page.locator('[data-price="tshirt"]')).toHaveText('$19.99');
  await expect(page.locator('[data-price="mug"]')).toHaveText('$8.50');
});

test('The order request carries only name, product ids and quantities, never prices or a total', async ({ page }) => {
  const requests = trackOrderRequests(page);
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('qty-tshirt').fill('3');
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('  Ada Lovelace  ');
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  expect(requests).toHaveLength(1);
  expect(requests[0].postDataJSON()).toEqual({
    name: 'Ada Lovelace',
    items: [
      { productId: 'tshirt', quantity: 3 },
      { productId: 'mug', quantity: 1 },
    ],
  });
});

test('The confirmation shows the total and reference computed by the server', async ({ page }) => {
  await page.route('**/api/orders', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        reference: 'ORD-SERVER01',
        name: 'Server Name',
        items: [],
        totalCents: 12345,
        createdAt: new Date().toISOString(),
      }),
    }),
  );
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();

  // The page's own estimate is $8.50; what it must display is the server's answer.
  await expect(page.getByTestId('confirmation-total')).toHaveText('$123.45');
  await expect(page.getByTestId('order-reference')).toHaveText('ORD-SERVER01');
  await expect(page.getByTestId('confirmation')).toContainText('Server Name');
});

test('The reference on screen is a real stored order whose total matches', async ({ page, request }) => {
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('qty-tshirt').fill('2');
  await page.getByTestId('customer-name').fill('Grace Hopper');
  await page.getByTestId('place-order').click();

  const reference = (await page.getByTestId('order-reference').textContent()) ?? '';
  const stored = await (await request.get(`http://localhost:3001/api/orders/${reference}`)).json();
  expect(stored.name).toBe('Grace Hopper');
  expect(stored.totalCents).toBe(3998);
  await expect(page.getByTestId('confirmation-total')).toHaveText('$39.98');
});

test('Double-click sends exactly one order request', async ({ page }) => {
  const requests = trackOrderRequests(page);
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').dblclick();

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  expect(requests).toHaveLength(1);
});

test('Two submits in one task, while the request is in flight, send one request', async ({ page }) => {
  const requests = trackOrderRequests(page);
  // Hold the response so the first request is still pending when the second submit fires.
  await page.route('**/api/orders', async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue();
  });
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.evaluate(() => {
    const form = /** @type {HTMLFormElement} */ (document.getElementById('checkout-form'));
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  expect(requests).toHaveLength(1);
});

test('Place Order is disabled while the request is in flight', async ({ page }) => {
  await page.route('**/api/orders', async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('place-order')).toBeDisabled();
  await expect(page.getByTestId('confirmation')).toBeVisible();
});

test('Client-side validation failures never call the API', async ({ page }) => {
  const requests = trackOrderRequests(page);
  await page.getByTestId('place-order').click(); // empty cart and no name
  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('cart-error')).toBeVisible();

  await page.getByTestId('add-mug').click();
  await page.getByTestId('place-order').click(); // still no name
  await expect(page.getByTestId('name-error')).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('A server rejection shows an error, keeps the cart and allows a retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/orders', (route) => {
    calls += 1;
    if (calls === 1) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'validation_failed', details: [] }),
      });
    }
    return route.continue();
  });
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('submit-error')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('qty-tshirt')).toHaveValue('1');
  await expect(page.getByTestId('customer-name')).toHaveValue('Ada Lovelace');
  await expect(page.getByTestId('place-order')).toBeEnabled();

  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('submit-error')).toBeHidden();
});

test('A network failure shows an error and lets the customer try again', async ({ page }) => {
  await page.route('**/api/orders', (route) => route.abort('failed'));
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('submit-error')).toContainText('Could not reach the server');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('place-order')).toBeEnabled();
});

test('Start new order resets the cart, the name and the order state', async ({ page }) => {
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  await page.getByTestId('new-order').click();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByTestId('customer-name')).toHaveValue('');
  await expect(page.getByTestId('place-order')).toBeEnabled();
  await expect(page.getByTestId('add-tshirt')).toBeFocused();
});

test('Quantity input rules: clamp, reject, revert and remove', async ({ page }) => {
  await page.getByTestId('add-tshirt').click();
  const qty = page.getByTestId('qty-tshirt');

  await qty.fill('100');
  await expect(qty).toHaveValue('99');
  await expect(page.getByTestId('line-total-tshirt')).toHaveText('$1979.01');

  await qty.fill('007');
  await expect(qty).toHaveValue('7');
  await expect(page.getByTestId('line-total-tshirt')).toHaveText('$139.93');

  for (const bad of ['', '-1', '1.5', 'abc']) {
    await qty.fill(bad);
    await expect(page.getByTestId('order-total')).toHaveText('$139.93'); // last valid quantity still counts
    await qty.press('Tab');
    await expect(qty).toHaveValue('7'); // reverts on commit
  }

  await qty.fill('0');
  await expect(page.getByTestId('cart-line-tshirt')).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
});

test('Whitespace-only name is rejected and the name is trimmed on the confirmation', async ({ page }) => {
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('     ');
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('name-error')).toBeVisible();

  await page.getByTestId('customer-name').fill('   Ada   ');
  await expect(page.getByTestId('name-error')).toBeHidden();
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toContainText('Name: Ada');
});
