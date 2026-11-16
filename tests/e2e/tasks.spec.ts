import { test, expect } from "@playwright/test";

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Karta Zadania: skrót Alt+3 (pasek boczny zmienił układ, selektor po nazwie przestał pasować)
    await page.keyboard.press("Alt+3");
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

  test("edits a task title", async ({ page }) => {
    const originalTitle = `Edit Test ${Date.now()}`;
    const updatedTitle = `Updated ${Date.now()}`;

    await page.getByPlaceholder(/nazwa zadania|task name/i).fill(originalTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });

    await page.getByText(originalTitle).first().dblclick();
    // od 1024 px zadanie otwiera się w panelu, poniżej w oknie; zmiana zapisuje się sama
    const detail = page.locator('aside[aria-label], [role="dialog"]');
    await expect(detail).toBeVisible({ timeout: 5000 });

    await detail.locator("#task-detail-title-field").fill(updatedTitle);

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

  test("creates a template and uses it to add a task", async ({ page }) => {
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

    // Escape zamyka modal tylko z fokusem wewnątrz; przycisk zamknięcia działa zawsze.
    await modal
      .getByRole("button", { name: /^(Anuluj|Cancel)$/ })
      .first()
      .click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    await page.locator("#new-task-template").selectOption({ label: templateLabel });
    await expect(page.getByPlaceholder(/nazwa zadania|task name/i)).toHaveValue(templateTitle);

    await page.getByPlaceholder(/https/i).fill(taskLink);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();

    await expect(page.getByText(templateTitle)).toBeVisible({ timeout: 10000 });
  });

  test("odhacza punkt checklisty i widzi Zapisano", async ({ page }) => {
    const title = `E2E Checklist ${Date.now()}`;
    await page.getByPlaceholder(/nazwa zadania|task name/i).fill(title);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().dblclick();
    const note = page.locator("#task-detail-note");
    await expect(note).toBeVisible({ timeout: 5000 });
    await note.fill("- [ ] T-01: pierwszy\n- [ ] T-02: drugi");

    await page.getByRole("button", { name: /^(Lista|List)$/ }).click();
    await page
      .getByRole("button", { name: /^(Do sprawdzenia|Unchecked):/ })
      .first()
      .click();
    await expect(page.getByText(/^(Zapisano|Saved)$/)).toBeVisible({ timeout: 5000 });
  });
});
