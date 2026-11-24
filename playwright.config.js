// @ts-check
import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://localhost:3001';
const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  outputDir: './test-results', // traces and failure screenshots land here
  fullyParallel: true,
  retries: 0, // a retry would hide flakiness
  reporter: [['list'], ['html', { outputFolder: 'docs/playwright-report', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Calls the Express server directly with Playwright's `request` fixture: no browser involved.
    { name: 'api', testDir: './tests/api', use: { baseURL: API_URL } },
    // Drives the React app in Chromium. Vite proxies /api to the Express server.
    { name: 'ui', testDir: './tests/ui', use: { ...devices['Desktop Chrome'], baseURL: WEB_URL } },
  ],
  // Both servers start automatically so `npm test` is self-contained.
  webServer: [
    { command: 'node server/index.js', url: `${API_URL}/api/health`, reuseExistingServer: true },
    { command: 'npx vite', url: WEB_URL, reuseExistingServer: true },
  ],
});
