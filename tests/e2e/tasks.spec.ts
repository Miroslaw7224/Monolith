import { test, expect } from "@playwright/test";

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Tasks tab
    await page
      .locator("aside")
      .getByRole("button", { name: /^(Zadania|Tasks)$/ })
      .click();
    // Wait for the title input to appear
    await expect(page.getByPlaceholder(/nazwa zadania|task name/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates a new task and it appears in the list", async ({ page }) => {
    const taskTitle = `E2E Test Task ${Date.now()}`;

    await page.getByPlaceholder(/nazwa zadania|task name/i).fill(taskTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();

    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });
  });

  // FIXME(0d-2): selektory nieaktualne względem obecnego UI (spec nie był uruchamiany w CI); do naprawy osobno.
  test.fixme("edits a task title", async ({ page }) => {
    const originalTitle = `Edit Test ${Date.now()}`;
    const updatedTitle = `Updated ${Date.now()}`;

    await page.getByPlaceholder(/nazwa zadania|task name/i).fill(originalTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });

    await page.getByText(originalTitle).first().dblclick();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const titleInput = page.getByRole("textbox", { name: /tytuł|title/i });
    await titleInput.fill(updatedTitle);
    await page.getByRole("button", { name: /^(Zapisz|Save)$/i }).click();

    await expect(page.locator("li", { hasText: updatedTitle })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(originalTitle)).toHaveCount(0, { timeout: 10000 });
  });

  test("deletes a task", async ({ page }) => {
    const taskTitle = `Delete Test ${Date.now()}`;

    await page.getByPlaceholder(/nazwa zadania|task name/i).fill(taskTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });

    const taskRow = page.locator("li", { hasText: taskTitle });
    await taskRow.getByLabel(/usuń|delete/i).click();

    await expect(page.getByText(taskTitle)).not.toBeVisible({ timeout: 10000 });
  });

  // FIXME(0d-2): selektory nieaktualne względem obecnego UI (spec nie był uruchamiany w CI); do naprawy osobno.
  test.fixme("creates a template and uses it to add a task", async ({ page }) => {
    const stamp = Date.now();
    const templateLabel = `Tpl Review ${stamp}`;
    const templateTitle = `Review PR ${stamp}`;
    const taskLink = `https://example.com/pr/${stamp}`;

    await page.getByRole("button", { name: /zarządzaj szablonami|manage templates/i }).click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.getByPlaceholder(/nazwa szablonu|template name/i).fill(templateLabel);
    await modal.getByPlaceholder(/domyślna nazwa|default task name/i).fill(templateTitle);
    await modal.getByRole("button", { name: /dodaj szablon|add template/i }).click();
    await expect(modal.getByText(templateLabel)).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    await page.locator("#new-task-template").selectOption({ label: templateLabel });
    await expect(page.getByPlaceholder(/nazwa zadania|task name/i)).toHaveValue(templateTitle);

    await page.getByPlaceholder(/https/i).fill(taskLink);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();

    await expect(page.getByText(templateTitle)).toBeVisible({ timeout: 10000 });
  });
});
