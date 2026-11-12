import { test, expect } from "@playwright/test";

test.describe("Notes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Planning > Notes tab
    await page
      .locator("aside")
      .getByRole("button", { name: /^(Notatki|Notes)$/ })
      .click();
    await expect(page.getByRole("button", { name: /nowa notatka|new note/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates a new note", async ({ page }) => {
    const title = `Notatka e2e ${Date.now()}`;
    const body = "Treść testowej notatki e2e";

    await page.getByRole("button", { name: /nowa notatka|new note/i }).click();
    await expect(page.locator("[contenteditable]")).toBeVisible({ timeout: 10000 });

    // Lista notatek pokazuje tytuł (bez tytułu: "Untitled"), więc tytuł jest wymagany.
    await page.getByRole("textbox", { name: /tytuł|title/i }).fill(title);
    await page.locator("[contenteditable]").click();
    await page.keyboard.type(body);
    await page.getByRole("button", { name: /zapisz|save/i }).click();

    await page.reload();
    await page
      .locator("aside")
      .getByRole("button", { name: /^(Notatki|Notes)$/ })
      .click();
    const list = page.getByTestId("notes-sidebar-list");
    await expect(list).toBeVisible({ timeout: 15000 });
    await expect(list.getByText(title)).toBeVisible({ timeout: 15000 });

    await list.getByText(title).click();
    await expect(page.getByText(body)).toBeVisible({ timeout: 10000 });
  });

  test("note title is editable", async ({ page }) => {
    await page.getByRole("button", { name: /nowa notatka|new note/i }).click();
    await expect(page.locator("[contenteditable]")).toBeVisible({ timeout: 10000 });

    const titleInput = page
      .getByRole("textbox", { name: /tytuł|title/i })
      .or(page.locator("input[placeholder*='Tytuł'], input[placeholder*='title']").first());

    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill("Moja notatka e2e");
    await page.getByRole("button", { name: /zapisz|save/i }).click();
    await expect(page.getByText("Moja notatka e2e").first()).toBeVisible({ timeout: 10000 });
  });
});
