# Etap 0d-2: klient bez logowania, usunięcie waitlisty, pakietu `firebase`, e2e bez auth, dokumentacja

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans. Kroki mają checkboxy (`- [ ]`). Komendy testów, tsc, lint, build i e2e uruchamia `cursor` (`scripts/ask-helper.sh --role task`, w prompcie „nie edytuj plików”, wynik: „przeszło” albo lista `plik:linia + przyczyna`). Review diffa robi `agy --role review`. Plan powstał z odczytu kodu, bez uruchamiania czegokolwiek: weryfikacja należy do wykonawcy (czerwony test, zielony test).

**Cel:** po tym podkroku aplikacja otwiera się od razu na `/dashboard` bez logowania i bez żadnego kodu Firebase po stronie klienta. Znikają: ekran logowania, hook `useAuth`, waitlista (klient i API), `lib/getAuth.ts`, landing, strony prawne, pakiety `firebase` i `vercel`. E2E działają na tymczasowym vaulcie, nigdy na prawdziwym. Dokumentacja (ADR, README, spec) opisuje stan „lokalne pliki zamiast Firestore”.

**Architektura:** plasterki po warstwach, `tsc` zielony po każdym commicie: (1) klucze `localStorage` i prop `userId` w tablicy, (2) usunięcie propów `user`/`onLogout` z widoków, (3) `App.tsx` bez auth + routing + usunięcie plików klienta, (4) usunięcie pozostałości serwerowych (auth, waitlista), (5) zależności i konfiguracja, (6) e2e na tymczasowym vaulcie, (7) dokumentacja. Testy statyczne pilnują, by Firebase po stronie klienta i `userId` nie wróciły.

**Stos:** Next 14.2 (App Router), React 19, Vitest, Playwright, TypeScript.

**Stan wyjściowy (main po PR #15):** `tsc` czysty, `lint` 3 znane ostrzeżenia `react-hooks` (`TaskTemplatesModal.tsx:73`, `BoardCanvas.tsx:253`, `BoardCanvas.tsx:279`), 860 testów w 113 plikach, `build` przechodzi.

---

## Decyzje (domyślne; użytkownik może je zmienić przed wykonaniem)

- **D1. Routing.** `/` przekierowuje serwerowo do `/dashboard`. Grupa `app/(protected)` znika: `dashboard/page.tsx` i `notes/page.tsx` (przekierowanie do `/dashboard`) przenosimy do `app/dashboard/` i `app/notes/`. URL-e się nie zmieniają. `app/auth/login` znika bez przekierowania.
- **D2. Landing i strony prawne usuwamy** (spec §7 0d, O4): `src/components/landing/*`, `app/regulamin`, `app/politika-prywatnosci`, `app/cookies`. Aplikacja jest lokalna, regulamin i polityka cookies nie mają odbiorcy.
- **D3. Jeden lokalny użytkownik = brak użytkownika w UI.** Znikają propy `user` i `onLogout` (`AppSidebar`, `MobileMoreDrawer`, `HomeView`, `PlanowanieView`), karta użytkownika z przyciskiem „Wyloguj” w sidebarze i przycisk „Wyloguj” w szufladzie mobilnej. Powitanie na Home to samo `t.homeGreeting` („Dzień dobry”) bez imienia.
- **D4. Klucze `localStorage` bez `userId`:** `monolith_active_session` i `board-viewport`. Starych kluczy (z uid) nie migrujemy: skutek to jednorazowa utrata trwającej sesji pracy i widoku tablicy po aktualizacji, zaakceptowana. Migracja ze starego prefiksu `second_brain_active_session_` znika.
- **D5. `apiFetch` zostaje jako prop** (jest przekazywany w ~15 plikach i ich testach), ale staje się cienkim `fetch` w `src/lib/apiFetch.ts` (stała, stabilna referencja). Usunięcie propu z drzewa komponentów to osobne sprzątanie poza tym etapem. Token i nagłówek `Authorization` znikają; przeglądarka sama wysyła `Origin`/`Sec-Fetch-Site`, więc `middleware.ts` z 0d-1 przepuszcza zapisy.
- **D6. Odstępstwa od listy ze specu §7 0d (zostają do 0e, bo ich potrzebuje eksport i bramka):** `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore*`, `scripts/migrate-sqlite-to-firestore.ts` wraz ze skryptem npm i pakietem `better-sqlite3` (skrypt go importuje), `scripts/cleanup-knowledge-collections.ts`, `docker-compose-test.yml`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, skrypty `emulator:docker` i `test:integration:docker` (testy integracyjne eksportu używają emulatora), `.vercel/` (krok 0e.3), serwerowe `FIREBASE_*` w `.env.example`. Usuwamy teraz tylko: pakiet `firebase` (klient), pakiet `vercel` i skrypty `vercel`/`vercel:prod`, `NEXT_PUBLIC_FIREBASE_*`. Uwaga dla 0e.3: bez pakietu `vercel` zdjęcie wdrożenia robi się przez panel Vercela albo `npx vercel`.
- **D7. E2E nigdy nie dotyka prawdziwego vaulta.** Playwright startuje własny serwer na porcie **3199** z `NEXUS_VAULT_PATH` wskazującym katalog tymczasowy, z własnym `distDir` (`.next-e2e`, żeby nie kolidować z dev serverem użytkownika na 3100) i bez `reuseExistingServer`. Specyfikacje `*.authenticated.spec.ts` tworzą zadania i notatki, więc bez tego zapisałyby do prawdziwego vaulta.
- **D8. Test integracyjny `tests/integration/services/mindMapService.integration.test.ts`** zostaje bez zmian (jest wyłączony z domyślnego `vitest`; sprzątanie tła emulatora to 0e, razem z testami eksportu).
- **D9. Klucze tłumaczeń** związane z logowaniem (`login`, `register`, `email`, `password`, `noAccount`, `hasAccount`, `signInGoogle`, `logout`) usuwamy z `src/translations.ts` tylko wtedy, gdy po zmianach nie ma żadnego użycia (sprawdza grep w Task 3).

## Pliki

**Tworzone:** `src/lib/apiFetch.ts`, `tests/unit/lib/apiFetch.test.ts`, `tests/unit/no-firebase-client.static.test.ts`, `app/dashboard/page.tsx` (przeniesienie), `app/notes/page.tsx` (przeniesienie), `tests/e2e/global-setup.ts`, `docs/adr/020-lokalne-pliki-zamiast-firestore.md`.

**Zmieniane:** `src/lib/activeSession.ts`, `src/features/board/boardViewport.ts`, `BoardCanvas.tsx`, `BoardTab.tsx`, `src/components/layout/AppSidebar.tsx`, `MobileMoreDrawer.tsx`, `src/features/home/HomeView.tsx`, `src/features/planowanie/PlanowanieView.tsx`, `src/App.tsx`, `app/page.tsx`, `src/translations.ts`, `tests/unit/no-user-id.static.test.ts`, `tests/unit/package-scripts.static.test.ts`, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `next.config.mjs`, `playwright.config.ts`, `tests/e2e/home.spec.ts`, `dashboard|tasks|notes` specs (zmiana nazwy), `README.md`, ADR 002/003/016, spec etapu 0, istniejące testy dotykanych komponentów.

**Usuwane:** `app/(protected)/layout.tsx`, `app/auth/`, `app/regulamin/`, `app/politika-prywatnosci/`, `app/cookies/`, `src/components/landing/`, `src/components/LoginScreen.tsx`, `src/lib/auth/`, `src/lib/firebase-client.ts`, `app/api/auth/`, `app/api/waitlist/`, `lib/getAuth.ts`, `lib/waitlistCheckEmail.ts`, ich testy (`tests/unit/components/landing/`, `tests/unit/lib/getAuth.test.ts`, `tests/unit/lib/waitlistCheckEmail.test.ts`, `tests/unit/api/waitlist-check-email.test.ts`), `tests/e2e/auth.setup.ts`, `auth-login-logout.spec.ts`, `public-pages.spec.ts`.

---

### Task 0: gałąź i stan wyjściowy

- [ ] **Krok 1:** `git switch main && git pull --ff-only && git switch -c feat/etap-0d-2-klient-bez-logowania`.
- [ ] **Krok 2:** `cursor` (`--tier light`, `--role task`, „nie edytuj plików”): `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Oczekiwane: tsc czysty, 3 znane ostrzeżenia, 860 testów w 113 plikach. Inny wynik: stop, zbadać przed dalszymi krokami.

---

### Task 1: klucze `localStorage` i tablica bez `userId` (D4)

**Pliki:** `src/lib/activeSession.ts`, `src/features/board/boardViewport.ts`, `src/features/board/BoardCanvas.tsx`, `BoardTab.tsx`, `src/features/home/HomeView.tsx`, `src/features/planowanie/PlanowanieView.tsx`; testy: `tests/unit/lib/activeSession.test.ts`, `tests/unit/features/board/boardViewport.test.ts`, `BoardCanvas.test.tsx`, `BoardTab.test.tsx`.

- [ ] **Krok 1: testy (czerwone).** Zastąp `tests/unit/lib/activeSession.test.ts` całością:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveSession, getActiveSession, setActiveSession } from "@/src/lib/activeSession";

const SESSION = {
  title: "Praca",
  startedAt: "2026-11-12T10:00:00.000Z",
  tags: ["a"],
  color: "#fff",
};

describe("activeSession", () => {
  beforeEach(() => localStorage.clear());

  it("zapisuje pod kluczem monolith_active_session", () => {
    setActiveSession(SESSION);
    expect(localStorage.getItem("monolith_active_session")).not.toBeNull();
    expect(getActiveSession()).toEqual(SESSION);
  });

  it("zwraca null, gdy nic nie zapisano lub dane są uszkodzone", () => {
    expect(getActiveSession()).toBeNull();
    localStorage.setItem("monolith_active_session", "{nie json");
    expect(getActiveSession()).toBeNull();
    localStorage.setItem("monolith_active_session", JSON.stringify({ title: "x" }));
    expect(getActiveSession()).toBeNull();
  });

  it("clearActiveSession usuwa zapis", () => {
    setActiveSession(SESSION);
    clearActiveSession();
    expect(getActiveSession()).toBeNull();
    expect(localStorage.getItem("monolith_active_session")).toBeNull();
  });
});
```

W `tests/unit/features/board/boardViewport.test.ts` zamień wywołania na bez pierwszego argumentu: `readViewport()`, `storeViewport({ x: 10, y: 20, zoom: 0.8 })`, usuń asercję `readViewport("u2")` (jeden użytkownik) i sprawdź klucz: `expect(localStorage.getItem("board-viewport")).not.toBeNull()` po zapisie. W `BoardCanvas.test.tsx` (linie 70, 94, 108) i `BoardTab.test.tsx` (55, 82) usuń prop `userId="u1"`.

- [ ] **Krok 2: czerwone.** `npx vitest run tests/unit/lib/activeSession.test.ts tests/unit/features/board` (cursor). Oczekiwane: FAIL (sygnatury, klucze).
- [ ] **Krok 3: implementacja.**
  - `src/lib/activeSession.ts`: `const STORAGE_KEY = "monolith_active_session";`, usuń `OLD_STORAGE_KEY_PREFIX` i blok migracji. Sygnatury: `getActiveSession(): ActiveSession | null`, `setActiveSession(session: ActiveSession): void`, `clearActiveSession(): void` (jedno `localStorage.removeItem(STORAGE_KEY)`). Walidacja kształtu danych i obsługa `typeof window === "undefined"`/`try-catch` bez zmian.
  - `src/features/board/boardViewport.ts`: `const KEY = "board-viewport";`, usuń funkcję `key(userId)`; `readViewport(): BoardViewport | null`, `storeViewport(viewport: BoardViewport): void`.
  - `BoardCanvas.tsx`: usuń prop `userId` (destrukturyzacja linia ~165, typ ~175), `readViewport()` (~193), `storeViewport(viewport)` (~312).
  - `BoardTab.tsx`: usuń prop `userId` (destrukturyzacja ~25, typ ~31) i `userId={userId}` przy `<BoardCanvas>` (~104).
  - `PlanowanieView.tsx`: usuń `userId={user?.id ?? ""}` przy `<BoardTab>` (~331). Efekt ładowania sesji (~78–84) zastąp przez:

```tsx
useEffect(() => {
  setActiveSessionState(getActiveSession());
}, []);
```

`handleStartSession`: usuń `if (!user?.id) return;`, wywołanie `setActiveSession(session)`, tablica zależności `[]`. `handleEndSession`: warunek `if (!activeSession) return;`, `clearActiveSession()`, zależności `[activeSession, apiFetch]`. Efekt `fetchNotes` (`if (user && planningTab === "notes")`) zmień na `if (planningTab === "notes")` z zależnościami `[planningTab, fetchNotes]`.

- `HomeView.tsx`: te same trzy zmiany co w `PlanowanieView` dla sesji (efekt ~128–131 → `useEffect(() => { setActiveSessionState(getActiveSession()); }, []);`, `handleStartSession` ~134–146, `handleEndSession` ~148–178). **Nie** usuwaj jeszcze propu `user` (Task 2); `greeting` zostaje.
- [ ] **Krok 4: zielone.** `cursor`: `npx tsc --noEmit` i `npx vitest run`. Oczekiwane: tsc czysty, wszystkie testy zielone.
- [ ] **Krok 5: commit.** `git add -A && git commit -m "refactor(client): klucze localStorage i tablica bez userId"` (stopka Co-Authored-By zgodnie z konwencją sesji).

---

### Task 2: widoki bez propów `user` i `onLogout` (D3)

**Pliki:** `src/components/layout/AppSidebar.tsx`, `MobileMoreDrawer.tsx`, `HomeView.tsx`, `PlanowanieView.tsx`, `src/App.tsx` (tylko przekazywane propy); testy `tests/unit/components/layout/AppSidebar.test.tsx`, `MobileMoreDrawer.test.tsx`, `tests/unit/features/home/HomeView.test.tsx`.

- [ ] **Krok 1: testy (czerwone).**
  - `AppSidebar.test.tsx`: we wszystkich renderach usuń propy `user` i `onLogout`; asercje o nazwie użytkownika („Jan K”, inicjały, `only@mail.com`) usuń; test „invokes onLogout when logout is clicked” zamień na test „nie renderuje karty użytkownika ani przycisku wylogowania”: ten sam render co w pierwszym teście, potem `expect(screen.queryByText(/wyloguj|logout/i)).toBeNull();`.
  - `MobileMoreDrawer.test.tsx`: usuń `onLogout={vi.fn()}` z pięciu renderów (linie 26, 40, 54, 68, 83); jeśli któryś test klika „Wyloguj”, zamień go na asercję `expect(screen.queryByText(/wyloguj|logout/i)).toBeNull()`.
  - `HomeView.test.tsx`: usuń `user: {...}` (linia 31) i `onLogout: vi.fn()` (linia 41) z domyślnych propów; jeśli test sprawdza imię w powitaniu, oczekiwane powitanie to dokładnie `t.homeGreeting` bez przecinka i imienia.
- [ ] **Krok 2: czerwone.** `npx vitest run tests/unit/components/layout tests/unit/features/home` (cursor). Oczekiwane: FAIL.
- [ ] **Krok 3: implementacja.**
  - `AppSidebar.tsx`: usuń `AppSidebarUser`, pola `user`, `onLogout`, `logout` z `AppSidebarTranslations`; z dolnego bloku `<div className="p-4 border-t ...">` usuń cały pierwszy `<div className="flex items-center gap-3 p-3 bg-[var(--bg3)] rounded-xl">` (karta użytkownika z przyciskiem). Blok z `proPlan`/`docsLimit` zostaje.
  - `MobileMoreDrawer.tsx`: usuń prop `onLogout` (typ ~10, destrukturyzacja ~18), cały `<button>` z `LogOut` (~94–107) oraz import `LogOut`, jeśli nieużywany gdzie indziej.
  - `HomeView.tsx` i `PlanowanieView.tsx`: usuń propy `user`, `onLogout` (typy, destrukturyzacja), import `type AppSidebarUser`, `user={user}`/`onLogout={onLogout}` przy `<AppSidebar>`, pole `logout: t.logout` w obiekcie `sidebarT`; w `HomeView` `const greeting = t.homeGreeting;`.
  - `src/App.tsx`: z JSX usuń `user={user}` i `onLogout={handleLogout}` przy `HomeView`, `PlanowanieView` oraz `onLogout={handleLogout}` przy `MobileMoreDrawer` (reszta `App.tsx` bez zmian do Task 3; `handleLogout` zostaje chwilowo nieużywane, lint może ostrzec o nieużywanej zmiennej do Task 3).
- [ ] **Krok 4: zielone.** `cursor`: tsc i `npx vitest run`. Oczekiwane: zielone.
- [ ] **Krok 5: commit.** `refactor(client): widoki bez propów user i onLogout`.

---

### Task 3: `App.tsx` bez auth, routing, usunięcie plików klienta (D1, D2, D5)

**Pliki:** zob. sekcje Tworzone/Usuwane.

- [ ] **Krok 1: test statyczny (czerwony).** Utwórz `tests/unit/no-firebase-client.static.test.ts`:

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRS = ["app", "src", "lib", "services", "types"];
/** Znikają w Task 4 (serwerowe pozostałości logowania i waitlisty). */
const EXCLUDED = [
  "lib/getAuth.ts",
  "lib/waitlistCheckEmail.ts",
  "app/api/auth/",
  "app/api/waitlist/",
];
const PATTERN =
  /from ["']firebase\/|firebase-client|\buseAuth\b|getIdToken|\/api\/waitlist|getAuthUserId|LoginScreen/;

function collect(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !EXCLUDED.some((ex) => rel.startsWith(ex))) {
        out.push(rel);
      }
    }
  };
  for (const dir of DIRS) walk(dir);
  return out;
}

describe("0d-2 static guard: no Firebase client, login or waitlist in application code", () => {
  it("scans existing sources", () => {
    const files = collect();
    expect(files).toContain("src/App.tsx");
    expect(files).toContain("app/dashboard/page.tsx");
    expect(files).toContain("services/noteService.ts");
  });

  it("does not use the firebase client SDK, useAuth, tokens or the waitlist", () => {
    const hits: string[] = [];
    for (const rel of collect()) {
      const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (PATTERN.test(line)) hits.push(`${rel}:${i + 1} (${line.trim()})`);
      });
    }
    expect(hits).toEqual([]);
  });
});
```

Test `apiFetch` `tests/unit/lib/apiFetch.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/src/lib/apiFetch";

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deleguje do fetch z tym samym URL i opcjami, bez nagłówka Authorization", async () => {
    const response = new Response("{}", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const init = { method: "POST", headers: { "Content-Type": "application/json" } };
    const res = await apiFetch("/api/notes", init);

    expect(res).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes", init);
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("Authorization");
  });

  it("bez opcji woła fetch z pustym obiektem opcji", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags", {});
  });
});
```

- [ ] **Krok 2: czerwone.** `npx vitest run tests/unit/no-firebase-client.static.test.ts tests/unit/lib/apiFetch.test.ts` (cursor). Oczekiwane: FAIL (brak modułu, trafienia w `App.tsx` itd.).
- [ ] **Krok 3: `src/lib/apiFetch.ts`:**

```ts
/**
 * Wywołanie API własnej aplikacji. Bez tokenu: serwer jest lokalny (0d-1),
 * a strażnik w middleware pilnuje Host i Origin.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, options);
}
```

- [ ] **Krok 4: przepisz `src/App.tsx`** w całości:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from "react";
import { translations } from "@/src/translations";
import { apiFetch } from "@/src/lib/apiFetch";
import PlanowanieView from "@/src/features/planowanie/PlanowanieView";
import HomeView from "@/src/features/home/HomeView";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";
import { CardRail } from "@/src/features/cards/CardRail";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";
import { buildCardCommands } from "@/src/features/cards/cards";

export default function App() {
  const [lang, setLang] = useState<"en" | "pl">("pl");
  const t = translations[lang];
  const { appMode, setAppMode, planningTab, setPlanningTab, placeholder, activeCard, selectCard } =
    useCardNavigation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const cardCommands = useMemo(() => buildCardCommands(selectCard), [selectCard]);
  useCardHotkeys({
    onSelectCard: selectCard,
    onOpenPalette: openPalette,
    disabled: paletteOpen,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  return (
    <div
      className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden"
      data-card={activeCard}
    >
      <CardRail activeCard={activeCard} onSelect={selectCard} onOpenPalette={openPalette} />
      {placeholder ? (
        <CardPlaceholder cardId={placeholder} />
      ) : appMode === "home" ? (
        <HomeView
          apiFetch={apiFetch}
          lang={lang}
          t={t}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          appMode={appMode}
          setAppMode={setAppMode}
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
          setLang={setLang}
        />
      ) : (
        <PlanowanieView
          apiFetch={apiFetch}
          lang={lang}
          t={t}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          appMode={appMode}
          setAppMode={setAppMode}
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
          setLang={setLang}
        />
      )}
      <MobileNav
        appMode={appMode}
        setAppMode={setAppMode}
        planningTab={planningTab}
        setPlanningTab={setPlanningTab}
        lang={lang}
        onMoreOpen={() => setMoreDrawerOpen(true)}
      />
      <MobileMoreDrawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        lang={lang}
        onSelectTab={(tab) => {
          setPlanningTab(tab);
          setAppMode("planowanie");
          setMoreDrawerOpen(false);
        }}
      />
      {paletteOpen && <CommandPalette commands={cardCommands} onClose={closePalette} />}
    </div>
  );
}
```

Przed zapisem `grep -rn "from \"@/src/App\"\|from \"\./App\"" src app tests` (jedyny import to `app/(protected)/dashboard/page.tsx`; eksporty `User` i `AppProps` zniknęły, tsc to potwierdzi).

- [ ] **Krok 5: routing.**
  - `git mv "app/(protected)/dashboard" app/dashboard` i `git mv "app/(protected)/notes" app/notes`; `git rm "app/(protected)/layout.tsx"`.
  - `app/dashboard/page.tsx` w całości:

```tsx
"use client";

import App from "@/src/App";

export default function DashboardPage() {
  return <App />;
}
```

- `app/page.tsx` w całości:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- `app/notes/page.tsx` bez zmian (przekierowanie do `/dashboard`).
- [ ] **Krok 6: usunięcie plików klienta.** `git rm -r app/auth app/regulamin app/politika-prywatnosci app/cookies src/components/landing tests/unit/components/landing src/components/LoginScreen.tsx src/lib/auth src/lib/firebase-client.ts`.
- [ ] **Krok 7: tłumaczenia (D9).** Dla każdego z kluczy `login register email password noAccount hasAccount signInGoogle logout` wykonaj `grep -rnE "\bt\.KLUCZ\b|translations\.[a-z]+\.KLUCZ" src app tests | grep -v translations.ts`. Klucz bez żadnego trafienia usuń z obu wersji językowych (`en` i `pl`) w `src/translations.ts`; klucz z trafieniem zostaw. Jeśli typ tłumaczeń jest wyprowadzony z obiektu `en`, nic więcej nie trzeba zmieniać (`tsc` to potwierdzi).
- [ ] **Krok 8: zielone.** `cursor`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Oczekiwane: tsc czysty; lint bez nowych ostrzeżeń (3 znane); testy zielone, w tym oba nowe pliki. Liczba plików testowych spadnie o skasowany `WaitlistForm.test.tsx` i wzrośnie o dwa nowe.
- [ ] **Krok 9: commit.** `feat(client): aplikacja bez logowania, routing na /dashboard, usunięcie landingu i stron prawnych`.

---

### Task 4: pozostałości serwerowe: auth i waitlista

**Pliki:** zob. Usuwane; testy `tests/unit/no-user-id.static.test.ts`, `tests/unit/no-firebase-client.static.test.ts`.

- [ ] **Krok 1: rozszerz testy statyczne (czerwone).** W `tests/unit/no-user-id.static.test.ts`: `DIRS = ["app/api", "services", "lib/nexus", "types", "src"]`, usuń stałą `EXCLUDED` oraz jej użycie w `walk` (warunek zostaje `/\.tsx?$/.test(entry.name)`), w teście „scans existing sources” zamień ostatnią asercję na `expect(files).toContain("src/lib/activeSession.ts");` i dodaj `expect(files.some((f) => f.startsWith("app/api/waitlist/"))).toBe(false);`. W `tests/unit/no-firebase-client.static.test.ts` ustaw `const EXCLUDED: string[] = [];` (i usuń komentarz o Task 4). Uruchom oba (cursor). Oczekiwane: FAIL wskazujący pliki `app/api/auth`, `app/api/waitlist`, `lib/getAuth.ts`, `lib/waitlistCheckEmail.ts` (`plik:linia`).
- [ ] **Krok 2: usunięcie.** `git rm -r app/api/auth app/api/waitlist lib/getAuth.ts lib/waitlistCheckEmail.ts tests/unit/lib/getAuth.test.ts tests/unit/lib/waitlistCheckEmail.test.ts tests/unit/api/waitlist-check-email.test.ts`. `lib/firebase-admin.ts` zostaje (D6): po tym kroku importują go już tylko skrypty eksportu i migracji oraz ich testy.
- [ ] **Krok 3: zielone.** `cursor`: tsc, lint, `npx vitest run`. Oczekiwane: zielone. Jeśli tsc wskaże import usuniętego pliku, to realna pozostałość (np. mock w teście): usuń ją, nie przywracaj pliku.
- [ ] **Krok 4: commit.** `refactor(server): usunięcie getAuth, waitlisty i api/auth`.

---

### Task 5: zależności i konfiguracja (D6)

**Pliki:** `package.json`, `package-lock.json`, `.env.example`, `tests/unit/package-scripts.static.test.ts`.

- [ ] **Krok 1: test (czerwony).** Dopisz do `tests/unit/package-scripts.static.test.ts` (`pkg` czyta już tylko `scripts`; rozszerz jego typ o `dependencies?: Record<string, string>; devDependencies?: Record<string, string>;`):

```ts
describe("0d-2: pakiety i skrypty po odpięciu Firebase i Vercela", () => {
  it("nie ma klienckiego pakietu firebase ani vercel", () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all).not.toHaveProperty("firebase");
    expect(all).not.toHaveProperty("vercel");
  });

  it.each(["vercel", "vercel:prod"])("nie ma skryptu %s", (name) => {
    expect(pkg.scripts).not.toHaveProperty(name);
  });

  it("firebase-admin zostaje do etapu 0e (eksport i weryfikacja zrzutu)", () => {
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).toHaveProperty("firebase-admin");
  });
});
```

- [ ] **Krok 2: czerwone.** `npx vitest run tests/unit/package-scripts.static.test.ts` (cursor). Oczekiwane: FAIL.
- [ ] **Krok 3: implementacja.** `npm uninstall firebase vercel` (aktualizuje `package-lock.json`); w `package.json` usuń skrypty `vercel` i `vercel:prod`. W `.env.example` usuń blok „Firebase (client config - frontend)” i wszystkie `NEXT_PUBLIC_FIREBASE_*`; nad blokiem serwerowych `FIREBASE_*` zmień komentarz na: `# Firebase Admin SDK: tylko do eksportu danych (scripts/export-firestore*), do etapu 0e. Aplikacja go nie używa.`; usuń komentarz „required for Auth + Firestore”. Pozostałe skrypty (`emulator:docker`, `test:integration:docker`, `migrate:sqlite-to-firestore`) i pakiet `better-sqlite3` zostają (D6).
- [ ] **Krok 4: zielone.** `cursor`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Oczekiwane: wszystko przechodzi (build potwierdza, że nic nie importuje `firebase/*`).
- [ ] **Krok 5: commit.** `chore: usunięcie pakietów firebase i vercel, czyszczenie .env.example`.

---

### Task 6: e2e na tymczasowym vaulcie (D7)

**Pliki:** `playwright.config.ts`, `tests/e2e/global-setup.ts`, `next.config.mjs`, `.gitignore`, specyfikacje.

- [ ] **Krok 1: `next.config.mjs`.** W obiekcie `nextConfig` dodaj `distDir: process.env.NEXT_DIST_DIR || ".next",` (domyślnie bez zmian). W `.gitignore` dodaj linię `.next-e2e/` (usuń też `playwright/.auth/`, bo auth znika).
- [ ] **Krok 2: `tests/e2e/global-setup.ts`:**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Katalog tymczasowego vaulta dla e2e. Stała ścieżka, bo config czytają też workery. */
export const E2E_VAULT = path.join(os.tmpdir(), "monolith-e2e-vault");

export default function globalSetup(): void {
  fs.rmSync(E2E_VAULT, { recursive: true, force: true });
  fs.mkdirSync(E2E_VAULT, { recursive: true });
}
```

- [ ] **Krok 3: `playwright.config.ts` w całości:**

```ts
import { defineConfig, devices } from "@playwright/test";
import { E2E_VAULT } from "./tests/e2e/global-setup";

/** Port inny niż dev (3100) i osobny distDir, żeby e2e nie dotykało serwera użytkownika ani jego vaulta. */
const PORT = 3199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT} -H 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXUS_VAULT_PATH: E2E_VAULT,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
```

- [ ] **Krok 4: specyfikacje.** `git rm tests/e2e/auth.setup.ts tests/e2e/auth-login-logout.spec.ts tests/e2e/public-pages.spec.ts`. `git mv tests/e2e/dashboard.authenticated.spec.ts tests/e2e/dashboard.spec.ts`, tak samo `tasks.authenticated.spec.ts` → `tasks.spec.ts` i `notes.authenticated.spec.ts` → `notes.spec.ts`. W tych trzech sprawdź `grep -nE "auth|login|storageState|E2E_" tests/e2e/*.spec.ts` (nie powinno być trafień; poza nazwą `describe` nic się nie zmienia, zmień „Dashboard (zalogowany)” na „Dashboard”). Zastąp `tests/e2e/home.spec.ts` całością:

```ts
import { test, expect } from "@playwright/test";

test.describe("Strona główna", () => {
  test("/ przekierowuje do /dashboard i pokazuje aplikację bez logowania", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Monolith" })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("/notes przekierowuje do /dashboard", async ({ page }) => {
    await page.goto("/notes");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  });
});
```

- [ ] **Krok 5: uruchomienie.** Zanim `cursor` wystartuje e2e: sprawdź `ss -ltnp | grep 3199` (port wolny). `cursor`: `npx playwright test` (jeśli brakuje przeglądarek, raport „brak przeglądarek Playwright”, wtedy `npx playwright install chromium` jest do zatwierdzenia przez użytkownika). Oczekiwane: wszystkie testy przechodzą; `ls /tmp/monolith-e2e-vault` pokazuje pliki utworzone przez zadania i notatki (dowód, że zapisy trafiły do tymczasowego vaulta). Potem `git status`: zmiany w `tsconfig.json` wprowadzone przez Next dla `distDir` (wpisy `.next-e2e/types`) cofnij `git checkout tsconfig.json`, a jeśli to się powtarza, dodaj `.next-e2e` do `exclude` w `tsconfig.json`.
- [ ] **Krok 6: kontrola.** Prawdziwy vault nietknięty: `git -C ../NEXUS status --short` bez nowych zmian pochodzących z e2e.
- [ ] **Krok 7: commit.** `test(e2e): scenariusze bez logowania na tymczasowym vaulcie`.

---

### Task 7: dokumentacja

**Pliki:** `docs/adr/020-lokalne-pliki-zamiast-firestore.md`, `docs/adr/002-firebase-auth.md`, `003-firestore-database.md`, `016-firestore-emulator-docker.md`, `README.md`, `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`.

- [ ] **Krok 1: ADR-020.** Utwórz plik w formacie istniejących ADR (sprawdź nagłówek `002-firebase-auth.md`): Status „Zaakceptowany”, data 2026-11-12. Treść: kontekst (jedna osoba, lokalna praca, vault NEXUS jako źródło prawdy), decyzja (dane w plikach Markdown/YAML przez `lib/nexus`, brak logowania, serwer tylko na 127.0.0.1 z `lib/localGuard.ts` i `middleware.ts`, zapisy wyłącznie do `Vault/`), konsekwencje (brak wielu użytkowników, ochrona portu przez strażnika zamiast auth, `firebase-admin` do 0e wyłącznie dla eksportu), odesłania do speców etapu 0. Wymień, że zastępuje ADR-002, ADR-003 i ADR-016.
- [ ] **Krok 2: statusy.** W ADR-002 i ADR-003 zmień status na „Zastąpiony przez ADR-020”. W ADR-016 status „Zastąpiony przez ADR-020 w etapie 0e; do tego czasu emulator służy wyłącznie testom integracyjnym eksportu”.
- [ ] **Krok 3: README.** Linia 3 (stack: „Firebase (Auth, Firestore)”) → opis lokalnej aplikacji (Next.js 14, vault Markdown/YAML). Sekcję zmiennych (linie ~10–12) zredukuj do `NEXUS_VAULT_PATH` (wymagane), z uwagą, że `FIREBASE_*` dotyczy tylko eksportu do 0e. Linię ~28 („Docelowo Vercel”) zastąp: aplikacja działa lokalnie (`npm run dev` na `http://127.0.0.1:3100`), bez wdrożenia. Dopisz krótko: serwer wiąże się z `127.0.0.1`, skrypty spoza przeglądarki wysyłają `X-Nexus-Client: 1`, e2e uruchamiają się na tymczasowym vaulcie (`npm run test:e2e`).
- [ ] **Krok 4: spec etapu 0.** W statusie (linia 4): 0d-2 zaimplementowany. W §7 0d dopisz „Stan 0d-2” z listą odstępstw D6 (co zostało do 0e i dlaczego), wskazaniem planu `2026-11-12-etap-0d-2-klient-bez-logowania-i-sprzatanie.md` i uwagą dla 0e.3 o `npx vercel`. W §7 0e krok 3 dopisz: pakiet `vercel` usunięty w 0d-2.
- [ ] **Krok 5:** `npx prettier --check docs README.md` (cursor), poprawić formatowanie, jeśli trzeba. Commit: `docs: ADR-020 lokalne pliki zamiast Firestore, README i status etapu 0d-2`.

---

### Task 8: weryfikacja końcowa, review, PR

- [ ] **Krok 1:** `cursor`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, `npx playwright test`. Oczekiwane: tsc czysty, 3 znane ostrzeżenia lint, testy zielone (liczba plików i testów spada o usunięte, rośnie o nowe; podać w PR), build i e2e przechodzą.
- [ ] **Krok 2: smoke test na tymczasowym vaulcie.** `NEXUS_VAULT_PATH=<katalog tymczasowy>` i serwer na porcie **3198** uruchomiony przez `npx next dev -p 3198 -H 127.0.0.1` z zapamiętanym własnym PID; zatrzymać wyłącznie ten PID (nigdy `pkill -f "next dev"`; na 3100 może działać serwer użytkownika). Sprawdź `curl -s -o /dev/null -w "%{http_code}" -H "X-Nexus-Client: 1" http://127.0.0.1:3198/api/tasks` → 200, `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3198/auth/login` → 404, `curl -sI http://127.0.0.1:3198/` → 307 do `/dashboard`.
- [ ] **Krok 3: review.** `agy --role review --tier deep`: „zrecenzuj `git diff main...HEAD`; szukaj: pozostałości `firebase`/`useAuth`/`userId`/`Authorization` w `src`, `app`, `lib`; martwych importów po usuniętych plikach; przypadków, gdzie e2e mogłoby zapisać poza `NEXUS_VAULT_PATH`; usuniętych kluczy tłumaczeń, które nadal są używane; wynik jako `plik:linia + problem`”. Uwagi zweryfikować w kodzie przed zmianą; poprawki w osobnym commicie.
- [ ] **Krok 4: PR** do `main`: tytuł po polsku, np. „Etap 0d-2: klient bez logowania, usunięcie waitlisty i pakietu firebase”; w opisie: decyzje D1–D9, wyniki weryfikacji, lista odstępstw od specu (D6), uwaga o jednorazowej utracie trwającej sesji pracy i widoku tablicy (D4), uwaga dla użytkownika o ręcznym przeglądzie. Stopka: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Krok 5: ręczny przegląd użytkownika (poza kodem).** Po restarcie `npm run dev` (port 3100): `/` wchodzi na `/dashboard` bez logowania; Home, Zadania, Notatki, Kalendarz, Mapy, Tablica ładują dane z prawdziwego vaulta; start i koniec sesji pracy działa; w sidebarze i szufladzie mobilnej brak „Wyloguj”; `/auth/login` i `/regulamin` dają 404. W WSL2 `localhost` z przeglądarki Windows ma nadal trafiać w `127.0.0.1`; jeśli nie, zgłosić zamiast zmieniać host na `0.0.0.0`.

---

## Poza zakresem

- **Usunięcie propu `apiFetch` z drzewa komponentów** (D5) i ewentualne zastąpienie go bezpośrednim `fetch`/klientem API.
- **0e:** `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore*`, `scripts/migrate-sqlite-to-firestore.ts` i skrypt npm, `better-sqlite3`, `scripts/cleanup-knowledge-collections.ts`, testy integracyjne eksportu i `mindMapService.integration.test.ts`, `vitest.integration.config.ts`, `docker-compose-test.yml`, `firebase.json`, `firestore.*`, skrypty `emulator:docker` i `test:integration:docker`, `.vercel/`, zdjęcie wdrożenia i projektu Firebase, serwerowe `FIREBASE_*` w `.env.example`.
- **0f:** `Vault/Work/`.
