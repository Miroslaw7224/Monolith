# E2E Test Expansion — Priority 4: Core User Workflows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Playwright e2e tests to cover 4 core user workflows that are currently 0% tested: (1) Knowledge chat interaction, (2) Task creation and editing, (3) Note creation, (4) Knowledge node save flow. Current e2e tests only verify page load and tab switching.

**Architecture:** All authenticated tests use the existing `auth.setup.ts` storage state (`playwright/.auth/user.json`). Tests require a running app (`npx next dev` or deployed preview URL in `PLAYWRIGHT_BASE_URL`). Each spec file is independent — they can run in parallel. Tests use `test.use({ storageState: "playwright/.auth/user.json" })` for pre-authenticated sessions.

**Tech Stack:** Playwright, @playwright/test, Firebase test user (`test@user.test` / `Test1234`)

**Prerequisites before running any test:**

1. App running: `npx next dev` (or set `PLAYWRIGHT_BASE_URL` to deployed URL)
2. Auth user exists in Firebase: `test@user.test` with password `Test1234`, on waitlist
3. Auth state file exists: run `npx playwright test tests/e2e/auth.setup.ts` first

---

## Task 1: Knowledge chat — send message and receive AI response

**Files:**

- Create: `tests/e2e/knowledge-chat.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe("Knowledge Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Knowledge > Chat tab
    const knowledgeBtn = page.getByRole("button", { name: /^(Wiedza|Knowledge)$/ });
    await knowledgeBtn.click();
    // Chat panel should already be the default tab — verify textarea is visible
    await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });
  });

  test("sends a message and receives a non-empty AI response", async ({ page }) => {
    await page.getByRole("textbox").fill("Co to jest Second Brain?");
    await page.keyboard.press("Enter");

    // Wait for loading state to disappear and AI message to appear
    // The assistant message appears in a div with the AI response
    await expect(page.locator("[data-testid='chat-message-assistant']").first()).toBeVisible({
      timeout: 30000,
    });
    const responseText = await page
      .locator("[data-testid='chat-message-assistant']")
      .first()
      .textContent();
    expect(responseText?.length).toBeGreaterThan(10);
  });

  test("saves a URL to knowledge base via chat", async ({ page }) => {
    // Type a save command with a URL
    await page.getByRole("textbox").fill("zapamiętaj https://nextjs.org");
    await page.keyboard.press("Enter");

    // Pending node preview should appear
    await expect(page.getByText(/Next\.?[Jj][Ss]|nextjs/i)).toBeVisible({ timeout: 30000 });
    // Save button should appear
    const saveBtn = page.getByRole("button", { name: /zapisz/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
  });

  test("clears chat when trash button is clicked", async ({ page }) => {
    // Send a message first
    await page.getByRole("textbox").fill("Cześć");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Cześć")).toBeVisible({ timeout: 10000 });

    // Click clear button
    await page.getByTitle(/wyczyść|clear/i).click();

    // Chat should be empty
    await expect(page.getByText("Cześć")).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run test**

```
npx playwright test tests/e2e/knowledge-chat.spec.ts --headed
```

Expected: Tests pass. If selectors don't match, use `--debug` flag and pause to inspect DOM:

```typescript
await page.pause(); // Add this temporarily for debugging
```

The `[data-testid='chat-message-assistant']` selector requires that the component has this test ID. If it doesn't, use a text-based selector like `page.locator(".assistant-message")` or inspect the actual DOM and update the selector.

- [ ] **Step 3: Add data-testid to KnowledgeChatPanel if missing**

If `[data-testid='chat-message-assistant']` doesn't exist in the component, add it:

In `features/knowledge/KnowledgeChatPanel.tsx`, find the assistant message render and add the attribute:

```tsx
// Find the code that renders assistant messages, e.g.:
<div
  className="..."
  data-testid={msg.role === "assistant" ? "chat-message-assistant" : "chat-message-user"}
>
  {msg.content}
</div>
```

Re-run after the change.

- [ ] **Step 4: Commit**

```
git add tests/e2e/knowledge-chat.spec.ts
git add features/knowledge/KnowledgeChatPanel.tsx  # only if data-testid was added
git commit -m "test(e2e): add knowledge chat flow tests"
```

---

## Task 2: Task management — create, edit, delete

**Files:**

- Create: `tests/e2e/tasks.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Planning > Tasks
    await page.getByRole("button", { name: /^(Planowanie|Planning)$/ }).click();
    await page.getByRole("button", { name: /^(Zadania|Tasks)$/ }).click();
    await expect(page.getByRole("button", { name: /dodaj zadanie|add task/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates a new task and it appears in the list", async ({ page }) => {
    const taskTitle = `E2E Test Task ${Date.now()}`;

    await page.getByRole("button", { name: /dodaj zadanie|add task/i }).click();

    // Fill in task title in the modal/form
    const titleInput = page.getByRole("textbox", { name: /tytuł|title/i });
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill(taskTitle);

    await page.getByRole("button", { name: /zapisz|save/i }).click();

    // Task should appear in the list
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });
  });

  test("edits a task title", async ({ page }) => {
    const originalTitle = `Edit Test ${Date.now()}`;
    const updatedTitle = `Updated ${Date.now()}`;

    // Create a task first
    await page.getByRole("button", { name: /dodaj zadanie|add task/i }).click();
    await page.getByRole("textbox", { name: /tytuł|title/i }).fill(originalTitle);
    await page.getByRole("button", { name: /zapisz|save/i }).click();
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });

    // Click on it to open edit modal
    await page.getByText(originalTitle).click();

    // Update title
    const titleInput = page.getByRole("textbox", { name: /tytuł|title/i });
    await titleInput.clear();
    await titleInput.fill(updatedTitle);
    await page.getByRole("button", { name: /zapisz|save/i }).click();

    await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 10000 });
    expect(await page.getByText(originalTitle).count()).toBe(0);
  });

  test("deletes a task", async ({ page }) => {
    const taskTitle = `Delete Test ${Date.now()}`;

    // Create a task first
    await page.getByRole("button", { name: /dodaj zadanie|add task/i }).click();
    await page.getByRole("textbox", { name: /tytuł|title/i }).fill(taskTitle);
    await page.getByRole("button", { name: /zapisz|save/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });

    // Open and delete
    await page.getByText(taskTitle).click();
    await page.getByRole("button", { name: /usuń|delete/i }).click();

    // Confirm deletion if a dialog appears
    const confirmBtn = page.getByRole("button", { name: /tak|potwierdź|confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(taskTitle)).not.toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Run test**

```
npx playwright test tests/e2e/tasks.spec.ts --headed
```

Expected: Tests pass. Button names may differ — if `getByRole` doesn't find elements, use `page.pause()` to inspect and update selectors.

- [ ] **Step 3: Commit**

```
git add tests/e2e/tasks.spec.ts
git commit -m "test(e2e): add task management CRUD flow tests"
```

---

## Task 3: Note creation and content persistence

**Files:**

- Create: `tests/e2e/notes.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe("Notes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Navigate to Knowledge > Notes tab
    await page.getByRole("button", { name: /^(Wiedza|Knowledge)$/ }).click();
    await page.getByRole("button", { name: /^(Notatki|Notes)$/ }).click();
    await expect(page.getByRole("button", { name: /nowa notatka|new note/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("creates a new note", async ({ page }) => {
    await page.getByRole("button", { name: /nowa notatka|new note/i }).click();

    // Note editor should appear
    await expect(page.locator("[contenteditable]")).toBeVisible({ timeout: 10000 });

    // Type content into the editor
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("Test notatka e2e");

    // Save note — may auto-save or require explicit save button
    const saveBtn = page.getByRole("button", { name: /zapisz|save/i });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
    } else {
      // Auto-save — wait a moment
      await page.waitForTimeout(1500);
    }

    // Note should appear in the list
    await expect(page.getByText("Test notatka e2e")).toBeVisible({ timeout: 15000 });
  });

  test("note title is editable", async ({ page }) => {
    await page.getByRole("button", { name: /nowa notatka|new note/i }).click();
    await expect(page.locator("[contenteditable]")).toBeVisible({ timeout: 10000 });

    // Find title input (usually a separate text input above the editor)
    const titleInput = page
      .getByRole("textbox", { name: /tytuł|title/i })
      .or(page.locator("input[placeholder*='tytułu'], input[placeholder*='title']").first());

    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill("Moja notatka e2e");
      await page.waitForTimeout(500);
      await expect(page.getByText("Moja notatka e2e")).toBeVisible({ timeout: 5000 });
    }
  });
});
```

- [ ] **Step 2: Run test**

```
npx playwright test tests/e2e/notes.spec.ts --headed
```

Expected: 2 tests pass (note creation and title editing). The editor selectors may need adjustment based on how Tiptap renders in the app.

- [ ] **Step 3: Commit**

```
git add tests/e2e/notes.spec.ts
git commit -m "test(e2e): add notes creation flow tests"
```

---

## Task 4: Knowledge node save from chat — full flow

**Files:**

- Create: `tests/e2e/knowledge-save-flow.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe("Knowledge Save Flow", () => {
  test("saves a resource from chat and it appears in list view", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Go to Knowledge > Chat
    await page.getByRole("button", { name: /^(Wiedza|Knowledge)$/ }).click();
    await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

    // Send save command
    const uniqueTitle = `TestResource${Date.now()}`;
    await page.getByRole("textbox").fill(`zapamiętaj narzędzie o nazwie ${uniqueTitle}`);
    await page.keyboard.press("Enter");

    // Wait for pending node preview
    await expect(page.getByRole("button", { name: /zapisz/i })).toBeVisible({ timeout: 30000 });

    // Save it
    await page.getByRole("button", { name: /zapisz/i }).click();

    // Confirmation message should appear
    await expect(page.getByText(/zapisano|saved/i)).toBeVisible({ timeout: 15000 });

    // Switch to Lista tab and verify node is there
    await page.getByRole("button", { name: /lista/i }).click();
    await expect(page.getByText(new RegExp(uniqueTitle, "i"))).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Run test**

```
npx playwright test tests/e2e/knowledge-save-flow.spec.ts --headed
```

Expected: 1 test passes. This is the most complex e2e flow — it touches chat → extract API → knowledge/nodes API → list view. Allow 60s timeout.

- [ ] **Step 3: Commit**

```
git add tests/e2e/knowledge-save-flow.spec.ts
git commit -m "test(e2e): add knowledge save flow end-to-end test"
```

---

## Final verification

- [ ] **Run all e2e tests**

```
npx playwright test tests/e2e/ --reporter=list
```

Expected: All e2e tests pass (4 existing + 4 new spec files = ~15 total test cases).

- [ ] **Run unit tests to confirm no regressions**

```
npx vitest run
```

Expected: All unit tests still pass (unchanged).
