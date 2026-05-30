import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["server/__tests__/integration/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "shared") },
  },
});
