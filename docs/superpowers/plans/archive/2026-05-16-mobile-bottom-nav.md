# Mobile Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable on mobile by replacing the 320px desktop sidebar with a bottom navigation bar on screens < 768px.

**Architecture:** Two new components: `MobileNav` (fixed bottom bar, 5 tabs) and `MobileMoreDrawer` (bottom sheet for secondary items). `AppSidebar` gets `hidden md:flex` so it only shows on desktop. `AppHeader` gets simplified on mobile. Main content gets `pb-16 md:pb-0` to clear the nav bar. No API changes.

**Tech Stack:** React, TypeScript, Tailwind CSS (`md:` breakpoint = 768px), `motion/react` for drawer animation (already in deps)

---

## Task 1: Create MobileNav component

**Files:**

- Create: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/layout/MobileNav.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNav } from "@/src/components/layout/MobileNav";

test("renders 5 nav tabs", () => {
  render(<MobileNav appMode="home" setAppMode={jest.fn()} lang="pl" onMoreOpen={jest.fn()} />);
  expect(screen.getByLabelText("Home")).toBeInTheDocument();
  expect(screen.getByLabelText("Wiedza")).toBeInTheDocument();
  expect(screen.getByLabelText("Zadania")).toBeInTheDocument();
  expect(screen.getByLabelText("Notatki")).toBeInTheDocument();
  expect(screen.getByLabelText("Więcej")).toBeInTheDocument();
});

test("calls setAppMode with 'home' when Home tab clicked", () => {
  const setAppMode = jest.fn();
  render(<MobileNav appMode="wiedza" setAppMode={setAppMode} lang="pl" onMoreOpen={jest.fn()} />);
  fireEvent.click(screen.getByLabelText("Home"));
  expect(setAppMode).toHaveBeenCalledWith("home");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/components/layout/MobileNav.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/src/components/layout/MobileNav'`

- [ ] **Step 3: Create `MobileNav.tsx`**

```tsx
// src/components/layout/MobileNav.tsx
"use client";
import React from "react";
import { Home, MessageCircle, CheckSquare, FileText, MoreHorizontal } from "lucide-react";
import { cn } from "@/src/lib/cn";

type AppMode = "home" | "wiedza" | "planowanie";

interface MobileNavProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  lang: "en" | "pl";
  onMoreOpen: () => void;
}

interface NavTab {
  icon: React.ReactNode;
  labelPl: string;
  labelEn: string;
  action: () => void;
  active: boolean;
}

export function MobileNav({ appMode, setAppMode, lang, onMoreOpen }: MobileNavProps) {
  const tabs: NavTab[] = [
    {
      icon: <Home className="w-5 h-5" />,
      labelPl: "Home",
      labelEn: "Home",
      action: () => setAppMode("home"),
      active: appMode === "home",
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      labelPl: "Wiedza",
      labelEn: "Knowledge",
      action: () => setAppMode("wiedza"),
      active: appMode === "wiedza",
    },
    {
      icon: <CheckSquare className="w-5 h-5" />,
      labelPl: "Zadania",
      labelEn: "Tasks",
      action: () => setAppMode("planowanie"),
      active: appMode === "planowanie",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      labelPl: "Notatki",
      labelEn: "Notes",
      action: () => setAppMode("wiedza"),
      active: false,
    },
    {
      icon: <MoreHorizontal className="w-5 h-5" />,
      labelPl: "Więcej",
      labelEn: "More",
      action: onMoreOpen,
      active: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-[var(--bg2)] border-t border-[var(--border)] h-16 safe-area-inset-bottom">
      {tabs.map((tab) => {
        const label = lang === "pl" ? tab.labelPl : tab.labelEn;
        return (
          <button
            key={label}
            aria-label={label}
            onClick={tab.action}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
              tab.active ? "text-[var(--accent)]" : "text-[var(--text3)] hover:text-[var(--text2)]"
            )}
          >
            {tab.icon}
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/components/layout/MobileNav.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileNav.tsx tests/unit/components/layout/MobileNav.test.tsx
git commit -m "feat(mobile): add MobileNav bottom bar component"
```

---

## Task 2: Create MobileMoreDrawer component

**Files:**

- Create: `src/components/layout/MobileMoreDrawer.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/layout/MobileMoreDrawer.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";

test("renders logout button when open", () => {
  render(<MobileMoreDrawer isOpen={true} onClose={jest.fn()} onLogout={jest.fn()} lang="pl" />);
  expect(screen.getByText("Wyloguj")).toBeInTheDocument();
});

test("calls onClose when backdrop clicked", () => {
  const onClose = jest.fn();
  render(<MobileMoreDrawer isOpen={true} onClose={onClose} onLogout={jest.fn()} lang="pl" />);
  fireEvent.click(screen.getByTestId("drawer-backdrop"));
  expect(onClose).toHaveBeenCalled();
});

test("does not render content when closed", () => {
  render(<MobileMoreDrawer isOpen={false} onClose={jest.fn()} onLogout={jest.fn()} lang="pl" />);
  expect(screen.queryByText("Wyloguj")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/components/layout/MobileMoreDrawer.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/src/components/layout/MobileMoreDrawer'`

- [ ] **Step 3: Create `MobileMoreDrawer.tsx`**

```tsx
// src/components/layout/MobileMoreDrawer.tsx
"use client";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Network, Link, Calendar, Map } from "lucide-react";

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  lang: "en" | "pl";
}

export function MobileMoreDrawer({ isOpen, onClose, onLogout, lang }: MobileMoreDrawerProps) {
  const items = [
    { icon: <Network className="w-5 h-5" />, labelPl: "Graf wiedzy", labelEn: "Knowledge Graph" },
    { icon: <Link className="w-5 h-5" />, labelPl: "Zasoby", labelEn: "Resources" },
    { icon: <Calendar className="w-5 h-5" />, labelPl: "Kalendarz", labelEn: "Calendar" },
    { icon: <Map className="w-5 h-5" />, labelPl: "Mapy myśli", labelEn: "Mind Maps" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg2)] border-t border-[var(--border)] rounded-t-2xl pb-8 md:hidden"
          >
            <div className="w-10 h-1 bg-[var(--border2)] rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 space-y-1">
              {items.map((item) => (
                <button
                  key={item.labelPl}
                  onClick={onClose}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg3)] transition-colors text-left"
                >
                  <span className="text-[var(--text2)]">{item.icon}</span>
                  {lang === "pl" ? item.labelPl : item.labelEn}
                </button>
              ))}
              <div className="border-t border-[var(--border)] my-2" />
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-[var(--bg3)] transition-colors text-left"
              >
                <LogOut className="w-5 h-5" />
                {lang === "pl" ? "Wyloguj" : "Logout"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/components/layout/MobileMoreDrawer.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileMoreDrawer.tsx tests/unit/components/layout/MobileMoreDrawer.test.tsx
git commit -m "feat(mobile): add MobileMoreDrawer bottom sheet component"
```

---

## Task 3: Wire MobileNav into App.tsx and hide desktop sidebar on mobile

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/features/wiedza/WiedzaView.tsx`
- Modify: `src/features/planowanie/PlanowanieView.tsx`

- [ ] **Step 1: Add `hidden md:flex` to AppSidebar root element**

In `src/components/layout/AppSidebar.tsx`, the `<motion.aside>` currently has:

```tsx
<motion.aside
  ...
  className="bg-[var(--bg2)] border-r border-[var(--border)] flex flex-col overflow-hidden"
>
```

Add `hidden md:flex` to the className (replace `flex` with `hidden md:flex`):

```tsx
className =
  "bg-[var(--bg2)] border-r border-[var(--border)] hidden md:flex flex-col overflow-hidden";
```

- [ ] **Step 2: Import and add MobileNav + MobileMoreDrawer in App.tsx**

Add imports at top of `src/App.tsx`:

```ts
import { MobileNav } from "@/src/components/layout/MobileNav";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";
```

Add state:

```ts
const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
```

Wrap the existing return JSX with MobileNav and MobileMoreDrawer. After the closing `</div>` of the main container (before the final `</div>`):

```tsx
return (
  <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
    {/* ... existing appMode rendering ... */}
    <MobileNav
      appMode={appMode}
      setAppMode={setAppMode}
      lang={lang}
      onMoreOpen={() => setMoreDrawerOpen(true)}
    />
    <MobileMoreDrawer
      isOpen={moreDrawerOpen}
      onClose={() => setMoreDrawerOpen(false)}
      onLogout={handleLogout}
      lang={lang}
    />
  </div>
);
```

- [ ] **Step 3: Add bottom padding to main content on mobile**

In `src/features/wiedza/WiedzaView.tsx`, find the `<main>` element (~line 171):

```tsx
<main className="flex-1 min-w-0 flex flex-col relative">
```

Change to:

```tsx
<main className="flex-1 min-w-0 flex flex-col relative pb-16 md:pb-0">
```

Do the same in `src/features/planowanie/PlanowanieView.tsx`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/AppSidebar.tsx src/features/wiedza/WiedzaView.tsx src/features/planowanie/PlanowanieView.tsx
git commit -m "feat(mobile): wire MobileNav into App, hide sidebar on mobile"
```

---

## Task 4: Simplify AppHeader on mobile

**Files:**

- Modify: `src/components/layout/AppHeader.tsx`

- [ ] **Step 1: Hide desktop-only elements on mobile**

In `src/components/layout/AppHeader.tsx`, find the search input div and the mode-switch toggle. Add `hidden md:flex` to hide them on mobile:

The search input wrapper (currently `<div className="relative">`):

```tsx
<div className="relative hidden md:block">{/* search input */}</div>
```

The mode toggle (the `<div className="flex bg-[var(--toggle-bg)]...">` containing Wiedza/Planowanie buttons):

```tsx
<div className="hidden md:flex bg-[var(--toggle-bg)] p-1 rounded-xl border border-[var(--border)]">
  {/* mode toggle */}
</div>
```

The "Brain Active" indicator:

```tsx
<div className="hidden md:flex items-center gap-2 ml-2">{/* brain active */}</div>
```

The Feedback button:

```tsx
<button
  ...
  className="hidden md:flex items-center gap-2 ..."
>
```

Keep visible on mobile: sidebar toggle button (`<ChevronRight>`), `ThemeToggle`, History button.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppHeader.tsx
git commit -m "feat(mobile): simplify AppHeader for mobile — hide desktop-only controls"
```

---

## Task 5: Manual smoke test on mobile viewport

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)**

Select iPhone 14 Pro (393×852) or similar preset.

- [ ] **Step 3: Verify checklist**

1. Sidebar is hidden on mobile — full screen for content ✓
2. Bottom nav bar visible with 5 tabs ✓
3. Tapping Home/Wiedza/Zadania switches views ✓
4. Tapping "Więcej" opens bottom sheet with Graf, Zasoby, Wyloguj ✓
5. Tapping backdrop closes bottom sheet ✓
6. Content doesn't hide under nav bar (bottom padding works) ✓
7. On desktop (> 768px): sidebar visible, MobileNav hidden ✓

- [ ] **Step 4: Run all mobile-related unit tests**

```bash
npx jest tests/unit/components/layout/MobileNav.test.tsx tests/unit/components/layout/MobileMoreDrawer.test.tsx --no-coverage
```

Expected: all PASS
