import { defineConfig, devices } from "@playwright/test";
import { E2E_VAULT } from "./tests/e2e/global-setup";

/** Port inny niż dev (3100) i osobny distDir, żeby e2e nie dotykało serwera użytkownika ani jego vaulta. */
const PORT = 3199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT} -H 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXUS_VAULT_PATH: E2E_VAULT,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
