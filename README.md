# Mini Checkout: React + Express + Playwright

A small online checkout rebuilt on a full stack, with UI **and** API tests.

| Layer | Tech | Job |
|---|---|---|
| Checkout page | React 18 + Vite | Cart, quantities, name validation, confirmation. Same `data-testid` hooks as the original vanilla-JS version. |
| API | Node.js + Express | Validates the order, **computes the total on the server from its own price list**, returns an order reference. Orders live in memory (no database). |
| Tests | Playwright | Browser tests (Chromium) and API tests that call Express directly, including checks that the total cannot be tampered with. |

**Data:** synthetic only (two made-up products). No credentials, no personal data.

## Prerequisites
- Node.js 18+ and npm
- Free ports **3001** (API) and **5173** (Vite)
- Internet for the first install (npm packages and the Chromium download)

## Setup and run
```bash
npm install
npx playwright install chromium   # browser for the UI tests

npm run dev                       # API on :3001 + React app on :5173 (open http://localhost:5173)
```
Production-style (Express serves the built React app, everything on :3001):
```bash
npm run build && npm start        # http://localhost:3001
```

## Run the tests
`npm test` starts both servers itself (or reuses ones already running).
```bash
npm test               # API + UI projects
npm run test:api       # API tests only (no browser needed)
npm run test:ui        # browser tests only
npm run test:headed    # browser tests with a visible browser
npm run test:repeat    # every test 5 times (flakiness check)
npm run report         # open the HTML report from the last run
```
**Expected result of `npm test`:** `57 passed` (37 API + 20 UI).

## How the API works
| Method and path | Purpose |
|---|---|
| `GET /api/health` | `{ "status": "ok" }` |
| `GET /api/products` | `{ products: [{ id, name, priceCents }], maxQuantity }`. The page renders its prices from this. |
| `POST /api/orders` | Body: `{ name, items: [{ productId, quantity }] }`. `201` with `{ reference, name, items[], totalCents, createdAt }`, or `400 { error: "validation_failed", details: [{ field, message }] }`. |
| `GET /api/orders/:reference` | Reads an order back from memory, or `404`. |

**Server rules**
- Only `name`, `productId` and `quantity` are read. Anything else a client sends (`totalCents`, `priceCents`, discounts...) is ignored. Prices and the total always come from `server/products.js`.
- `name`: string, trimmed, 1 to 100 characters.
- `items`: non-empty array; each `productId` must exist, appear once, and have an integer `quantity` from 1 to 99. Strings, decimals, `null`, 0, negatives and 100+ are rejected (the page clamps to 99 while typing, but the API never trusts that).
- `reference`: `ORD-` + 8 uppercase alphanumerics from `crypto.randomBytes`, checked for uniqueness against stored orders.
- Money is integer cents everywhere (3 x $19.99 = 5997 cents), formatted as `$0.00` only for display.
- Malformed JSON gives `400 invalid_json`; bodies over 10 KB give `413`.

## Behaviour of the page (unchanged from the original)
- **Quantity field:** digits only. `1` to `99` update totals immediately; `0` removes the line; above 99 is clamped to 99; empty, negative, decimal and non-numeric text is rejected, the last valid quantity keeps counting and the field reverts when committed (Tab / Enter / blur). `007` becomes 7.
- **Validation:** inline messages (never `alert()`). Both problems show together: "Your cart is empty. Add at least one item to place an order." and "Full name is required." The cart and typed name are kept; focus goes to the name field, or to the first Add button if only the cart is empty.
- **Submitting:** a ref-based lock plus a disabled button means double-click, rapid clicks and repeated Enter send **one** request and show **one** confirmation. If the server or network fails, an error appears, the cart is kept and the customer can retry.
- **Confirmation:** shows the reference, trimmed name and total **exactly as the server returned them**. "Start new order" resets everything.
- **Focus:** after removing a line, focus moves to the next Remove button, or the first Add button when the cart is empty.

## Test suite
```
tests/api/products.api.spec.js   catalog and health (2)
tests/api/orders.api.spec.js     order creation, tampering, validation, lookup (35)
tests/ui/checkout.spec.js        the original 7 browser tests, unchanged apart from ESM imports
tests/ui/checkout-api.spec.js    React <-> Express seam (13)
```
Highlights of the "total cannot be tampered with" coverage:
- API: extra fields `totalCents` / `total` / `amount` and per-line `priceCents` / `unitPriceCents` / `lineTotalCents` / `discount` are ignored; the stored order keeps the true total; negative, zero, fractional, string, `null`, exponent and over-limit quantities are rejected; splitting one product into two lines to dodge the limit is rejected.
- UI: the request body contains only name, product ids and quantities; the confirmation displays the server's total even when it differs from the page's own estimate; the reference on screen is a real stored order with a matching total.

See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) and [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

## Known gaps
- Chromium only. No Firefox, WebKit, mobile or zoom testing.
- Accessibility is checked through attributes and focus movement (`label`, `aria-invalid`, `aria-describedby`, `role="alert"`). Screen-reader output and colour contrast are not tested.
- Orders are in memory: restarting the API clears them. That is by design.
- No authentication, rate limiting, payment or load testing. Reference uniqueness is checked over 25 orders, not exhaustively.
- The original submission's manual cases (MT-1 to MT-10) and its evidence screenshots were **not** re-run or copied. Their behaviours are covered by automated tests instead (see the plan).
- **Environment note:** the results in `docs/` were produced in a sandbox that could not download Playwright's Chromium. The same config and tests ran through a private wrapper config pointing at Chromium 153 from an npm package. The plain `npx playwright install chromium` then `npm test` path was therefore not executed end to end here. If something fails on a first run, check that step first.

## Project structure
```
server/            Express API (app.js, products.js, validate.js, orders.js, index.js)
src/               React app (App.jsx, components/, api.js, money.js, styles.css)
tests/api/         API tests
tests/ui/          browser tests
playwright.config.js   two projects (api, ui); starts both servers
vite.config.js         dev server on 5173, proxies /api to :3001
docs/              test plan, results, logs
```
