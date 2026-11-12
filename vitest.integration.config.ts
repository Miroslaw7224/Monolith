import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 20_000,
    // Wszystkie pliki czyszczą i zasiewają ten sam emulator Firestore, więc nie mogą działać równolegle.
    fileParallelism: false,
    setupFiles: ["./tests/integration/setup.ts"],
  },
});
