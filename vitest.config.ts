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
    // Pełny zestaw (270+ plików jsdom) spowalnia pojedyncze testy kilkukrotnie
    // (CalendarView: 0,8 s osobno, 3,5 s w całości), więc domyślne 5 s bywa za mało.
    testTimeout: 15_000,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**", "**/.worktrees/**"],
  },
  coverage: {
    provider: "v8",
    include: ["lib/**/*.ts", "contexts/**/*.ts"],
    reportsDirectory: "./coverage",
    thresholds: {
      "lib/**/*.ts": {
        statements: 55,
        lines: 55,
        functions: 45,
        branches: 40,
      },
    },
  },
});
