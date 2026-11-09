import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    resetMocks: true,
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/integration/**", "**/tests/e2e/**", "**/.worktrees/**"],
  },
  coverage: {
    provider: "v8",
    include: ["services/**/*.ts", "lib/**/*.ts"],
    reportsDirectory: "./coverage",
    thresholds: {
      "services/**/*.ts": {
        statements: 60,
        lines: 60,
        functions: 50,
        branches: 40,
      },
      "lib/**/*.ts": {
        statements: 55,
        lines: 55,
        functions: 45,
        branches: 40,
      },
    },
  },
});
