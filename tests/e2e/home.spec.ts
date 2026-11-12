import { test, expect } from "@playwright/test";

test.describe("Strona główna", () => {
  test("ładuje landing i link do logowania", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Nexus/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveTitle(/Monolith|Vite/);
    await expect(page.getByRole("link", { name: /^Zaloguj się$/i })).toBeVisible();
  });
});

test.describe("/auth/login", () => {
  test("wyświetla tytuł aplikacji i formularz logowania", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /^Monolith$/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Freelancer Edition/i)).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Zaloguj się|Login/i })).toBeVisible();
  });

  test("ma przycisk logowania przez Google", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(
      page.getByRole("button", { name: /Zaloguj przez Google|Sign in with Google/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("przełączenie na rejestrację pokazuje formularz rejestracji", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /^Monolith$/i })).toBeVisible({
      timeout: 15000,
    });
    await page
      .getByRole("button", { name: /Zarejestruj się|Register/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /Zarejestruj się|Register/i })).toBeVisible();
    await expect(page.locator('form input[type="text"]').first()).toBeVisible();
  });
});
