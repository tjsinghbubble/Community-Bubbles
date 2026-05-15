import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5000";

export default defineConfig({
  testDir: "./server/__tests__/e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./server/__tests__/e2e/global-setup.ts",
  globalTeardown: "./server/__tests__/e2e/global-teardown.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  // Each test file runs sequentially — rate-limit tests reset per email, so no interference
  workers: 1,
  use: {
    baseURL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
  // Only spin up a local server when not targeting an external environment
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npx tsx server/index.ts",
          url: `${baseURL}/api/v1/ping`,
          reuseExistingServer: !process.env.CI,
          env: {
            NODE_ENV: "test",
            PORT: "5000",
            JWT_SECRET: "e2e-test-jwt-secret-not-for-production",
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ||
              process.env.DATABASE_URL ||
              "",
            RESEND_API_KEY: "test-no-emails-sent",
            SHARE_BASE_URL: "http://localhost:5000",
            COMETCHAT_APP_ID: "test",
            COMETCHAT_API_KEY: "test",
            // 32-byte hex key required by the encryption module
            ENCRYPTION_KEY: "a".repeat(64),
            // Relax rate limits so test suites don't hit the IP cap
            RATE_LIMIT_SEND_MAX: "200",
            RATE_LIMIT_AUTH_MAX: "200",
          },
          timeout: 40_000,
        },
      }),
});
