import { test, expect } from "@playwright/test";

test.describe("Strona główna", () => {
  test("/ przekierowuje do /dashboard i pokazuje aplikację bez logowania", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard(#.*)?$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Monolith" })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("/notes przekierowuje do /dashboard", async ({ page }) => {
    await page.goto("/notes");
    await expect(page).toHaveURL(/\/dashboard(#.*)?$/, { timeout: 20000 });
  });
});
