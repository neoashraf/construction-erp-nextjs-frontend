import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config. The auth-flow spec (test/e2e) drives the app through the
 * BFF: login sets httpOnly cookies → guarded route → refresh-on-401 → logout.
 * The dev server is started with mock-backend env so no live NestJS is required.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run against a production build with the in-process mock backend enabled so
    // the BFF has something to talk to without a live NestJS.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // USE_MOCK_NESTJS routes the BFF to the in-process mock backend, so this base
      // is never actually fetched — it just needs to be a valid URL for config.
      NESTJS_API_BASE_URL: "http://localhost:4000/api",
      AUTH_CSRF_SECRET: "e2e-csrf-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      AUTH_COOKIE_SECURE: "false",
      AUTH_COOKIE_SAMESITE: "lax",
      USE_MOCK_NESTJS: "true",
    },
  },
});
