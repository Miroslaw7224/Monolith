import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("pokazuje shell i nawigację Planowania", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Monolith" })).toBeVisible({
      timeout: 20000,
    });

    await expect(page.getByRole("button", { name: /^Home$/ })).toBeVisible({
      timeout: 15000,
    });

    await page
      .locator("aside")
      .getByRole("button", { name: /^(Zadania|Tasks)$/ })
      .click();
    await expect(page.getByPlaceholder(/nazwa zadania|task name/i)).toBeVisible({
      timeout: 15000,
    });

    await page
      .locator("aside")
      .getByRole("button", { name: /^(Notatki|Notes)$/ })
      .click();
    await expect(page.getByRole("button", { name: /nowa notatka|new note/i })).toBeVisible({
      timeout: 15000,
    });
  });
});
