import { test, expect } from "@playwright/test";

/**
 * Użytkownik test@user.test musi istnieć w Firebase (Authentication)
 * z hasłem "Test1234" – utwórz go w konsoli Firebase lub przez rejestrację w aplikacji.
 */
const LOGIN_EMAIL = "test@user.test";
const LOGIN_PASSWORD = "Test1234";

test.describe("Flow logowania i wylogowania", () => {
  test("logowanie emailem/hasłem i wylogowanie", async ({ page }) => {
    // 1. Wejście na stronę logowania
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: /Nexus/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // 2. Wypełnienie formularza i logowanie
    await page.locator('input[type="email"]').fill(LOGIN_EMAIL);
    await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: /Zaloguj się|Login/i }).click();

    // 3. Oczekiwanie na dashboard (przekierowanie po zalogowaniu)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Monolith|Freelancer/i).first()).toBeVisible({
      timeout: 10000,
    });

    // 4. Wylogowanie – przycisk "Wyloguj" / "Logout" w sidebarze
    await page.getByRole("button", { name: /Wyloguj|Logout/i }).click();

    // 5. Weryfikacja powrotu na ekran logowania
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Zaloguj się|Login/i })).toBeVisible();
  });
});
