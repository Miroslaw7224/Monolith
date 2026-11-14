# Rename Second Brain → Nexus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every occurrence of "Second Brain" with "Nexus" across the entire codebase — UI, meta tags, storage keys, docs.

**Architecture:** Pure find-and-replace across React components, translations, theme storage keys, and markdown files. No new components, no API changes. The localStorage key migration needs a one-time migration shim in `ThemeProvider` to avoid losing user theme preference.

**Tech Stack:** React, Next.js, TypeScript, Tailwind

---

## Task 1: Update translations (single source of truth)

**Files:**

- Modify: `src/translations.ts`

- [ ] **Step 1: Update `title` and `subtitle` in both locales**

In `src/translations.ts`, change:

```ts
// EN locale (line ~8-9)
title: "Second Brain",
subtitle: "Freelancer Edition",
// also update brainActive and searchPlaceholder to match new brand
brainActive: "Nexus Active",
searchPlaceholder: "Search Nexus...",
```

```ts
// PL locale (mirror lines)
title: "Nexus",
subtitle: "Freelancer Edition",
brainActive: "Nexus aktywny",
searchPlaceholder: "Szukaj w Nexusie...",
```

- [ ] **Step 2: Verify no other "Second Brain" strings remain in translations**

```bash
grep -n "Second Brain\|second.brain\|SecondBrain" src/translations.ts
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/translations.ts
git commit -m "feat(rename): update translations title Second Brain → Nexus"
```

---

## Task 2: Update theme storage key (with migration shim)

**Files:**

- Modify: `src/components/theme/ThemeProvider.tsx`
- Modify: `src/components/theme/ThemeScript.tsx`

- [ ] **Step 1: Update `ThemeProvider.tsx`**

Replace the `STORAGE_KEY` constant and add a one-time migration that reads the old key if the new one is absent:

```ts
// src/components/theme/ThemeProvider.tsx
const OLD_KEY = "secondbrain-theme";
const STORAGE_KEY = "nexus-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  // migrate from old key on first load
  const migrated = window.localStorage.getItem(OLD_KEY);
  if (migrated === "dark" || migrated === "light") {
    window.localStorage.setItem(STORAGE_KEY, migrated);
    window.localStorage.removeItem(OLD_KEY);
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

Keep the rest of the file identical — only `STORAGE_KEY`, `OLD_KEY`, and `getInitialTheme` change.

- [ ] **Step 2: Update `ThemeScript.tsx`** (inline script runs before React hydration)

```ts
// src/components/theme/ThemeScript.tsx
export function ThemeScript() {
  const script = `
(function() {
  var oldKey = 'secondbrain-theme';
  var key = 'nexus-theme';
  var migrated = localStorage.getItem(oldKey);
  if (migrated === 'dark' || migrated === 'light') {
    localStorage.setItem(key, migrated);
    localStorage.removeItem(oldKey);
  }
  var stored = localStorage.getItem(key);
  var theme = stored === 'dark' || stored === 'light' ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx src/components/theme/ThemeScript.tsx
git commit -m "feat(rename): migrate theme storage key secondbrain-theme → nexus-theme"
```

---

## Task 3: Update Next.js metadata and layout

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Update metadata**

```ts
// app/layout.tsx
export const metadata: Metadata = {
  title: "Nexus · Freelancer Edition",
  description:
    "Jedno miejsce na dokumenty i notatki. Chat z AI po swojej bazie wiedzy — odpowiedzi w sekundach, ze wskazaniem źródła. Dla freelancerów.",
};
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(rename): update page title to Nexus"
```

---

## Task 4: Update App.tsx login screen

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Find the login screen header block** (~line 179-189)

Replace:

```tsx
<h1 className="font-bold text-lg tracking-tight text-[var(--text)]">
  Second Brain
</h1>
<p className="text-xs text-[var(--text2)] font-medium uppercase tracking-wider">
  Freelancer Edition
</p>
```

With:

```tsx
<h1 className="font-bold text-lg tracking-tight text-[var(--text)]">
  Nexus
</h1>
<p className="text-xs text-[var(--text2)] font-medium uppercase tracking-wider">
  Freelancer Edition
</p>
```

- [ ] **Step 2: Verify no other "Second Brain" in App.tsx**

```bash
grep -n "Second Brain" src/App.tsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(rename): update login screen branding to Nexus"
```

---

## Task 5: Update landing page components

**Files:**

- Modify: `src/components/landing/LandingPage.tsx`
- Modify: `src/components/landing/Footer.tsx`
- Modify: `src/components/landing/HowItWorks.tsx`
- Modify: `src/components/landing/BeforeAfterHowItWorksRow.tsx`
- Modify: `src/components/LoginScreen.tsx`

- [ ] **Step 1: Bulk replace in each file**

For each file, find and replace `"Second Brain"` → `"Nexus"` (case-sensitive). Run after each file:

```bash
grep -n "Second Brain\|second.brain" src/components/landing/LandingPage.tsx
grep -n "Second Brain\|second.brain" src/components/landing/Footer.tsx
grep -n "Second Brain\|second.brain" src/components/landing/HowItWorks.tsx
grep -n "Second Brain\|second.brain" src/components/landing/BeforeAfterHowItWorksRow.tsx
grep -n "Second Brain\|second.brain" src/components/LoginScreen.tsx
```

Edit each file to replace the occurrences found. Use `Edit` tool for each change.

- [ ] **Step 2: Update AppHeader search placeholder if hardcoded**

```bash
grep -n "Second Brain\|your brain" src/components/layout/AppHeader.tsx
```

If found, update to `"Search Nexus..."` (the translated value from Task 1 already handles dynamic cases).

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/ src/components/LoginScreen.tsx src/components/layout/AppHeader.tsx
git commit -m "feat(rename): update landing page and login screen to Nexus"
```

---

## Task 6: Update services and remaining TS files

**Files:**

- Modify: `services/ragService.ts`
- Modify: `app/politika-prywatnosci/page.tsx`
- Modify: `app/regulamin/page.tsx`

- [ ] **Step 1: Check and update each file**

```bash
grep -n "Second Brain" services/ragService.ts
grep -n "Second Brain" app/politika-prywatnosci/page.tsx
grep -n "Second Brain" app/regulamin/page.tsx
```

Replace any found occurrences. Legal pages (`politika-prywatnosci`, `regulamin`) — update the displayed app name only, do not change legal entity names if present.

- [ ] **Step 2: Update e2e tests**

```bash
grep -rn "Second Brain" tests/e2e/
```

Update any test descriptions/assertions that reference the app name.

- [ ] **Step 3: Update unit tests**

```bash
grep -n "Second Brain" tests/unit/components/layout/AppSidebar.test.tsx
```

Update test descriptions as needed.

- [ ] **Step 4: Commit**

```bash
git add services/ app/politika-prywatnosci/ app/regulamin/ tests/
git commit -m "feat(rename): update services, legal pages, and tests to Nexus"
```

---

## Task 7: Update README and docs

**Files:**

- Modify: `README.md`
- Modify: `docs/SecondBrain_prd.md` (header only, content preserved)

- [ ] **Step 1: Update README.md**

```bash
grep -n "Second Brain" README.md
```

Replace occurrences in headings and descriptions. Keep technical details intact.

- [ ] **Step 2: Update PRD header (optional cosmetic)**

In `docs/SecondBrain_prd.md` line 3, change:

```md
**Second Brain dla Freelancerów**
```

to:

```md
**Nexus dla Freelancerów**
```

- [ ] **Step 3: Final verification sweep**

```bash
grep -rn "Second Brain\|secondbrain\|second-brain" \
  --include="*.ts" --include="*.tsx" --include="*.md" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir=".next" --exclude-dir=".superpowers"
```

Expected: zero results (or only the migration `OLD_KEY` reference in ThemeProvider which is intentional).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/SecondBrain_prd.md
git commit -m "feat(rename): update README and PRD header to Nexus"
```
