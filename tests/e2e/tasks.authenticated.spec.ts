import { test, expect } from "@playwright/test";

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Tasks tab
    await page.getByRole("button", { name: /^(Zadania|Tasks)$/ }).click();
    // Wait for the inline task input to appear
    await expect(page.getByPlaceholder(/nowe zadanie|new task/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates a new task and it appears in the list", async ({ page }) => {
    const taskTitle = `E2E Test Task ${Date.now()}`;

    // Add task using the inline input + Dodaj/Add button
    await page.getByPlaceholder(/nowe zadanie|new task/i).fill(taskTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();

    // Task should appear in the list
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });
  });

  test("edits a task title", async ({ page }) => {
    const originalTitle = `Edit Test ${Date.now()}`;
    const updatedTitle = `Updated ${Date.now()}`;

    // Create a task first using inline input
    await page.getByPlaceholder(/nowe zadanie|new task/i).fill(originalTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });

    // Single click opens detail modal (after ~280ms)
    await page.getByText(originalTitle).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // Update title in the modal (.fill replaces existing value)
    const titleInput = page.getByRole("textbox", { name: /tytuł|title/i });
    await titleInput.fill(updatedTitle);
    await page.getByRole("button", { name: /^(Zapisz|Save)$/i }).click();

    // Verify updated title appears in the task list (API save completes)
    await expect(page.locator("li", { hasText: updatedTitle })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(originalTitle)).toHaveCount(0, { timeout: 10000 });
  });

  test("deletes a task", async ({ page }) => {
    const taskTitle = `Delete Test ${Date.now()}`;

    // Create a task first
    await page.getByPlaceholder(/nowe zadanie|new task/i).fill(taskTitle);
    await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });

    // Click the delete button (aria-label="Usuń"/"Delete") on the task row
    const taskRow = page.locator("li", { hasText: taskTitle });
    await taskRow.getByLabel(/usuń|delete/i).click();

    await expect(page.getByText(taskTitle)).not.toBeVisible({ timeout: 10000 });
  });
});
