# Frontend Component Tests — Priority 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React Testing Library tests for the 4 highest-risk untested frontend components: `KnowledgeChatPanel`, `KnowledgeView`, `useKnowledgeNodes` integration paths, and `TaskDetailModal`. These handle core user interactions with zero automated coverage today.

**Architecture:** Tests use Vitest + @testing-library/react + userEvent. Components accept `apiFetch` as a prop (dependency-injected), so mocking is done by passing `vi.fn()` as the prop — no HTTP interception needed. Heavy third-party libraries (Tiptap, ReactFlow) are already mocked in other test files; follow the same pattern.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/user-event, vi.fn()

---

## Task 1: KnowledgeChatPanel — core chat flow tests

**Files:**

- Create: `tests/unit/components/knowledge/KnowledgeChatPanel.test.tsx`
- Read first: `features/knowledge/KnowledgeChatPanel.tsx` (understand props and API calls)

The component accepts `apiFetch: (url, init) => Promise<Response>` and `lang: "pl" | "en"`.

- [ ] **Step 1: Create the test file**

```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import { KnowledgeChatPanel } from "@/features/knowledge/KnowledgeChatPanel";

function makeApiFetch(responses: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    const data = responses[url] ?? {};
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    });
  });
}

afterEach(() => cleanup());

describe("KnowledgeChatPanel", () => {
  it("renders input and send button", () => {
    render(<KnowledgeChatPanel apiFetch={vi.fn()} lang="pl" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wyślij|send/i })).toBeInTheDocument();
  });

  it("adds user message to chat on send", async () => {
    const user = userEvent.setup();
    const apiFetch = makeApiFetch({
      "/api/chat": { text: "Odpowiedź AI", sources: [] },
    });

    render(<KnowledgeChatPanel apiFetch={apiFetch} lang="pl" />);
    await user.type(screen.getByRole("textbox"), "Kiedy deadline projektu?");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Kiedy deadline projektu?")).toBeInTheDocument();
  });

  it("displays AI response after sending a chat message", async () => {
    const user = userEvent.setup();
    const apiFetch = makeApiFetch({
      "/api/chat": { text: "Deadline to 20 maja.", sources: ["Projekt X"] },
    });

    render(<KnowledgeChatPanel apiFetch={apiFetch} lang="pl" />);
    await user.type(screen.getByRole("textbox"), "Kiedy deadline?");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Deadline to 20 maja.")).toBeInTheDocument();
    });
  });

  it("routes save command to /api/knowledge/extract and shows pending nodes", async () => {
    const user = userEvent.setup();
    const apiFetch = makeApiFetch({
      "/api/knowledge/extract": {
        nodes: [{ type: "resource", title: "Vercel", content: "Platforma deploy", tags: [], sources: [] }],
      },
    });

    render(<KnowledgeChatPanel apiFetch={apiFetch} lang="pl" />);
    await user.type(screen.getByRole("textbox"), "zapamiętaj https://vercel.com");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Vercel")).toBeInTheDocument();
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/knowledge/extract",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows error message when API call fails", async () => {
    const user = userEvent.setup();
    const apiFetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    render(<KnowledgeChatPanel apiFetch={apiFetch} lang="pl" />);
    await user.type(screen.getByRole("textbox"), "Pytanie");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/błąd|error/i)).toBeInTheDocument();
    });
  });

  it("clears chat when trash button is clicked", async () => {
    const user = userEvent.setup();
    const apiFetch = makeApiFetch({
      "/api/chat": { text: "Odpowiedź", sources: [] },
    });

    render(<KnowledgeChatPanel apiFetch={apiFetch} lang="pl" />);
    await user.type(screen.getByRole("textbox"), "Pytanie");
    await user.keyboard("{Enter}");

    await waitFor(() => screen.getByText("Odpowiedź"));

    const clearBtn = screen.getByTitle(/wyczyść|clear/i);
    await user.click(clearBtn);

    expect(screen.queryByText("Odpowiedź")).not.toBeInTheDocument();
    expect(screen.queryByText("Pytanie")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeChatPanel.test.tsx
```

Expected: 6 tests pass. If a test fails due to a missing aria attribute or text mismatch, read the component source for exact text/role and adjust the query (use `screen.debug()` to inspect rendered output).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/knowledge/KnowledgeChatPanel.test.tsx
git commit -m "test: add KnowledgeChatPanel component tests (chat flow + save command)"
```

---

## Task 2: KnowledgeView — tab switching and sub-component rendering

**Files:**

- Create: `tests/unit/components/knowledge/KnowledgeView.test.tsx`
- Read first: `features/knowledge/KnowledgeView.tsx` (understand tab state and sub-component wiring)

- [ ] **Step 1: Read KnowledgeView to understand props and structure**

Read `features/knowledge/KnowledgeView.tsx`. Identify: the tab names (Chat, Lista, Graf), which components are rendered per tab, and the `apiFetch` prop signature.

- [ ] **Step 2: Create the test file**

```typescript
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach } from "vitest";

// Mock heavy sub-components
vi.mock("@/features/knowledge/KnowledgeChatPanel", () => ({
  KnowledgeChatPanel: () => <div data-testid="chat-panel">Chat Panel</div>,
}));
vi.mock("@/features/knowledge/KnowledgeListView", () => ({
  KnowledgeListView: () => <div data-testid="list-view">List View</div>,
}));
vi.mock("@/features/knowledge/KnowledgeGraphView", () => ({
  KnowledgeGraphView: () => <div data-testid="graph-view">Graph View</div>,
}));

import { KnowledgeView } from "@/features/knowledge/KnowledgeView";

afterEach(() => cleanup());

describe("KnowledgeView", () => {
  const apiFetch = vi.fn();

  it("renders chat tab by default", () => {
    render(<KnowledgeView apiFetch={apiFetch} lang="pl" />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("switches to list view when Lista tab is clicked", async () => {
    const user = userEvent.setup();
    render(<KnowledgeView apiFetch={apiFetch} lang="pl" />);

    const listaTab = screen.getByRole("button", { name: /lista/i });
    await user.click(listaTab);

    expect(screen.getByTestId("list-view")).toBeVisible();
  });

  it("switches to graph view when Graf tab is clicked", async () => {
    const user = userEvent.setup();
    render(<KnowledgeView apiFetch={apiFetch} lang="pl" />);

    const grafTab = screen.getByRole("button", { name: /graf/i });
    await user.click(grafTab);

    expect(screen.getByTestId("graph-view")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeView.test.tsx
```

Expected: 3 tests pass. If the tab button text differs, inspect the component and adjust the regex in `getByRole`.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/components/knowledge/KnowledgeView.test.tsx
git commit -m "test: add KnowledgeView tab switching tests"
```

---

## Task 3: TaskDetailModal component tests

**Files:**

- Create: `tests/unit/components/tasks/TaskDetailModal.test.tsx`
- Read first: `src/components/TaskDetailModal.tsx` (understand props: `task`, `onSave`, `onClose`, `onDelete`)

- [ ] **Step 1: Read TaskDetailModal.tsx to understand its interface**

Run a glob to confirm the exact path: the file is likely at `src/components/TaskDetailModal.tsx`. Read it to find:

- Exact prop names and types
- Which fields are editable (title, description, status, due_date)
- The save button's accessible name
- Whether it uses a modal/dialog element

- [ ] **Step 2: Create the test file** (adjust imports and prop names after reading in Step 1)

```typescript
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";

// Adjust this import based on the actual file path found in Step 1
import { TaskDetailModal } from "@/src/components/TaskDetailModal";

afterEach(() => cleanup());

const fakeTask = {
  id: "task-1",
  userId: "user-1",
  title: "Napisać testy",
  description: "Opis zadania",
  status: "todo" as const,
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("TaskDetailModal", () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn();
    onClose = vi.fn();
    onDelete = vi.fn();
    vi.clearAllMocks();
  });

  it("renders task title and description", () => {
    render(
      <TaskDetailModal task={fakeTask} onSave={onSave} onClose={onClose} onDelete={onDelete} />
    );
    expect(screen.getByDisplayValue("Napisać testy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Opis zadania")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} onSave={onSave} onClose={onClose} onDelete={onDelete} />
    );
    const closeBtn = screen.getByRole("button", { name: /zamknij|close|×/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSave with updated title when saved", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} onSave={onSave} onClose={onClose} onDelete={onDelete} />
    );

    const titleInput = screen.getByDisplayValue("Napisać testy");
    await user.clear(titleInput);
    await user.type(titleInput, "Nowy tytuł");

    const saveBtn = screen.getByRole("button", { name: /zapisz|save/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nowy tytuł" })
    );
  });

  it("disables save button when title is empty", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} onSave={onSave} onClose={onClose} onDelete={onDelete} />
    );

    const titleInput = screen.getByDisplayValue("Napisać testy");
    await user.clear(titleInput);

    const saveBtn = screen.getByRole("button", { name: /zapisz|save/i });
    expect(saveBtn).toBeDisabled();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} onSave={onSave} onClose={onClose} onDelete={onDelete} />
    );
    const deleteBtn = screen.getByRole("button", { name: /usuń|delete/i });
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith("task-1");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/components/tasks/TaskDetailModal.test.tsx
```

Expected: 5 tests pass. Adjust selectors if aria names differ — use `screen.debug()` to inspect the DOM.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/components/tasks/TaskDetailModal.test.tsx
git commit -m "test: add TaskDetailModal component tests"
```

---

## Task 4: NoteEditor — content and toolbar interaction tests

**Files:**

- Create: `tests/unit/components/NoteEditor.test.tsx`
- Read first: `src/components/NoteEditor.tsx` (Tiptap-based rich text editor)

**Important:** Tiptap uses `document.createElement` and `ResizeObserver` which are unavailable in jsdom. Mock the entire `@tiptap/react` package with a simple textarea substitute that mirrors the interface (`editor.getHTML()`, `editor.commands.setContent()`).

- [ ] **Step 1: Create the test file**

```typescript
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";

// Mock Tiptap — replace with a simple textarea so jsdom can handle it
vi.mock("@tiptap/react", () => {
  let currentContent = "";
  const editorInstance = {
    getHTML: () => currentContent,
    getText: () => currentContent,
    commands: {
      setContent: (html: string) => { currentContent = html; },
      focus: () => {},
    },
    isDestroyed: false,
    on: () => {},
    off: () => {},
  };
  let lastOnUpdate:
    | ((p: { editor: typeof editorInstance }) => void)
    | undefined;
  return {
    useEditor: ({ content, onUpdate }: { content?: string; onUpdate?: (p: { editor: typeof editorInstance }) => void }) => {
      currentContent = content ?? "";
      lastOnUpdate = onUpdate;
      return {
        ...editorInstance,
        onUpdate,
      };
    },
    EditorContent: ({ editor, onUpdate }: { editor: unknown; onUpdate?: typeof lastOnUpdate }) => {
      const handler = onUpdate ?? lastOnUpdate;
      return (
      <div
        data-testid="tiptap-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (handler) handler({ editor: editorInstance });
        }}
      />);
    },
  };
});

vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-text-align", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-font-family", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-text-style", () => ({ default: {} }));
vi.mock("@tiptap/extension-color", () => ({ default: {} }));
vi.mock("@tiptap/extension-font-size", () => ({ default: {} }));

import { NoteEditor } from "@/src/components/NoteEditor";

afterEach(() => cleanup());

describe("NoteEditor", () => {
  it("renders without crashing", () => {
    render(<NoteEditor content="<p>Hello</p>" onChange={vi.fn()} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("shows placeholder when content is empty", () => {
    render(<NoteEditor content="" onChange={vi.fn()} />);
    // Placeholder is typically shown via CSS :before pseudo-element — check aria-label or data-placeholder
    const editor = screen.getByTestId("tiptap-editor");
    expect(editor).toBeInTheDocument();
  });

  it("renders toolbar with formatting buttons", () => {
    render(<NoteEditor content="<p>Test</p>" onChange={vi.fn()} />);
    // Toolbar buttons should have accessible names or titles
    // Adjust button queries based on actual toolbar implementation
    const toolbar = screen.getByRole("toolbar", { hidden: true })
      ?? document.querySelector("[data-testid='toolbar']");
    // If no explicit toolbar role, check for bold/italic buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
```

**Note:** If `NoteEditor` has a different prop interface (e.g., `value`/`onValueChange` instead of `content`/`onChange`), read the component source in Step 1 and adjust accordingly. The Tiptap mock is the critical part — the exact assertions depend on what the real component renders around the editor.

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/components/NoteEditor.test.tsx
```

Expected: 3 tests pass. This component is complex — if more Tiptap extensions need mocking, add them to the mock list above and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/NoteEditor.test.tsx
git commit -m "test: add NoteEditor component tests with Tiptap mock"
```

---

## Final verification

- [ ] **Run full unit test suite**

```bash
npx vitest run
```

Expected: All tests pass (previously ~240 from Priority 1+2, now ~255+).
