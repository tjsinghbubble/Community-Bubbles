import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Headless API tests. These are BLACK-BOX: they hit a live server over HTTP at
 * process.env.QA_BASE_URL (default http://localhost:3000). They do not import the app, so they
 * verify real socket + middleware behavior (rate limiting, lockout, status codes).
 *
 * The qa runner sets QA_BASE_URL and runs individual files; `npm run test:headless` runs all.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/headless/**/*.headless.test.ts"],
    exclude: ["node_modules", ".cache", "mobile"],
    // Security tests intentionally trigger lockout/rate-limit; keep them sequential and patient.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "..", "..", "shared"),
    },
  },
});
