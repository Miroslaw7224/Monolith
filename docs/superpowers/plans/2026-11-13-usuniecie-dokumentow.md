# PR 7b: usunięcie wgrywania dokumentów Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usunąć z Monolitha wgrywanie i listę dokumentów (panel w Zasobach, trasy `documents`, `documents/[id]`, `upload`, kod w `contexts/bc_resources`, `uploadFormFile`) oraz martwy pasek limitu dokumentów w sidebarze.

**Architecture:** Czyste usunięcie bez nowego kodu. Trzy commity: A = UI (panel, stopka sidebara, tłumaczenia), B = backend (trasy, kontekst, helper HTTP, testy), C = dokumentacja. Zasoby (linki z tagami) zostają bez zmian.

**Tech Stack:** Next.js 14, TypeScript, zod, vitest.

## Decyzja i uzasadnienie

Decyzja użytkownika z 2026-11-13, po opiniach `agy` i `cursor` (obaj: opcja C, usunąć):

- nic w aplikacji nie czyta wgranych dokumentów; konsumentem był czat RAG, usunięty w etapie A1;
- paczka kontekstu agenta (etap 1-4) ma zamkniętą listę źródeł bez `Documents/` (`docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md:105-112`), agenci CLI czytają cały vault przez MCP;
- `Documents/` przeniesiono w etapie 0c i w PR 7 tylko dla zgodności 1:1; w vaultcie jest jeden plik testowy.

**Poza zakresem:** historyczne specy i plany (`docs/superpowers/**` poza wskazanym wierszem specu asystenta), ADR-y, `docs/refactoring/PLAN.md`, `docs/SecondBrain_tech_stack.md` (opisują stan z czasu powstania), skrypty `export-firestore`/`import-to-vault` i ich testy (słowo „documents" oznacza tam dokumenty Firestore), `README.md` i `STAN-W-KODZIE.md` (PR 10). Istniejący plik `Vault/Documents/nowy-dokument-tekstowy-2-txt.md` w NEXUS usuwa użytkownik ręcznie; aplikacja przestaje czytać i pisać do `Documents/`.

**Decyzja w zakresie, o którą warto zapytać w review:** stopka sidebara (`AppSidebar`) to jeden blok: „PLAN PRO", „Limit 50 dokumentów" i pasek postępu z `documentsCount={0}` (zawsze pusty). Usuwam cały blok, bo sama etykieta „PLAN PRO" bez limitu nie znaczy nic (relikt SaaS po usuniętym planie i waitlistach). Jeśli etykieta ma zostać, Task 1 krok 5 trzeba zawęzić do linii `docsLimit` i paska.

## Zasady wykonania

- Komendy z katalogu `~/projects/Brain_7224/Monolith`, gałąź `feat/pr-7b-usuniecie-dokumentow` (od `main` po PR 7; plan jest jej pierwszym commitem).
- **Testów, lintu, tsc i builda nie uruchamiam w swoim kontekście**: `scripts/ask-helper.sh --role task cursor "<jedno polecenie> ..."`. W prompcie: „uruchom dokładnie to polecenie, bez pipe, bez przekierowań, bez --reporter i bez innych flag". Jedno polecenie na wywołanie albo kilka kolejnych, każde osobno; zgody w panelu cursora zatwierdza kontroler (CLAUDE.md), subagent przy kodzie wyjścia 2 zatrzymuje się i zgłasza NEEDS_CONTEXT.
- `tests/unit/architecture.static.test.ts` i baseline **nie są zmieniane**.
- Usuwamy przez `git rm`; kod usuwamy w całości (brak zakomentowanych resztek, brak flag).

## Mapa plików

Usuwane: `src/features/resources/DocumentsPanel.tsx`, `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/upload/route.ts`, `contexts/bc_resources/repositories/documents.ts`, `lib/http/uploadFormFile.ts`, `tests/unit/lib/http/uploadFormFile.test.ts`, `tests/unit/contexts/bc_resources/{repositories.documents,router.documents,router.upload,services.documents}.test.ts`.

Modyfikowane: `src/features/resources/ResourceSection.tsx`, `src/components/layout/AppSidebar.tsx`, `src/features/planowanie/PlanowanieView.tsx`, `src/features/home/HomeView.tsx`, `src/translations.ts`, `tests/unit/components/layout/AppSidebar.test.tsx`, `contexts/bc_resources/{models,schemas,services,router}.ts`, `contexts/bc_resources/repositories/index.ts`, `tests/unit/contexts/bc_resources/schemas.test.ts`, `tests/unit/lib/nexus/repos-static.test.ts`, `lib/nexus/markdown-dir.ts` (komentarz), `docs/nexus-vault-formaty-yaml.md`, `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` (jeden wiersz).

---

### Task 1: UI (commit A)

- [ ] **Step 1: test sidebara najpierw (czerwony przez `tsc`)**: zastąp `tests/unit/components/layout/AppSidebar.test.tsx` całością:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppSidebar } from "@/src/components/layout/AppSidebar";

const t = {
  title: "Monolith",
  subtitle: "Offline Nexus Core",
};

describe("AppSidebar", () => {
  beforeEach(() => cleanup());

  it("renders title and panel content", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <p>Panel content</p>
      </AppSidebar>
    );

    expect(screen.getByRole("heading", { name: "Monolith" })).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("does not render a plan or document limit block", () => {
    const { container } = render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <span />
      </AppSidebar>
    );

    expect(container.querySelector(".h-1\\.5")).toBeNull();
  });

  it("does not render a user card or a logout button", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <span />
      </AppSidebar>
    );

    expect(screen.queryByText(/wyloguj|logout/i)).toBeNull();
  });
});
```

- [ ] **Step 2:** czerwono: przez `cursor` `npx vitest run tests/unit/components/layout/AppSidebar.test.tsx` → FAIL w teście „does not render a plan or document limit block" (pasek `.h-1.5` jeszcze jest). Oddzielnie `npx tsc --noEmit` → błędy w tym teście (brak `documentsCount`, `proPlan`, `docsLimit`).
- [ ] **Step 3: `AppSidebar.tsx`**: w `AppSidebarTranslations` zostaw tylko `title` i `subtitle`; z `AppSidebarProps` i destrukturyzacji usuń `documentsCount`; usuń cały blok stopki (od `<div className="p-4 border-t border-[var(--border)] space-y-4">` do jego zamknięcia, razem z `bg-[var(--bg3)] p-4 rounded-2xl`, `t.proPlan`, `t.docsLimit` i paskiem `style={{ width: … documentsCount / 50 … }}`). Po zmianie komponent kończy się tak:

```tsx
      <div className="flex-1 overflow-y-auto p-4 space-y-6">{children}</div>
    </motion.aside>
  );
}
```

- [ ] **Step 4: widoki**: w `src/features/planowanie/PlanowanieView.tsx` (okolice L182–216) i `src/features/home/HomeView.tsx` (okolice L192–206) usuń linie `proPlan: t.proPlan,`, `docsLimit: t.docsLimit,` z `sidebarT` oraz `documentsCount={0}` z `<AppSidebar …>`. `sidebarT` zostaje z samymi `title` i `subtitle`.
- [ ] **Step 5: tłumaczenia** (`src/translations.ts`, oba języki, symetrycznie): usuń klucze `noDocs`, `proPlan`, `docsLimit`, `documentsLabel` (EN: L10–12 i L31; PL: L259–261 i L280). Kontrola: `grep -rn "noDocs\|proPlan\|docsLimit\|documentsLabel\|documentsCount" src tests` → pusto (po kroku 6).
- [ ] **Step 6: panel**: `git rm src/features/resources/DocumentsPanel.tsx`; w `src/features/resources/ResourceSection.tsx` usuń import `import { DocumentsPanel } from "./DocumentsPanel";` i blok

```tsx
<DocumentsPanel
  apiFetch={apiFetch}
  noDocs={String(t.noDocs ?? "No documents yet")}
  documentsLabel={String(t.documentsLabel ?? "Documents")}
/>
```

Reszta lewej kolumny (`ResourceFilterSidebar`, `ResourceAddForm`) zostaje bez zmian.

- [ ] **Step 7:** weryfikacja przez `cursor`, osobno: `npx tsc --noEmit`, `npx vitest run tests/unit/components tests/unit/features`, `npm run lint`. Oczekiwane: „przeszło".
- [ ] **Step 8: Commit A**

```bash
git add -A src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(resources): usunięcie panelu dokumentów i stopki limitu w sidebarze (PR 7b, 1/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Backend (commit B)

- [ ] **Step 1: testy dokumentów**:

```bash
git rm tests/unit/contexts/bc_resources/repositories.documents.test.ts \
  tests/unit/contexts/bc_resources/router.documents.test.ts \
  tests/unit/contexts/bc_resources/router.upload.test.ts \
  tests/unit/contexts/bc_resources/services.documents.test.ts \
  tests/unit/lib/http/uploadFormFile.test.ts
```

- [ ] **Step 2: `schemas.test.ts`**: usuń `toDocumentDto,` z importu i cały blok `describe("toDocumentDto", …)` (L31–~49). Pozostałe `describe` (`toResourceDto`, `CreateResourceBodySchema`, `UpdateResourceBodySchema`) bez zmian.
- [ ] **Step 3: `repos-static.test.ts`**: usuń z `REPOS` linię `"contexts/bc_resources/repositories/documents.ts",`. Kontrola: `grep -n "documents" tests/unit/lib/nexus/repos-static.test.ts` → tylko ewentualne wystąpienia niezwiązane z plikiem `documents.ts` (jeśli test ma listę importerów `markdown-dir`, dopasuj ją do wyniku i opisz różnicę w treści commita).
- [ ] **Step 4: trasy i helper**:

```bash
git rm app/api/documents/route.ts "app/api/documents/[id]/route.ts" app/api/upload/route.ts \
  contexts/bc_resources/repositories/documents.ts lib/http/uploadFormFile.ts
```

- [ ] **Step 5: kontekst `bc_resources`** (usuwanie, bez nowego kodu):
  - `repositories/index.ts`: usuń linię `export { getDocuments, createDocument, deleteDocument } from "./documents";` (zostaje eksport zasobów);
  - `models.ts`: usuń typ `UploadedDocument` razem z komentarzem `/** Wgrany dokument … */` (zostaje `Resource`);
  - `schemas.ts`: import → `import type { Resource } from "./models";`, usuń `DocumentDto` i `toDocumentDto` (od `export type DocumentDto` do końca pliku);
  - `services.ts`: usuń sekcję od `// ── dokumenty ──` do końca pliku (`listDocuments`, `ingestDocument`, `deleteDocument`);
  - `router.ts`: usuń import `parseUploadFormFile`, `toDocumentDto` z importu `./schemas`, typ `DocumentContext` i całą sekcję od `// ── dokumenty i upload ──` do końca pliku (`listDocuments`, `deleteDocument`, `uploadDocument`). Zostają `listResources`, `createResource`, `updateResource`, `deleteResource`.
- [ ] **Step 6: komentarz** w `lib/nexus/markdown-dir.ts`: `(\`Notes/\`, \`Documents/\`)`→`(\`Notes/\`)`.
- [ ] **Step 7: kontrola braku resztek**:

```bash
grep -rnE "UploadedDocument|DocumentDto|toDocumentDto|ingestDocument|listDocuments|getDocuments|createDocument|deleteDocument|uploadFormFile|parseUploadFormFile|api/upload|api/documents|Documents/" \
  --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next app src lib contexts services types tests
```

Oczekiwane: pusto. Jeśli coś zostało, usuń lub wyjaśnij (np. wystąpienia w testach skryptów Firestore z innym znaczeniem „documents" są poza tym grepem, bo skrypty nie są skanowane).

- [ ] **Step 8:** weryfikacja przez `cursor`, osobno: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Oczekiwane: „przeszło" (w tym `architecture.static.test.ts` bez zmian; build nie może zgłaszać już tras `/api/documents` ani `/api/upload`).
- [ ] **Step 9: Commit B**

```bash
git add -A app lib contexts src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(bc_resources): usunięcie dokumentów, uploadu i uploadFormFile (PR 7b, 2/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dokumentacja (commit C)

- [ ] **Step 1:** `docs/nexus-vault-formaty-yaml.md`: usuń sekcję `## Dokumenty: \`Documents/<slug>.md\``(nagłówek i akapit, L73–75) razem z jedną pustą linią; sprawdź`grep -n -i "dokument\|Documents" docs/nexus-vault-formaty-yaml.md` i usuń ewentualne inne odwołania w tym pliku (np. w spisie).
- [ ] **Step 2:** `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md:76`: usuń linię `├ + Documents/<slug>.md            dokumenty wgrane w Zasobach (etap 0c)` z drzewa vaulta. Nie zmieniaj innych specyfikacji ani ADR-ów (historia).
- [ ] **Step 3:** `grep -rn "Documents/" docs/nexus-vault-formaty-yaml.md docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` → pusto. Prettier w hooku sformatuje pliki `.md`.
- [ ] **Step 4: Commit C**

```bash
git add docs
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
docs: usunięcie dokumentów z formatów vaulta i drzewa specu asystenta (PR 7b, 3/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Weryfikacja końcowa i review

- [ ] **Step 1:** `git diff main --stat`; `git diff main --name-only | grep architecture` → pusto; `ls app/api/documents app/api/upload lib/http/uploadFormFile.ts src/features/resources/DocumentsPanel.tsx 2>&1` → brak plików.
- [ ] **Step 2:** review diffa przez `agy` (`--role review`, tier deep, jedno wywołanie): czy usunięto wszystko, co dotyczy dokumentów i uploadu (UI, trasy, kontekst, helper, testy, tłumaczenia), czy nie usunięto nic z zasobów (`bc_resources` nadal obsługuje `resources`: `GET`, `POST`, `PUT`, `DELETE`), czy `AppSidebar` i oba widoki (`HomeView`, `PlanowanieView`) są spójne z nowym interfejsem, brak martwych importów i kluczy tłumaczeń. Opinie weryfikuję w kodzie przed poprawkami.
- [ ] **Step 3:** ręcznie w przeglądarce (`npm run dev`): Planowanie → Zasoby (brak panelu „Dokumenty", dodanie linku, edycja, ulubione, filtr tagów, usunięcie działają), Home i Planowanie bez stopki „PLAN PRO / limit dokumentów" w sidebarze, `GET /api/documents` i `POST /api/upload` zwracają 404.

### Task 5: Zamknięcie

- [ ] **Step 1:** po zgodzie użytkownika: `git push -u origin feat/pr-7b-usuniecie-dokumentow` i `gh pr create` (opis z attribution z systemu).
- [ ] **Step 2:** po mergu: w `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „PR 7b" (wpis w Backlogu `PR 7b: usunięcie wgrywania dokumentów, PR #NN — data`), PR 8 zostaje pierwszy w Next; commit tylko `tasks.md`. Przypomnieć użytkownikowi o ręcznym usunięciu `../NEXUS/Vault/Documents/nowy-dokument-tekstowy-2-txt.md`.

---

## Self-review

- **Pokrycie decyzji (`tasks.md`):** panel → zad. 1; trasy `documents`, `documents/[id]`, `upload` → zad. 2 kroki 4; `uploadFormFile` → zad. 2 kroki 1, 4; część dokumentowa `bc_resources` i testy → zad. 2 kroki 1–5; martwy pasek limitu w `AppSidebar` → zad. 1; fragment w `repos-static.test.ts` → zad. 2 krok 3; opis w `docs/nexus-vault-formaty-yaml.md` → zad. 3; wiersz specu asystenta → zad. 3; plik w vaulcie → zad. 5 (ręcznie, użytkownik).
- **Placeholdery:** brak; kroki usuwania wskazują dokładne kotwice (nazwy symboli, linie, bloki do usunięcia). Jedyna kontrola „na miejscu" to ewentualna lista importerów w `repos-static.test.ts` (krok 3 zad. 2) z jednoznacznym działaniem.
- **Spójność nazw:** usuwane symbole (`UploadedDocument`, `DocumentDto`, `toDocumentDto`, `listDocuments`, `ingestDocument`, `deleteDocument`, `getDocuments`, `createDocument`, `parseUploadFormFile`, `DocumentsPanel`, `documentsCount`, klucze `noDocs`/`proPlan`/`docsLimit`/`documentsLabel`) są wyczerpująco ujęte w greps (zad. 1 krok 5, zad. 2 krok 7).
- **Kolejność:** UI przed backendem, bo panel woła trasy; po commicie A aplikacja działa bez panelu, a trasy są jeszcze nieużywane; po commicie B nic ich już nie woła.
