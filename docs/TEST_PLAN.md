# Test Plan: Mini Checkout (React + Express)

## 1. Scope
**In scope:** the React checkout page (cart, quantities, name validation, confirmation, duplicate-submit protection, basic accessibility) and the Express API (`/api/products`, `/api/orders`, `/api/orders/:reference`), including server-side validation and total calculation.
**Out of scope:** payments, database, authentication, other browsers, mobile, performance/load, screen-reader and colour-contrast audits.

## 2. Risks
| ID | Risk | Priority | Covered by |
|---|---|---|---|
| R1 | Wrong total or rounding error | High | UI `Quantity change updates the exact total`; API happy path (6847 cents) |
| R2 | **Client tampers with price or total** | High | API tamper group (11 tests); UI request-payload and server-total tests |
| R3 | Double order on rapid clicks / repeated Enter | High | UI double-click, back-to-back submit, in-flight submit (request counted) |
| R4 | Empty cart accepted (client or API) | High | UI `Empty cart blocks checkout`; API `rejects an empty cart` |
| R5 | Blank / whitespace / over-long name accepted | High | UI missing-name and whitespace tests; API name table (5 cases) |
| R6 | Invalid quantity breaks the total (0, negative, decimal, empty, text, huge) | High | UI quantity-rules test; API quantity table (7 cases) + boundary 99 |
| R7 | Input lost after a validation or server error | High | UI missing-name, empty-cart, server-rejection tests |
| R8 | Server or network failure leaves the page stuck | Med | UI server-rejection and network-failure tests (retry works) |
| R9 | Stale messages / state leaking into the next order | Med | UI `Start new order`, validation-clears tests |
| R10 | Reference malformed, duplicated or not retrievable | Med | API format, uniqueness (25), read-back, 404 tests; UI stored-order test |
| R11 | Malformed or oversized request crashes the API | Med | API malformed JSON, non-object body, 413 tests |
| R12 | Keyboard focus lost after removing a line (DEF-1 in the original) | Low | UI `Removing a cart line keeps keyboard focus` |
| R13 | Other browsers behave differently | Low | not covered |

## 3. Test cases
All run with `npm test`. Each UI test starts on a fresh page and asserts the empty cart and `$0.00`.

**API (`tests/api`, 37 tests):** catalog and health; order creation with exact line and order totals; name trimming; boundary quantity 99 and name length 100; read-back equals created order; 25 unique references; ignoring client `totalCents`/`total`/`amount`; ignoring client line prices; stored order keeps the true total; quantity rejections (-1, 0, 1.5, 100, "3", null, 1e3, missing); empty / missing / non-array items; name rejections (missing, empty, whitespace, non-string, 101 chars); all errors reported together; unknown product; `__proto__` / `constructor` / `toString` ids; duplicate product lines; malformed JSON; non-object body; 413; 404 for unknown and malformed references and unknown routes.

**UI (`tests/ui`, 20 tests):**
- *Original 7 (`checkout.spec.js`):* successful checkout, missing name, exact totals, empty cart, double-click, back-to-back submits, focus after removal.
- *New 13 (`checkout-api.spec.js`):* prices come from the API; request carries only name / ids / quantities; confirmation shows the server's total and reference; on-screen reference is a stored order with a matching total; double-click sends one request; two submits while a request is in flight send one; Place Order disabled in flight; client-side validation never calls the API; server rejection keeps the cart and allows retry; network failure allows retry; Start new order resets everything; quantity clamp / reject / revert / remove; whitespace-only and padded names.

The original manual cases map to automated tests: MT-1 empty cart (UI empty-cart + client-validation tests), MT-2 rapid submit (three submit-guard tests), MT-3 to MT-8 quantity edge cases (UI quantity-rules test), MT-9 name edge cases (UI whitespace test), MT-10 remove/reset (focus and Start new order tests).

## 4. Entry / exit criteria
**Entry:** dependencies installed, Chromium available, ports 3001 and 5173 free (or already serving this app).
**Exit:** all tests pass, three consecutive repeat runs pass with no flakiness, and the mutation check shows the tests fail when the app is broken.

## 5. Known limitations
Chromium only; no screen-reader or contrast testing; no load or security testing beyond input tampering; in-memory orders only.
