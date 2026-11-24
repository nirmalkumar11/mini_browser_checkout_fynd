// @ts-check
import { test, expect } from '@playwright/test';

// Every test gets a fresh page (Playwright creates a new context per test).
// Loading "/" gives a clean in-memory state, which we assert before acting.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
});

// Purpose: the happy path. A customer with an item and a name must get exactly one
// confirmation showing a well-formed reference, their name and the correct total.
test('Successful checkout shows a confirmation', async ({ page }) => {
  await page.getByTestId('add-tshirt').click();
  await expect(page.getByTestId('line-total-tshirt')).toHaveText('$19.99');

  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await expect(page.getByTestId('customer-name')).toHaveValue('Ada Lovelace');

  await page.getByTestId('place-order').click();

  const confirmation = page.getByTestId('confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Order confirmed');
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[A-Z0-9]{8}$/);
  await expect(confirmation).toContainText('Ada Lovelace');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$19.99');
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
});

// Purpose: validation must block the order, say why next to the field, keep the
// customer's cart intact, and clear the message once the problem is fixed.
test('Missing name blocks checkout', async ({ page }) => {
  await page.getByTestId('add-tshirt').click();
  await expect(page.getByTestId('qty-tshirt')).toHaveValue('1');

  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toHaveText('Full name is required.');
  await expect(page.getByTestId('customer-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('customer-name')).toBeFocused();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);

  // The cart must survive the failed attempt.
  await expect(page.getByTestId('cart-line-tshirt')).toBeVisible();
  await expect(page.getByTestId('qty-tshirt')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$19.99');

  // Fixing the problem clears the message and the order now goes through.
  await page.getByTestId('customer-name').fill('Grace Hopper');
  await expect(page.getByTestId('name-error')).toBeHidden();
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toContainText('Grace Hopper');
});

// Purpose: money maths must be exact (integer cents) and update immediately,
// both for line totals and for the order total.
test('Quantity change updates the exact total', async ({ page }) => {
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('qty-tshirt').fill('3');
  await expect(page.getByTestId('line-total-tshirt')).toHaveText('$59.97');
  await expect(page.getByTestId('order-total')).toHaveText('$59.97');

  await page.getByTestId('add-mug').click();
  await expect(page.getByTestId('line-total-mug')).toHaveText('$8.50');
  await expect(page.getByTestId('order-total')).toHaveText('$68.47');

  await page.getByTestId('qty-tshirt').fill('1');
  await expect(page.getByTestId('line-total-tshirt')).toHaveText('$19.99');
  await expect(page.getByTestId('order-total')).toHaveText('$28.49');
});

// ---- Optional extras ----

// Purpose: an empty cart must never produce an order, even with a valid name.
test('Empty cart blocks checkout', async ({ page }) => {
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('cart-error')).toHaveText(
    'Your cart is empty. Add at least one item to place an order.',
  );
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('customer-name')).toHaveValue('Ada Lovelace');

  // Adding an item clears the stale cart message.
  await page.getByTestId('add-mug').click();
  await expect(page.getByTestId('cart-error')).toBeHidden();
});

// Purpose: a user double-clicking Place Order must get exactly one confirmation.
test('Double-click on Place Order creates one confirmation', async ({ page }) => {
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').dblclick();

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
  await expect(page.getByTestId('confirmation-total')).toHaveText('$8.50');
});

// Purpose: the double-click above can be stopped by the form disappearing, so this
// fires two submits inside one task (as a fast Enter key repeat would) to prove the
// code-level guard works on its own: the first reference must survive untouched.
test('Two back-to-back submits keep the first reference', async ({ page }) => {
  await page.getByTestId('add-mug').click();
  await page.getByTestId('customer-name').fill('Ada Lovelace');
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  const firstReference = await page.getByTestId('order-reference').textContent();

  await page.evaluate(() => {
    const form = /** @type {HTMLFormElement} */ (document.getElementById('checkout-form'));
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(/** @type {string} */ (firstReference));
});

// ---- Regression (DEF-1) ----

// Purpose: removing a line used to drop keyboard focus to <body>. Focus must now move
// to the next Remove button, or to the first Add button once the cart is empty.
test('Removing a cart line keeps keyboard focus on the page', async ({ page }) => {
  await page.getByTestId('add-tshirt').click();
  await page.getByTestId('add-mug').click();
  await expect(page.getByTestId('order-total')).toHaveText('$28.49');

  await page.getByTestId('remove-tshirt').click();
  await expect(page.getByTestId('cart-line-tshirt')).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('$8.50');
  await expect(page.getByTestId('remove-mug')).toBeFocused();

  await page.getByTestId('remove-mug').click();
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('add-tshirt')).toBeFocused();
});
