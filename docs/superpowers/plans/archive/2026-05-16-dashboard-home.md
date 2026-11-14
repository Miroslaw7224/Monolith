# Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Home" view as the default landing page after login, showing today's tasks, upcoming calendar events, quick-action buttons, and the activity log.

**Architecture:** New `appMode = "home"` value added to `App.tsx`. New `HomeView` component in `src/features/home/` fetches `KnowledgeNode[]` from `/api/knowledge/nodes` and filters client-side by type and date. `AppSidebar` gets a Home nav entry at the top. No new API endpoints needed.

**Tech Stack:** React, TypeScript, Tailwind, existing `/api/knowledge/nodes` endpoint, existing `ActivityLog` component

---

## Task 1: Add translations for Home view

**Files:**

- Modify: `src/translations.ts`

- [ ] **Step 1: Add home-related keys to both locales**

In `src/translations.ts`, add to the `en` object:

```ts
home: "Home",
homeGreeting: "Good morning",
homeTodayTasks: "Today's tasks",
homeUpcoming: "Upcoming events",
homeQuickActions: "Quick actions",
homeNoTasks: "No tasks for today",
homeNoEvents: "No upcoming events",
homeShowAll: "Show all",
homeAddNote: "+ Note",
homeAddTask: "+ Task",
homeAskAI: "Ask AI",
homeSearch: "Search",
```

Add to the `pl` object:

```ts
home: "Home",
homeGreeting: "Dzień dobry",
homeTodayTasks: "Zadania na dziś",
homeUpcoming: "Nadchodzące wydarzenia",
homeQuickActions: "Szybkie akcje",
homeNoTasks: "Brak zadań na dziś",
homeNoEvents: "Brak nadchodzących wydarzeń",
homeShowAll: "Pokaż wszystkie",
homeAddNote: "+ Notatka",
homeAddTask: "+ Zadanie",
homeAskAI: "Zapytaj AI",
homeSearch: "Szukaj",
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to translations.

- [ ] **Step 3: Commit**

```bash
git add src/translations.ts
git commit -m "feat(home): add translations for Dashboard Home view"
```

---

## Task 2: Create HomeView component

**Files:**

- Create: `src/features/home/HomeView.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/features/home/HomeView.test.tsx`:

```tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import HomeView from "@/src/features/home/HomeView";
import { translations } from "@/src/translations";

const t = translations["pl"];

const mockApiFetch = jest.fn();

beforeEach(() => {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
});

test("renders stats row with zero counts when no nodes", async () => {
  render(
    <HomeView
      user={{ id: "1", email: "test@test.com", name: "Test" }}
      apiFetch={mockApiFetch}
      lang="pl"
      t={t}
      setAppMode={jest.fn()}
    />
  );
  await waitFor(() => {
    expect(screen.getByText(t.homeTodayTasks)).toBeInTheDocument();
    expect(screen.getByText(t.homeUpcoming)).toBeInTheDocument();
  });
});

test("renders today's tasks filtered by dueDate", async () => {
  const today = new Date().toISOString().split("T")[0];
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => [
      { id: "1", type: "task", title: "Wyślij fakturę", dueDate: today, content: "" },
      { id: "2", type: "task", title: "Stare zadanie", dueDate: "2020-01-01", content: "" },
    ],
  });
  render(
    <HomeView
      user={{ id: "1", email: "test@test.com", name: "Test" }}
      apiFetch={mockApiFetch}
      lang="pl"
      t={t}
      setAppMode={jest.fn()}
    />
  );
  await waitFor(() => {
    expect(screen.getByText("Wyślij fakturę")).toBeInTheDocument();
    expect(screen.queryByText("Stare zadanie")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/features/home/HomeView.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/src/features/home/HomeView'`

- [ ] **Step 3: Create `HomeView.tsx`**

```tsx
// src/features/home/HomeView.tsx
"use client";
import React, { useEffect, useState } from "react";
import { Home, CheckSquare, Calendar, Zap, Search } from "lucide-react";
import type { translations } from "@/src/translations";
import { ActivityLog } from "@/src/components/ActivityLog";

type T = (typeof translations)["en"];

interface KnowledgeNode {
  id: string;
  type: "note" | "task" | "resource" | "chat" | "document" | "event";
  title: string;
  content: string;
  dueDate?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface HomeViewProps {
  user: User | null;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: T;
  setAppMode: (mode: "home" | "wiedza" | "planowanie") => void;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function in48hISO() {
  const d = new Date();
  d.setHours(d.getHours() + 48);
  return d.toISOString().split("T")[0];
}

export default function HomeView({ user, apiFetch, lang, t, setAppMode }: HomeViewProps) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/knowledge/nodes")
      .then((r) => r.json())
      .then((data) => setNodes(Array.isArray(data) ? data : []))
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const today = todayISO();
  const limit48h = in48hISO();

  const todayTasks = nodes.filter(
    (n) => n.type === "task" && n.dueDate && n.dueDate.startsWith(today)
  );
  const upcomingEvents = nodes.filter(
    (n) => n.type === "event" && n.dueDate && n.dueDate >= today && n.dueDate <= limit48h
  );
  const notesCount = nodes.filter((n) => n.type === "note").length;

  const greeting = `${t.homeGreeting}, ${user?.name?.split(" ")[0] ?? ""}`;
  const dateStr = new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--bg)]">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-[var(--text)]">{greeting} 👋</h2>
        <p className="text-sm text-[var(--text2)] mt-1">{dateStr}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.homeTodayTasks, value: todayTasks.length, color: "var(--accent)" },
          { label: t.homeUpcoming, value: upcomingEvents.length, color: "var(--green)" },
          { label: lang === "pl" ? "Notatki" : "Notes", value: notesCount, color: "var(--text2)" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
          >
            <p className="text-2xl font-bold" style={{ color }}>
              {loading ? "—" : value}
            </p>
            <p className="text-xs text-[var(--text2)] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Today's tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)]">
            {t.homeTodayTasks}
          </h3>
          <button
            onClick={() => setAppMode("planowanie")}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {t.homeShowAll}
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text3)]">…</p>
        ) : todayTasks.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">{t.homeNoTasks}</p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
              >
                <div className="w-4 h-4 rounded border-2 border-[var(--accent)] flex-shrink-0" />
                <span className="text-sm text-[var(--text)] flex-1">{task.title}</span>
                <span className="text-xs text-[var(--accent)]">{task.dueDate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming events */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)] mb-3">
          {t.homeUpcoming}
        </h3>
        {loading ? (
          <p className="text-sm text-[var(--text3)]">…</p>
        ) : upcomingEvents.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">{t.homeNoEvents}</p>
        ) : (
          <ul className="space-y-2">
            {upcomingEvents.slice(0, 3).map((ev) => (
              <li
                key={ev.id}
                className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
              >
                <div className="w-2 h-2 rounded-full bg-[var(--green)] flex-shrink-0" />
                <span className="text-sm text-[var(--text)] flex-1">{ev.title}</span>
                <span className="text-xs text-[var(--text2)]">{ev.dueDate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)] mb-3">
          {t.homeQuickActions}
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: t.homeAddNote, action: () => setAppMode("wiedza") },
            { label: t.homeAddTask, action: () => setAppMode("planowanie") },
            { label: t.homeAskAI, action: () => setAppMode("wiedza") },
            { label: t.homeSearch, action: () => setAppMode("wiedza") },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text2)] hover:bg-[var(--bg2)] transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div>
        <ActivityLog apiFetch={apiFetch} lang={lang} t={t as Record<string, string | string[]>} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/features/home/HomeView.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/home/HomeView.tsx tests/unit/features/home/HomeView.test.tsx
git commit -m "feat(home): add HomeView component with tasks, events, quick actions"
```

---

## Task 3: Add "home" to appMode and wire HomeView in App.tsx

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/features/wiedza/WiedzaView.tsx` (update prop type)
- Modify: `src/features/planowanie/PlanowanieView.tsx` (update prop type)

- [ ] **Step 1: Update `appMode` type and default in `App.tsx`**

Change line ~55:

```ts
// before
const [appMode, setAppMode] = useState<"wiedza" | "planowanie">("wiedza");
// after
const [appMode, setAppMode] = useState<"home" | "wiedza" | "planowanie">("home");
```

- [ ] **Step 2: Add HomeView render in App.tsx**

Import at top of file:

```ts
import HomeView from "@/src/features/home/HomeView";
```

In the return JSX (~line 300), replace:

```tsx
return (
  <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
    {appMode === "wiedza" ? (
      <WiedzaView ... />
    ) : (
      <PlanowanieView ... />
    )}
  </div>
);
```

With:

```tsx
return (
  <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
    {appMode === "home" ? (
      <div className="flex flex-1 overflow-hidden">
        <HomeView user={user} apiFetch={apiFetch} lang={lang} t={t} setAppMode={setAppMode} />
      </div>
    ) : appMode === "wiedza" ? (
      <WiedzaView
        user={user}
        apiFetch={apiFetch}
        lang={lang}
        t={t}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        appMode={appMode}
        setAppMode={setAppMode}
        onLogout={handleLogout}
        setLang={setLang}
      />
    ) : (
      <PlanowanieView
        user={user}
        apiFetch={apiFetch}
        lang={lang}
        t={t}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        appMode={appMode}
        setAppMode={setAppMode}
        onLogout={handleLogout}
        setLang={setLang}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Update `appMode` prop type in WiedzaView and PlanowanieView**

In `src/features/wiedza/WiedzaView.tsx` (line ~32-33):

```ts
// before
appMode: "wiedza" | "planowanie";
setAppMode: (mode: "wiedza" | "planowanie") => void;
// after
appMode: "home" | "wiedza" | "planowanie";
setAppMode: (mode: "home" | "wiedza" | "planowanie") => void;
```

Do the same in `src/features/planowanie/PlanowanieView.tsx`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/features/wiedza/WiedzaView.tsx src/features/planowanie/PlanowanieView.tsx
git commit -m "feat(home): wire HomeView as default appMode in App.tsx"
```

---

## Task 4: Add Home nav item to AppSidebar

**Files:**

- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/features/wiedza/WiedzaView.tsx`
- Modify: `src/features/planowanie/PlanowanieView.tsx`

- [ ] **Step 1: Add `onGoHome` prop to `AppSidebarProps`**

In `src/components/layout/AppSidebar.tsx`, add to the `AppSidebarProps` interface:

```ts
onGoHome: () => void;
activeMode: "home" | "wiedza" | "planowanie";
```

- [ ] **Step 2: Add Home button to sidebar JSX**

In `AppSidebar`, inside `<div className="flex-1 overflow-y-auto p-4 space-y-6">`, add before `{children}`:

```tsx
import { Home } from "lucide-react";

// Inside the component, before {children}:
<button
  onClick={onGoHome}
  className={cn(
    "w-full flex items-center gap-3 p-3 rounded-xl transition-all border text-left text-sm font-semibold mb-2",
    activeMode === "home"
      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
      : "bg-[var(--surface)] border-transparent hover:bg-[var(--bg2)] hover:border-[var(--bg3)] text-[var(--text)]"
  )}
>
  <Home className="w-5 h-5 flex-shrink-0" />
  <span>{lang === "pl" ? "Home" : "Home"}</span>
</button>;
```

- [ ] **Step 3: Pass `onGoHome` and `activeMode` from WiedzaView**

In `src/features/wiedza/WiedzaView.tsx`, update the `<AppSidebar>` call:

```tsx
<AppSidebar
  ...existing props...
  onGoHome={() => setAppMode("home")}
  activeMode={appMode}
>
```

Do the same in `src/features/planowanie/PlanowanieView.tsx`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppSidebar.tsx src/features/wiedza/WiedzaView.tsx src/features/planowanie/PlanowanieView.tsx
git commit -m "feat(home): add Home nav button to AppSidebar"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify**

1. Log in → app opens on Home view (greeting, stats, quick actions visible)
2. Click "Wiedza" in sidebar → switches to WiedzaView
3. Click "Home" in sidebar → returns to HomeView
4. Quick action buttons navigate to correct modules
5. If knowledge nodes exist — today's tasks and upcoming events appear correctly filtered

- [ ] **Step 3: Run unit tests**

```bash
npx jest tests/unit/features/home/ --no-coverage
```

Expected: all PASS
