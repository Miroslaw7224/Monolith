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

  // FIXME(0d-2): selektory nieaktualne względem obecnego UI (spec nie był uruchamiany w CI); do naprawy osobno.
  test.fixme("creates a new note", async ({ page }) => {
    await page.getByRole("button", { name: /nowa notatka|new note/i }).click();

    await expect(page.locator("[contenteditable]")).toBeVisible({ timeout: 10000 });

    await page.locator("[contenteditable]").click();
    await page.keyboard.type("Test notatka e2e");

    const saveBtn = page.getByRole("button", { name: /zapisz|save/i });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
    } else {
      await page.waitForTimeout(1500);
    }

    await page.reload();
    await page
      .locator("aside")
      .getByRole("button", { name: /^(Notatki|Notes)$/ })
      .click();
    await expect(page.getByTestId("notes-sidebar-list")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("notes-sidebar-list").getByText("Test notatka e2e")).toBeVisible({
      timeout: 15000,
    });
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
