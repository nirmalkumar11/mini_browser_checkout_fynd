# Test Results

## Environment
| Item | Value |
|---|---|
| OS | Ubuntu 24 (sandbox) |
| Node / npm | v22.23.5 / 10.9.9 |
| Browser | Chromium 153.0.8010.0 (headless), supplied by an npm package because the sandbox could not reach Playwright's browser CDN |
| Servers | Express on :3001, Vite dev server on :5173 (both started by `playwright.config.js`) |

## Automated results
| Run | Result | Log |
|---|---|---|
| Full suite (`npm test` equivalent) | **57 / 57 passed** (37 API, 20 UI) | `evidence/automated-run.log` |
| Repeat run, every test 3 times | **171 / 171 passed** | `evidence/automated-run-repeat3.log` |

Not run: `--repeat-each=5` and the plain `npx playwright install chromium` path (see README, "Known gaps").

## Production build check
`npm run build` succeeded; Express alone (`node server/index.js`) served the built page and the API. A `curl` POST that included `"totalCents":1` for 2 mugs returned `totalCents: 1700`.

## Mutation check (`evidence/mutation-check.log`)
The app was broken on purpose, the matching tests failed, and the files were restored (verified identical with `diff`).
| Mutation | Tests that failed |
|---|---|
| A. Server trusts client-supplied line prices | `ignores client-supplied prices on line items` (1 failed, 36 passed) |
| B. Server quantity lower bound removed | `rejects quantity that is negative` and `... zero` (2 failed, 35 passed) |
| C. Client duplicate-submit guard removed | `Two submits in one task...` and `Two back-to-back submits keep the first reference` (2 failed, 18 passed) |

## Defects
None found in this version. The original submission's DEF-1 (focus lost after removing a line) stays fixed and is covered by a regression test.
