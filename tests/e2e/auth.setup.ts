import fs from "fs";
import path from "path";
import { test as setup, expect } from "@playwright/test";

const authFile = path.resolve("playwright/.auth/user.json");

const LOGIN_EMAIL = process.env.E2E_LOGIN_EMAIL ?? "test@user.test";
const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "Test1234";

setup.describe.configure({ mode: "serial" });

/**
 * Saves storage state for dashboard E2E. Requires the same Firebase user as auth-login-logout.spec.
 */
setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/auth/login");
  await expect(page.getByRole("heading", { name: /^Monolith$/i })).toBeVisible({
    timeout: 15000,
  });
  await page.locator('input[type="email"]').fill(LOGIN_EMAIL);
  await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: /Zaloguj się|Login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25000 });
  await page.context().storageState({ path: authFile });
});
