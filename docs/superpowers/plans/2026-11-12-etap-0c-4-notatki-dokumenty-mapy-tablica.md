# Etap 0c-4: notatki, dokumenty, mapy myśli i tablica w vaulcie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** Ostatnie kolekcje przestają używać Firestore: `notes` → `Notes/<slug>.md`, `documents` → `Documents/<slug>.md`, `mindMaps` → `MindMaps/<id>.json`, `board` → `Board/board.json`. Znikają `chunks`. Edytor notatek (TipTap) zapisuje i czyta Markdown. Po tym kroku katalog `lib/firestore/` nie istnieje, a aplikacja nie czyta ani nie zapisuje Firestore.

**Architektura:** Wspólny pomocnik `lib/nexus/repos/markdown-dir.ts` (notatki i dokumenty to ten sam wzorzec: plik `.md` z frontmatterem, wyszukiwanie po `id`, slug stały po utworzeniu). Cztery cienkie repozytoria w `lib/nexus/repos/`. Nowa operacja `deleteVaultFile` w `vault-fs`. Konwersja HTML ↔ Markdown po stronie klienta w `lib/markdown/html-markdown.ts` (turndown już jest zależnością, dochodzi `markdown-it`); `NoteEditor` dostaje prop `format="markdown"` (domyślnie `"html"`, bo ten sam edytor obsługuje notatki węzłów map myśli, które zostają w HTML).

**Stack:** Next.js 14, TypeScript, Vitest, ESLint, Prettier (lint-staged), `yaml`, `turndown`, `markdown-it` (nowa zależność bezpośrednia; wersja 14.1.1 jest już w `node_modules` tranzytywnie), TipTap 3.

**Źródła:** `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (§3.2, §3.3, §5, §7, P2, P3) oraz plany 0c-2/0c-3 (wzorzec: `repos/common.ts`, `useTempVault`, testy statyczne).

**Zasady wykonania (CLAUDE.md):** testy, `tsc`, lint i build zleca się `cursor` (`scripts/ask-helper.sh --role advice`, prośba o „przeszło" albo listę `plik:linia + przyczyna`). Review diffa przez `agy` (`--role review`) jest wymagany po tym kroku (logika zapisu i usuwania plików).

---

## Stan wyjściowy i zależności

- `main` zawiera 0c-1, 0c-2, 0c-3 (PR #8, #9, #13) i A-1 (usunięcie AI po API). Konsumenci `getNotes`/`getDocuments`/`getMindMap*`/`getBoard`: tylko `services/{note,document,mindMap,board}Service.ts` i trasy `app/api/{notes,documents,upload,mind-maps,board}/**`. **Serwisy (poza `documentService`) i trasy nie zmieniają się.**
- Dane: 6 notatek jest już w `NEXUS/Vault/Notes/*.md` (import 0b, frontmatter `id`, `title`, `created`, `tags`), oryginały HTML w `Notes/.html/`. Katalogi `Documents/`, `MindMaps/`, `Board/` nie istnieją i powstają przy pierwszym zapisie (konto nie ma tych danych, decyzja 1.1).
- Brak `NEXUS_VAULT_PATH` to `VaultConfigError` (jak w 0c-2/0c-3).
- `agent_log` **wypada z 0c-4** (patrz X1): po A-1 nic go nie zapisuje.

## Decyzje (rozstrzygnięte w planie)

| Id  | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | **`agent_log` i `vault-fs.append` wypadają z zakresu** (odstępstwo od §5 i §3.2 specu nadrzędnego). Powód: A-1 usunął `agentService` i `lib/firestore/agentLog.ts`, więc nie ma konsumenta; `append` bez wywołań to martwy kod (YAGNI). Gdy agenci A-2…A-4 zaczną logować sesje, dodadzą `append` razem z pierwszym zapisem do `Sessions/`. Task 12 poprawia spec.                                                          |
| X2  | `chunks` znikają (C2): `lib/firestore/chunks.ts`, eksporty `addChunks`/`deleteChunksBy*` z barrela, typ `ChunkRecord`, wywołanie `addChunks` w `documentService.ingestDocument`.                                                                                                                                                                                                                                            |
| N1  | Notatka: `Notes/<slug>.md`, frontmatter z 0b (`id`, `title`, `created`, `updated`, `tags`), treść = Markdown. Pliki `.md` bez frontmattera albo bez tekstowego `id` są **pomijane przy odczycie i nigdy nie modyfikowane** (jak T1 z 0c-3). Duplikat `id`: obowiązuje plik pierwszy w kolejności nazw. Katalogi (`Notes/.html/`) i pliki nie-`.md` są ignorowane.                                                           |
| N2  | Slug powstaje z tytułu przy tworzeniu (`slugify`), jest stały po zmianie tytułu; kolizja (bez rozróżniania wielkości liter, bo vault bywa na NTFS) daje sufiks `-2`, `-3`. **P3:** `slugify` zostawia tylko `[a-z0-9-]`, więc `\`, `/`, `..` nie przeżywają; test to wymusza. `slugify`/`allocateName` przechodzą z `scripts/import-to-vault/slug.ts` do `lib/nexus/slug.ts` (jedno źródło).                                |
| N3  | `updateNote` nakłada `title`, `content` i `updated` (ISO) na istniejący frontmatter: **nieznane klucze (np. `tags`, wpisy z Obsidiana) i ich kolejność zostają**. Nieznane `id` → `DomainError("Note not found", 404)` (Firestore rzucał błąd 500; jak T5). `deleteNote` jest idempotentny i **nie usuwa** `Notes/.html/<id>.html` (C4: to archiwum oryginałów).                                                            |
| N4  | Odczyt: `title` brak → nazwa pliku bez `.md`; `created_at` = `created`, `updated_at` = `updated` (teksty ISO; pole brakujące = `undefined`). Kolejność: `created` malejąco, remis rosnąco po `id` (`sortByCreated` z `common.ts`). Treść = ciało bez wiodących nowych linii i bez końcowych białych znaków (zgodnie z `formatFrontmatter`).                                                                                 |
| D1  | Dokument: `Documents/<slug>.md`, frontmatter `id`, `name`, `type`, `created`; slug z `name`; ciało = `content`. Reguły N1, N2, N4 jak dla notatek. `deleteDocument` idempotentny. Dokument nie ma `updateDocument`.                                                                                                                                                                                                         |
| M1  | Mapa myśli: `MindMaps/<id>.json`, `id` = nazwa pliku (wygenerowane `generateId`, 20 znaków). **`userId` nie jest zapisywany do vaulta**; repozytorium wpisuje do zwracanego rekordu `userId` z argumentu (`ensureOwnMap` w serwisie zawsze przechodzi; usunięcie `userId` robi 0d). `id` spoza `^[A-Za-z0-9_-]{1,64}$` → `getMindMap` zwraca `null`, `save` rzuca 404, `delete` nic nie robi (ochrona przed ścieżką z URL). |
| M2  | Format JSON mapy: `{ "title", "rootNode", "colWidths", "createdAt", "updatedAt" }`, wcięcie 2 spacje, końcowy `\n`. `getMindMaps` pomija pliki, które się nie parsują; `getMindMap` na takim pliku rzuca `Error` z nazwą pliku (nie ukrywamy uszkodzenia). `saveMindMap` ustawia `updatedAt`.                                                                                                                               |
| B1  | Tablica: `Board/board.json` = `{ "tiles", "frames", "edges", "updatedAt" }`. `getBoard` → `null`, gdy brak pliku; uszkodzony JSON rzuca `Error`. `saveBoard` zawsze nadpisuje (Firestore `set` też; poprawny zapis naprawia uszkodzony plik).                                                                                                                                                                               |
| E1  | Konwersja Markdown ↔ HTML jest po stronie klienta; API, serwisy i repozytoria przechowują Markdown bez przetwarzania. `markdown-it` z `html: false` (surowy HTML w notatce jest escapowany; to także zamyka wektor XSS z `dangerouslySetInnerHTML`).                                                                                                                                                                        |
| E2  | **P2 (toolbar).** W trybie `markdown` zostają: pogrubienie, kursywa, przekreślenie. Znikają: podkreślenie, wyrównanie, rozmiar i krój czcionki, kolor. Rozszerzenia TipTap w tym trybie: `StarterKit.configure({ underline: false })`. Nagłówki i listy działają jak dziś (skróty Markdown w edytorze). Tryb `html` (mapy myśli) bez zmian.                                                                                 |
| E3  | Znane straty Markdown (poza E2): tabele, listy zadań i `<mark>` z notatek HTML nie mają odpowiednika w StarterKit; zostają w `Notes/.html/` jako oryginał (C4). Dokumentujemy w Task 9.                                                                                                                                                                                                                                     |

## Mapa plików

**Nowe**

- `lib/nexus/slug.ts`, `lib/nexus/repos/markdown-dir.ts`, `lib/nexus/repos/{notes,documents,mindMaps,board}.ts`
- `lib/markdown/html-markdown.ts`
- `tests/unit/lib/nexus/slug.test.ts`, `tests/unit/lib/nexus/repos/{markdown-dir,notes,documents,mindMaps,board}.test.ts`, `tests/unit/lib/markdown/html-markdown.test.ts`, `tests/unit/features/notes/NotesPanel.test.tsx` (jeśli nie istnieje)

**Modyfikowane**

- `lib/nexus/vault-fs.ts` (+ `deleteVaultFile`), `tests/unit/lib/nexus/vault-fs.test.ts`, `tests/unit/lib/nexus/static.test.ts`, `tests/unit/lib/nexus/repos-static.test.ts`
- `scripts/import-to-vault/slug.ts` (re-export z `lib/nexus/slug.ts`), `scripts/import-to-vault/notes.ts` (`htmlToMarkdown` z `lib/markdown`)
- `lib/firestore-db.ts`, `types/records.ts`, `services/documentService.ts`, `tests/unit/services/documentService.test.ts`
- `src/components/NoteEditor.tsx`, `src/components/NoteEditorToolbar.tsx`, `tests/unit/components/NoteEditor.test.tsx`, `src/features/notes/NotesPanel.tsx`
- `package.json`, `package-lock.json` (`markdown-it`, `@types/markdown-it`)
- `docs/nexus-vault-formaty-yaml.md`, `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md`

**Usuwane**

- `lib/firestore/{board,chunks,collections,documents,mindMaps,notes,time}.ts` (cały katalog), `tests/unit/lib/firestore/time.test.ts`

**Bez zmian (do sprawdzenia greppem w Task 8):** `services/{note,mindMap,board}Service.ts` i ich testy (mockują `lib/firestore-db`), trasy `app/api/**`, `src/features/mind-maps/MindMapNotesPanel.tsx` (zostaje na HTML).

---

## Część A (0c-4a): repozytoria backendowe

### Task 0: Gałąź i punkt wyjścia

- [ ] **Krok 1: Gałąź**

```bash
git checkout main && git pull --ff-only
git log --oneline -3 | cat        # na górze merge PR #13 (0c-3)
git checkout -b feat/etap-0c-4-notatki-dokumenty-mapy-tablica
```

- [ ] **Krok 2: Stan vaulta.** `git -C ../NEXUS status -s` ma być puste (każdy zapis aplikacji ma być widoczny w `git diff` i odwracalny). `NEXUS_VAULT_PATH` w `.env` wskazuje na `.../NEXUS/Vault`.
- [ ] **Krok 3: Punkt odniesienia** (zleć `cursor`): `npx vitest run` → zapisz liczbę testów (po 0c-3 było 753).

---

### Task 1: `deleteVaultFile` w `vault-fs`

**Pliki:** Modify `lib/nexus/vault-fs.ts`, `tests/unit/lib/nexus/vault-fs.test.ts`, `tests/unit/lib/nexus/static.test.ts`

Interfejs (dopisz na końcu `vault-fs.ts`):

```ts
/**
 * Usuwa plik, jeśli jego wersja jest taka jak `expected` (z ostatniego odczytu).
 * Zwraca false, gdy pliku nie ma; inna wersja daje ConflictError (plik zostaje).
 */
export function deleteVaultFile(
  rel: string,
  opts: VaultFsOptions & { expected: FileVersion }
): boolean;
```

Reguły: `abs = resolveInsideVault(rootOf(opts), rel)`; `current = readAt(abs, rel)`; `null` → `false`; `!sameVersion(current.version, opts.expected)` → `ConflictError("Plik zmienił się w międzyczasie: …")`; w przeciwnym razie `fs.rmSync(abs, { force: true })` i `true`.

- [ ] **Krok 1: Testy (czerwone)** w `vault-fs.test.ts` (pomocniki pliku, opcja `{ root }`):
  - zapis `a.md` → `readVaultFile` → `deleteVaultFile("a.md", { root, expected: file.version })` zwraca `true`, a `readVaultFile("a.md")` daje `null`;
  - nieistniejący plik → `false`;
  - plik zmieniony po odczycie (zapis zewnętrzny przez `fs.writeFileSync`) → rzuca `ConflictError`, plik nadal istnieje;
  - `deleteVaultFile("../x", …)` i `deleteVaultFile("", …)` rzucają `PathOutsideVaultError`;
  - katalog `Dir/` z plikiem `Dir/x.md`: usunięcie `Dir/x.md` nie usuwa katalogu `Dir`.
- [ ] **Krok 2:** `npx vitest run tests/unit/lib/nexus/vault-fs.test.ts` → FAIL (brak eksportu).
- [ ] **Krok 3: Implementacja** wg interfejsu.
- [ ] **Krok 4: `static.test.ts`.** Test 3: `rmSync(` występuje teraz **dwa razy** w `vault-fs.ts` (sprzątanie pliku tymczasowego i `deleteVaultFile`), zmień `toHaveLength(1)` na `2` i tytuł testu na „with exactly two rmSync calls"; `unlinkSync`/`rmdirSync` nadal zakazane. Test 4: dodaj `"deleteVaultFile"` do listy funkcji, które muszą wołać `resolveInsideVault`.
- [ ] **Krok 5:** `npx vitest run tests/unit/lib/nexus` → PASS.
- [ ] **Krok 6: Commit**

```bash
git add lib/nexus/vault-fs.ts tests/unit/lib/nexus
git commit -m "feat(nexus): add deleteVaultFile with version check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `slugify` i `allocateName` do `lib/nexus/`

**Pliki:** Create `lib/nexus/slug.ts`, `tests/unit/lib/nexus/slug.test.ts`; Modify `scripts/import-to-vault/slug.ts`

- [ ] **Krok 1: Przenieś kod.** `slugify`, `allocateName` oraz stałe `TRANSLIT`, `MAX_SLUG`, `RESERVED` przenieś bez zmian zachowania z `scripts/import-to-vault/slug.ts` do `lib/nexus/slug.ts`. W `scripts/import-to-vault/slug.ts` zostaje `htmlFileName` (importuje `node:crypto`) i dochodzi `export { slugify, allocateName } from "../../lib/nexus/slug";`, żeby importy w skryptach i ich testy nie zmieniły się.
- [ ] **Krok 2: Testy w `slug.test.ts`** (jeśli te same przypadki już są w `tests/unit/scripts/import-to-vault/`, zostaw tam, a tu dodaj tylko P3):
  - `slugify("Zażółć gęślą")` → `"zazolc-gesla"`;
  - **P3:** `slugify("a\\b/../c")` → `"a-b-c"`; `slugify("..")` → `"bez-tytulu"`; `slugify("")` → `"bez-tytulu"`; `slugify("  ")` → `"bez-tytulu"`;
  - `slugify("CON")` → `"con-"`;
  - tytuł 200 znaków `"a"` → długość 80;
  - `allocateName("x", (n) => n === "x" || n === "x-2")` → `"x-3"`.
- [ ] **Krok 3:** `npx vitest run tests/unit/lib/nexus/slug.test.ts tests/unit/scripts/import-to-vault` → PASS.
- [ ] **Krok 4: Commit** `refactor(nexus): move slugify to lib/nexus`.

---

### Task 3: `markdown-dir` — wspólny wzorzec notatek i dokumentów

**Pliki:** Create `lib/nexus/repos/markdown-dir.ts`, `tests/unit/lib/nexus/repos/markdown-dir.test.ts`

Interfejs:

```ts
import type { Frontmatter } from "../frontmatter";
import type { FileVersion } from "../vault-fs";

export type MarkdownEntry = {
  rel: string; // np. "Notes/moja-notatka.md"
  id: string; // frontmatter.id
  meta: Frontmatter;
  body: string; // bez wiodących \n i końcowych białych znaków
  version: FileVersion;
};

/** Pliki *.md (bez rozróżniania wielkości liter) bezpośrednio w `dir`, po nazwie rosnąco; pomija pliki bez frontmattera i bez tekstowego `id`. */
export function listEntries(dir: string): MarkdownEntry[];
/** Pierwszy wpis o danym `id` (kolejność nazw) albo null. */
export function findEntry(dir: string, id: string): MarkdownEntry | null;
/** Tworzy plik z nowym `id` i slugiem z `slugSource`; zwraca id i ścieżkę. */
export function createEntry(
  dir: string,
  slugSource: string,
  build: (id: string) => { meta: Frontmatter; body: string }
): { id: string; rel: string };
/** Zmienia wpis o danym `id`; brak → DomainError(notFound, 404). `change` dostaje świeży stan (także po ponowieniu). */
export function updateEntry(
  dir: string,
  id: string,
  notFound: string,
  change: (entry: { meta: Frontmatter; body: string }) => { meta: Frontmatter; body: string }
): Promise<void>;
/** Usuwa wpis o danym `id`; brak → false (bez błędu). */
export function deleteEntry(dir: string, id: string): boolean;
```

Reguły:

- Czytanie: `listVaultFiles(dir)` → filtr `/\.md$/i` → `readVaultFile` → `parseFrontmatter`; `id` z `meta.id` tylko gdy `typeof === "string" && !== ""`. Ciało: `body.replace(/^\n+/, "").replace(/\s+$/, "")`.
- `createEntry`: `generateId(new Set(ids))` z `repos/common.ts`; nazwa = `allocateName(slugify(slugSource), (n) => taken.has(`${n}.md`))`, gdzie `taken` to nazwy plików w `dir` pisane małymi literami (wszystkie pliki z `listVaultFiles`, nie tylko `.md`); tekst = `formatFrontmatter(meta, body)`; zapis `writeVaultFile(rel, text, { expected: null })`. Przy `ConflictError` (plik pojawił się w międzyczasie) ponów od listowania, maks. 5 prób, potem rzuć ostatni błąd.
- `updateEntry`: `rel` z `findEntry`; brak → `DomainError(notFound, 404)`. Zapis przez `updateVaultFile(rel, (current) => …)`: gdy `current` jest `null`, nie parsuje się albo `meta.id !== id` → `DomainError(notFound, 404)` (nigdy nie nadpisuj pliku, którego nie rozpoznajesz); w przeciwnym razie `formatFrontmatter(next.meta, next.body)`.
- `deleteEntry`: `findEntry` → `deleteVaultFile(rel, { expected: entry.version })`; brak → `false`. `ConflictError` propaguje się (409), jak w `deleteMindMap`.

- [ ] **Krok 1: Testy (czerwone)** na `useTempVault()` (katalog `"Notes"`, pliki zapisywane przez `vault.write`):
  - `listEntries` pomija: `readme.txt`, katalog `Notes/.html/x.html`, `.md` bez frontmattera, `.md` z frontmatterem bez `id`, `.md` z `id: 5` (liczba); zwraca `a.md` i `B.MD` w kolejności nazw; plik CRLF jest parsowany; ciało `"\n\ntekst\n\n"` daje `"tekst"`;
  - duplikat `id` w `a.md` i `b.md` → `findEntry` zwraca `a.md`;
  - `createEntry("Notes", "Moja Notatka", build)` → `rel === "Notes/moja-notatka.md"`, plik równa się `formatFrontmatter({ id, title: "Moja Notatka" }, "x")`, `id` ma 20 znaków `[A-Za-z0-9]` i różni się od istniejących `id`; drugie wywołanie ze `slugSource` `"moja notatka"` → `moja-notatka-2.md`; przy istniejącym `Moja-Notatka.MD` (inna wielkość liter) nowy plik to `moja-notatka-2.md`; `slugSource` `"../../etc"` → plik leży w `Notes/` (nazwa `etc.md`);
  - `updateEntry` zachowuje nieznane klucze frontmattera i ich kolejność (`tags`, `x_obsidian`), podmienia `body`; nieznane `id` → `DomainError` 404 z podanym komunikatem; plik, któremu ktoś usunął frontmatter po wyszukaniu (symulacja: `change` nie jest wołane, bo `mutate` widzi tekst bez frontmattera) → 404 i plik bez zmian;
  - `deleteEntry` usuwa plik i zostawia `Notes/.html/x.html`; nieznane `id` → `false`.
- [ ] **Krok 2:** `npx vitest run tests/unit/lib/nexus/repos/markdown-dir.test.ts` → FAIL.
- [ ] **Krok 3: Implementacja** wg interfejsu i reguł.
- [ ] **Krok 4:** ten sam test → PASS. `npx tsc --noEmit` (zleć `cursor`).
- [ ] **Krok 4a: `repos-static.test.ts`.** Test „only yaml-store and the file repos import vault-fs" skanuje `lib/nexus` dynamicznie, więc nowy import w `markdown-dir.ts` wywróciłby go od razu. Dopisz `"lib/nexus/repos/markdown-dir.ts"` do listy oczekiwanych importerów już teraz (w Task 6 i 7 analogicznie `mindMaps.ts` i `board.ts`, w tym samym commicie co repozytorium). Pełne porządki w tym pliku robi Task 8.
- [ ] **Krok 5: Commit** `feat(nexus): add markdown-dir helper for notes and documents`.

---

### Task 4: Repozytorium notatek

**Pliki:** Create `lib/nexus/repos/notes.ts`, `tests/unit/lib/nexus/repos/notes.test.ts`; Modify `types/records.ts` (`NoteRecord`)

Typ (zastępuje obecny `NoteRecord`, bez `Timestamp`):

```ts
export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};
```

Sygnatury (te same nazwy co w barrelu; `userId` ignorowany jak w 0c-2/0c-3):

```ts
export async function getNotes(userId: string): Promise<NoteRecord[]>;
export async function createNote(
  userId: string,
  data: { title: string; content: string }
): Promise<{ id: string; title: string; content: string }>;
export async function updateNote(
  userId: string,
  noteId: string,
  data: { title: string; content: string }
): Promise<void>;
export async function deleteNote(userId: string, noteId: string): Promise<void>;
```

Reguły: katalog `"Notes"`; N1–N4. `createNote`: `meta = { id, title, created: nowIso(), updated: nowIso() }` (ta sama wartość czasu w obu), slug z `title`. `updateNote`: `updateEntry("Notes", id, "Note not found", ({ meta, body }) => ({ meta: { ...meta, title, updated: nowIso() }, body: content }))` (rozproszenie zachowuje kolejność istniejących kluczy; `updated` dopisuje się na końcu, gdy go nie było).

- [ ] **Krok 1: Testy (czerwone)** (`useTempVault`, `vi.useFakeTimers()` + `vi.setSystemTime` tam, gdzie liczy się czas):
  - fixture w formacie 0b (`Notes/pierwsza.md`):

    ```
    ---
    id: noteA
    title: Pierwsza
    created: "2026-03-02T10:00:00.000Z"
    updated: "2026-03-03T10:00:00.000Z"
    tags:
      - praca
    ---

    Treść **pogrubiona**
    ```

    `getNotes("u")` → `[{ id: "noteA", title: "Pierwsza", content: "Treść **pogrubiona**", created_at: "2026-03-02T10:00:00.000Z", updated_at: "2026-03-03T10:00:00.000Z" }]`;

  - sortowanie: dwie notatki, nowsza `created` pierwsza; brak `Notes/` → `[]`; brak `title` → nazwa pliku; `title: ""` zostaje `""`;
  - `createNote("u", { title: "Moja notatka", content: "Treść" })` zwraca `{ id, title, content }` (20 znaków), tworzy `Notes/moja-notatka.md`, a `getNotes` zwraca ją z `created_at` równym zamrożonemu czasowi; tytuł `""` → plik `Notes/bez-tytulu.md`; drugi `""` → `bez-tytulu-2.md`; pusty `content` wraca z `getNotes` jako `""`;
  - znaki specjalne: tytuł `Tytuł: "cytat" # [x]` i treść z liniami `---` oraz `# nagłówek` przechodzą round-trip bez zmian;
  - `updateNote` na fixture: zmienia `title` i treść, **zachowuje `tags` i klucz `x_obsidian: tak`**, ustawia `updated` na zamrożony czas, nie zmienia nazwy pliku ani `created`; nieznane `id` → `DomainError` 404 `"Note not found"`;
  - `deleteNote` usuwa plik, zostawia `Notes/.html/noteA.html`; ponowne wywołanie nie rzuca;
  - równoległe `Promise.all([updateNote(a), updateNote(b)])` na dwóch notatkach kończy się obiema zmianami (osobne pliki).

- [ ] **Krok 2:** `npx vitest run tests/unit/lib/nexus/repos/notes.test.ts` → FAIL.
- [ ] **Krok 3: Implementacja.** W `types/records.ts` zamień `NoteRecord`; `import type { Timestamp }` zostaje do Task 8 (używa go jeszcze `DocumentRecord`).
- [ ] **Krok 4:** test → PASS.
- [ ] **Krok 5: Commit** `feat(nexus): add note repository backed by Notes/*.md`.

---

### Task 5: Repozytorium dokumentów

**Pliki:** Create `lib/nexus/repos/documents.ts`, `tests/unit/lib/nexus/repos/documents.test.ts`; Modify `types/records.ts` (`DocumentRecord`)

```ts
export type DocumentRecord = {
  id: string;
  name: string;
  content: string;
  type: string;
  created_at?: string;
};
export async function getDocuments(userId: string): Promise<DocumentRecord[]>;
export async function createDocument(
  userId: string,
  data: { name: string; content: string; type: string }
): Promise<{ id: string; name: string }>;
export async function deleteDocument(userId: string, docId: string): Promise<void>;
```

Reguły: katalog `"Documents"`; D1; `meta = { id, name, type, created: nowIso() }`; slug z `name` (`"raport.pdf"` → `raport-pdf.md`); sortowanie jak N4; `name`/`type` brak → `""`.

- [ ] **Krok 1: Testy (czerwone):**
  - `createDocument("u", { name: "raport.txt", content: "A\n\nB", type: "text/plain" })` → `{ id, name: "raport.txt" }`, plik `Documents/raport-txt.md`, `getDocuments` zwraca `{ id, name: "raport.txt", content: "A\n\nB", type: "text/plain", created_at: <ISO> }`;
  - treść z linią `---` w środku i z wiodącym `# H1` przechodzi bez zmian; pusty `type: ""` wraca jako `""`;
  - kolizja nazw (`a.txt` i `a-txt`) → `a-txt.md`, `a-txt-2.md`;
  - sortowanie: nowszy `created` pierwszy;
  - `deleteDocument` usuwa plik; nieznane `id` nie rzuca; brak katalogu `Documents/` przy odczycie → `[]`.
- [ ] **Krok 2–4:** FAIL → implementacja → PASS.
- [ ] **Krok 5: Commit** `feat(nexus): add document repository backed by Documents/*.md`.

---

### Task 6: Repozytorium map myśli

**Pliki:** Create `lib/nexus/repos/mindMaps.ts`, `tests/unit/lib/nexus/repos/mindMaps.test.ts`

Sygnatury jak w dzisiejszym `lib/firestore/mindMaps.ts` (typy `MindMap`, `MindMapNode` z `@/types/records` bez zmian):

```ts
export async function getMindMaps(userId: string): Promise<MindMap[]>;
export async function getMindMap(userId: string, mapId: string): Promise<MindMap | null>;
export async function createMindMap(
  userId: string,
  data: { title: string; rootNode: MindMapNode }
): Promise<MindMap>;
export async function saveMindMap(
  userId: string,
  mapId: string,
  patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }
): Promise<void>;
export async function deleteMindMap(userId: string, mapId: string): Promise<void>;
```

Reguły: M1, M2. Ścieżka `MindMaps/${id}.json` budowana tylko po walidacji `ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/`. Lista: `listVaultFiles("MindMaps")` filtr `/\.json$/`. Parsowanie JSON w jednej funkcji `toMindMap(id, userId, text)`; `colWidths` brak → `{}`; `title` brak → `""`. `createMindMap`: `id = generateId(taken)` (taken = nazwy plików bez `.json`), `colWidths: {}`, `createdAt = updatedAt = nowIso()`, zapis `writeVaultFile(rel, json, { expected: null })`. `saveMindMap`: `updateVaultFile` (tylko pola zdefiniowane w `patch`, `updatedAt = nowIso()`); `current === null` → `DomainError("Mind map not found", 404)`. `deleteMindMap`: `readVaultFile`; wynik `null` → powrót bez błędu (idempotentnie); w przeciwnym razie `deleteVaultFile(..., { expected: file.version })`. `ConflictError` z `deleteVaultFile` (plik zmieniony przez proces zewnętrzny między odczytem a usunięciem) **propaguje się jako 409**, bez ponawiania: usunięcie czegoś, co ktoś właśnie edytował, ma być jawną odmową (C5). Serializacja: `JSON.stringify(obj, null, 2) + "\n"` z kluczami w kolejności z M2.

- [ ] **Krok 1: Testy (czerwone):**
  - `createMindMap("u1", { title: "Mapa", rootNode })` → zwraca `MindMap` z `userId: "u1"`, `colWidths: {}`, `createdAt === updatedAt` (zamrożony czas), plik `MindMaps/<id>.json`; **tekst pliku nie zawiera `u1` ani klucza `userId`** i kończy się `\n`;
  - `getMindMap("u2", id)` zwraca rekord z `userId: "u2"` (userId z argumentu); `getMindMaps` zwraca wszystkie mapy; brak katalogu → `[]`;
  - `saveMindMap` z `{ title: "Nowa" }` zmienia tylko tytuł i `updatedAt`, zachowuje `rootNode`, `colWidths`, `createdAt`; z `{ colWidths: { 0: 200, 1: 150 } }` wraca przez `getMindMap` jako `{ 0: 200, 1: 150 }`; z `{ rootNode }` podmienia drzewo;
  - nieznane `id` → `saveMindMap` rzuca `DomainError` 404, `getMindMap` daje `null`, `deleteMindMap` nie rzuca;
  - `id` `"../x"`, `"a\\b"`, `""`, `"a/b"`: `getMindMap` → `null`, `saveMindMap` → 404, `deleteMindMap` bez efektu, żaden plik nie powstaje poza `MindMaps/`;
  - uszkodzony `MindMaps/bad.json` (`{`): `getMindMaps` pomija go i zwraca resztę, `getMindMap("u", "bad")` rzuca błąd z tekstem `MindMaps/bad.json`;
  - `deleteMindMap` usuwa plik; dwa równoległe `createMindMap` dają dwa różne pliki.
- [ ] **Krok 2–4:** FAIL → implementacja → PASS.
- [ ] **Krok 5: Commit** `feat(nexus): add mind map repository backed by MindMaps/*.json`.

---

### Task 7: Repozytorium tablicy

**Pliki:** Create `lib/nexus/repos/board.ts`, `tests/unit/lib/nexus/repos/board.test.ts`

```ts
export async function getBoard(userId: string): Promise<BoardDoc | null>;
export async function saveBoard(
  userId: string,
  board: { tiles: unknown; frames: unknown; edges: unknown }
): Promise<void>;
```

Reguły: B1; plik `Board/board.json`; `getBoard` zwraca `{ tiles, frames, edges }` (bez `updatedAt`); zapis `updateVaultFile("Board/board.json", () => JSON.stringify({ tiles, frames, edges, updatedAt: nowIso() }, null, 2) + "\n")`.

- [ ] **Krok 1: Testy (czerwone):** brak pliku → `null`; `saveBoard` z `{ tiles: [{ id: "t1" }], frames: [], edges: [] }` tworzy `Board/board.json`, a `getBoard` zwraca dokładnie te trzy pola; drugi zapis nadpisuje; zapis nad uszkodzonym plikiem (`{`) udaje się, a odczyt przed zapisem rzucał błąd z `Board/board.json`; tekst pliku zawiera `updatedAt` w ISO.
- [ ] **Krok 2–4:** FAIL → implementacja → PASS.
- [ ] **Krok 5: Commit** `feat(nexus): add board repository backed by Board/board.json`.

---

### Task 8: Przepięcie barrela, usunięcie `chunks` i `lib/firestore/`

**Pliki:** Modify `lib/firestore-db.ts`, `types/records.ts`, `types/index.ts`, `services/documentService.ts`, `tests/unit/services/documentService.test.ts`, `tests/unit/lib/nexus/repos-static.test.ts`; Delete `lib/firestore/` (cały katalog), `tests/unit/lib/firestore/time.test.ts`

- [ ] **Krok 1: Barrel.** W `lib/firestore-db.ts`: eksporty `getDocuments, createDocument, deleteDocument` z `@/lib/nexus/repos/documents`; `getNotes, createNote, updateNote, deleteNote` z `@/lib/nexus/repos/notes`; mapy z `@/lib/nexus/repos/mindMaps`; `getBoard, saveBoard` z `@/lib/nexus/repos/board`. Usuń eksport `addChunks, deleteChunksByDocument, deleteChunksByNote` i `ChunkRecord` z listy typów. Usuń też `ChunkRecord` z re-eksportu w `types/index.ts` (linia 4).
- [ ] **Krok 2: Typy.** W `types/records.ts`: usuń `ChunkRecord` i `import type { Timestamp } from "firebase-admin/firestore"` (po Task 4–5 nic go nie używa; potwierdź `grep -n Timestamp types/records.ts` → brak).
- [ ] **Krok 3: `documentService.ingestDocument`** — usuń podział na akapity i `addChunks`:

```ts
export async function ingestDocument(
  userId: string,
  data: { name: string; content: string; type: string }
) {
  const { id } = await firestoreDb.createDocument(userId, data);
  return { id, name: data.name };
}
```

- [ ] **Krok 4: `documentService.test.ts`** — usuń `mockAddChunks` z mocka i resetów; test „creates document and chunks" zmień na „creates the document and returns id and name" (oczekiwanie `{ id: "doc-1", name: "My Doc" }`, `mockCreateDocument` wołane z `("user-1", { name: "My Doc", content: "Para one\n\nPara two", type: "text" })`).
- [ ] **Krok 5: Usuń Firestore.**

```bash
git rm -r lib/firestore tests/unit/lib/firestore
grep -rn "lib/firestore/\|firebase-admin/firestore\|addChunks\|deleteChunks\|ChunkRecord" --include=*.ts --include=*.tsx app src services lib types tests scripts
```

Oczekiwane: trafienia tylko w `scripts/export-firestore/**`, `scripts/migrate-sqlite-to-firestore.ts` (jednorazowy skrypt na surowym SDK, zostaje do 0e), `tests/integration/scripts/**` i `lib/firebase-admin.ts` (te zostają do 0d–0f). Każde inne trafienie napraw.

- [ ] **Krok 6: `repos-static.test.ts`.** Zaktualizuj stałe:
  - `REPOS` (repozytoria, które **nie** importują `vault-fs`, bo idą przez pomocnika): dodaj `notes`, `documents`. Do `FILE_REPOS` (importują `vault-fs` bezpośrednio): dodaj `markdown-dir`, `mindMaps`, `board` (plik `markdown-dir.ts` ma nazwę z myślnikiem, więc dopisz go jako osobną ścieżkę, nie przez `${name}.ts`). Lista importerów w teście „only yaml-store and the file repos": `[STORE, "lib/nexus/repos/calendarEvents.ts", "lib/nexus/repos/tasks.ts", "lib/nexus/repos/markdown-dir.ts", "lib/nexus/repos/mindMaps.ts", "lib/nexus/repos/board.ts"]` (posortowane).
  - Test „old Firestore repositories are gone": zastąp ciało asercją `expect(fs.existsSync(path.join(ROOT, "lib/firestore"))).toBe(false)`.
  - Test barrela: pętla po `["tags","taskTemplates","resources","tasks","calendarEvents","notes","documents","mindMaps","board"]`; dodatkowo `expect(barrel).not.toMatch(/lib\/firestore\//)`.
  - Test „no firebase / fs / process.env": `FILES` rozszerz o nowe pliki repozytoriów i `lib/nexus/slug.ts`.
- [ ] **Krok 7: Weryfikacja (zleć `cursor`):** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Oczekiwane: „przeszło". Testy `mindMapService`, `boardService`, `noteService` przechodzą bez zmian (mockują barrel).
- [ ] **Krok 8: Commit**

```bash
git add -A lib types services tests
git commit -m "refactor: move notes, documents, mind maps and board to vault files, drop chunks and lib/firestore" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Część B (0c-4b): edytor notatek na Markdown

Część B zmienia to, co użytkownik widzi w notatkach. **Część A i B trafiają do `main` razem (jeden PR)**: po samej części A edytor nadal zapisywałby HTML do plików `.md`.

### Task 9: Zależność i konwersja `html-markdown`

**Pliki:** Create `lib/markdown/html-markdown.ts`, `tests/unit/lib/markdown/html-markdown.test.ts`; Modify `package.json`, `package-lock.json`, `scripts/import-to-vault/notes.ts`

- [ ] **Krok 1: Zależności.** `npm install markdown-it@^14.1.1` oraz `npm install -D @types/markdown-it`. Sprawdź `git diff --stat package.json package-lock.json` (tylko te dwa pakiety i ich zależności typów).
- [ ] **Krok 2: Interfejs** (`// @vitest-environment node` w teście):

````ts
/** HTML edytora → Markdown (atx nagłówki, `-` w listach, ``` w blokach kodu, `*` kursywa, `~~` przekreślenie). */
export function htmlToMarkdown(html: string): string;
/** Markdown → HTML; surowy HTML w źródle jest escapowany, niebezpieczne linki (`javascript:`) dostają pusty `href`. */
export function markdownToHtml(markdown: string): string;
````

`htmlToMarkdown`: przenieś ciało 1:1 z `scripts/import-to-vault/notes.ts` (konfiguracja `TurndownService` + reguła `strikethrough`). `markdownToHtml`: moduł-singleton `new MarkdownIt({ html: false, linkify: false, breaks: false })`, `.render(markdown)`; pusty/biały tekst → `""`.

- [ ] **Krok 3: Testy (czerwone).** Pomocnik `const flat = (s: string) => s.replace(/\n/g, "")`. Gdy oczekiwanie różni się od wyniku wyłącznie białymi znakami, popraw oczekiwanie, nie implementację.
  - `flat(markdownToHtml("**a** *b* ~~c~~"))` → `"<p><strong>a</strong> <em>b</em> <s>c</s></p>"`;
  - `flat(markdownToHtml("# T\n\n- x\n- y"))` → `"<h1>T</h1><ul><li>x</li><li>y</li></ul>"`;
  - `flat(markdownToHtml("<script>alert(1)</script>"))` → `"<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"`;
  - `flat(markdownToHtml("[l](javascript:alert(1))"))` nie zawiera ciągu `href="javascript` (markdown-it renderuje taki link z pustym `href=""`, więc `<a ` może wystąpić);
  - `markdownToHtml("")` i `markdownToHtml("  \n ")` → `""`;
  - `htmlToMarkdown("<p>a <strong>b</strong> <em>c</em> <s>d</s></p>")` → `"a **b** *c* ~~d~~"`;
  - round-trip tekstu: `htmlToMarkdown(markdownToHtml(md)) === md` dla `"Akapit **pogrubiony** i *kursywa*"`, `"## Nagłówek\n\nTekst"` i `"Pierwszy\n\nDrugi"`;
  - `htmlToMarkdown("<p>a</p><h2>H</h2>")` → `"a\n\n## H"`.
- [ ] **Krok 4:** `npx vitest run tests/unit/lib/markdown` → FAIL → implementacja → PASS.
- [ ] **Krok 5: Import 0b.** W `scripts/import-to-vault/notes.ts` usuń lokalne `htmlToMarkdown` i `TurndownService`; dodaj `import { htmlToMarkdown } from "../../lib/markdown/html-markdown";` oraz `export { htmlToMarkdown };` (testy 0b importują go stąd). `npx vitest run tests/unit/scripts/import-to-vault` → PASS bez zmian oczekiwań.
- [ ] **Krok 6: Commit** `feat: add html-markdown conversion shared by editor and import`.

---

### Task 10: `NoteEditor` w trybie Markdown

**Pliki:** Modify `src/components/NoteEditor.tsx`, `src/components/NoteEditorToolbar.tsx`, `tests/unit/components/NoteEditor.test.tsx`

Zmiany w interfejsie:

```ts
// NoteEditor.tsx
export function NoteEditor(props: {
  content: string;
  onContentChange: (value: string) => void; // HTML w trybie "html", Markdown w trybie "markdown"
  placeholder?: string;
  className?: string;
  variant?: "default" | "panel";
  format?: "html" | "markdown"; // domyślnie "html"
});
// NoteEditorToolbar.tsx
export function NoteEditorToolbar(props: { editor: Editor; format?: "html" | "markdown" });
```

Reguły (`format === "markdown"`):

1. Rozszerzenia: `[StarterKit.configure({ underline: false })]` (bez `Underline`, `TextAlign`, `TextStyle`, `Color`, `FontFamily`, `FontSize`). Tryb `html`: lista bez zmian.
2. Treść początkowa: `markdownToHtml(content) || "<p></p>"`.
3. `onUpdate`: `onContentChange(htmlToMarkdown(editor.getHTML()))`.
4. Efekt synchronizacji: `const current = htmlToMarkdown(editor.getHTML()); if (!editor.isFocused && current !== content) editor.commands.setContent(markdownToHtml(content) || "<p></p>", { emitUpdate: false })` (porównanie na poziomie Markdown, żeby własny zapis edytora nie resetował kursora; `!editor.isFocused` to dodatkowe zabezpieczenie: edytor w fokusie nigdy nie jest nadpisywany z zewnątrz, a zmiana notatki remontuje komponent przez `key`).
5. Toolbar w trybie `markdown`: tylko przyciski „Pogrubienie", „Kursywa", „Przekreślenie"; bez „Podkreślenie", wyrównania, selektorów rozmiaru i kroju, wyboru koloru. Najprościej: wczesny `return` z krótszego paska przed resztą JSX.
6. Procedura wklejania zwykłego tekstu (`handleDOMEvents.paste`) zostaje bez zmian w obu trybach.

- [ ] **Krok 1: Testy (czerwone)** w `NoteEditor.test.tsx` (istniejące testy HTML zostają bez zmian i muszą dalej przechodzić). Mock `@tiptap/starter-kit` zmień na `{ default: { configure: () => ({}) } }`, żeby tryb `markdown` mógł wołać `StarterKit.configure`. Dodaj `describe("format=markdown")`, zapytania te same co w istniejących testach przycisków (po `title`/etykiecie):
  - renderuje się bez błędu (`format="markdown"`, `content="**x**"`);
  - są przyciski Pogrubienie, Kursywa, Przekreślenie;
  - **nie ma** przycisków Podkreślenie, wyrównania (lewo/środek/prawo/justuj), selektora rozmiaru czcionki, selektora kroju i przycisku koloru („Kolor");
  - w trybie domyślnym nadal są wszystkie powyższe (regresja dla map myśli).
- [ ] **Krok 2:** `npx vitest run tests/unit/components/NoteEditor.test.tsx` → FAIL (nowe testy).
- [ ] **Krok 3: Implementacja** wg reguł 1–6.
- [ ] **Krok 4:** test → PASS; `npx tsc --noEmit` i lint (zleć `cursor`).
- [ ] **Krok 5: Commit** `feat(editor): add markdown format to NoteEditor`.

---

### Task 11: `NotesPanel` na Markdown

**Pliki:** Modify `src/features/notes/NotesPanel.tsx`; Create `tests/unit/features/notes/NotesPanel.test.tsx` (najpierw `grep -rl NotesPanel tests`; jeśli test istnieje, dopisz do niego)

Zmiany:

- `<NoteEditor format="markdown" … onContentChange={(markdown) => setSelectedNote({ ...selectedNote, content: markdown })} />`.
- Widok tylko do odczytu: `dangerouslySetInnerHTML.__html` = `markdownToHtml(selectedNote.content)`; gdy wynik pusty, dotychczasowy akapit z `noteContentPlaceholder`. Usuń gałąź `trim().startsWith("<")` i ręczne escapowanie (nowa treść jest zawsze Markdownem; `html: false` escapuje surowy HTML).
- `MindMapNotesPanel` bez zmian (tryb `html`).

- [ ] **Krok 1: Testy (czerwone).** Mock `next/dynamic`: `vi.mock("next/dynamic", () => ({ default: () => () => null }))`. Render z `selectedNote = { id: "n1", title: "T", content: "**gruby** tekst", created_at: "2026-03-02T10:00:00.000Z" }` i `noteEditMode=false`:
  - w widoku odczytu jest `<strong>gruby</strong>`;
  - notatka z treścią `<script>alert(1)</script>` nie tworzy elementu `script` w DOM (tekst widoczny jako `<script>alert(1)</script>`);
  - pusta treść pokazuje `noteContentPlaceholder`.
- [ ] **Krok 2–3:** FAIL → implementacja → PASS (`npx vitest run tests/unit/features/notes`).
- [ ] **Krok 4: Commit** `feat(notes): render and edit notes as markdown`.

---

### Task 12: Dokumentacja formatów i status specu

**Pliki:** Modify `docs/nexus-vault-formaty-yaml.md`, `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md`

- [ ] **Krok 1: Format plików.** Dopisz do `docs/nexus-vault-formaty-yaml.md` (zaktualizuj też nagłówek i pierwsze zdanie o liście kolekcji) sekcje: `## Notatki: Notes/<slug>.md` (frontmatter `id`, `title`, `created`, `updated`, `tags`; Markdown; slug stały; reguły N1–N4; nieznane klucze zachowane; `Notes/.html/` to archiwum oryginałów, którego aplikacja nie rusza; E3 — formatowanie, które Markdown gubi), `## Dokumenty: Documents/<slug>.md` (D1), `## Mapy myśli: MindMaps/<id>.json` (M1–M2, przykład JSON), `## Tablica: Board/board.json` (B1). Przykłady z tego planu, bez danych użytkownika.
- [ ] **Krok 2: Spec 0c.** W statusie: 0c-4 zaimplementowany (plan: ta ścieżka); dopisz w §3.2 i §5 notę, że `agent_log` i `vault-fs.append` zostały wycięte z 0c-4 (X1) i wrócą razem z pierwszym konsumentem (A-2…A-4); w §3.3 wiersz `agent_log` oznacz jako „odroczone"; P2 i P3 oznacz jako rozstrzygnięte (E2, N2).
- [ ] **Krok 3:** `npx prettier --check docs` (zleć `cursor`) → przechodzi.
- [ ] **Krok 4: Commit** `docs: document notes, documents, mind map and board formats, mark 0c-4 implemented`.

---

### Task 13: Weryfikacja, review i PR

- [ ] **Krok 1: Pełna weryfikacja** (zleć `cursor`, prośba „przeszło" albo `plik:linia + przyczyna`): `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.
- [ ] **Krok 2: Grep końcowy.** `grep -rn "lib/firestore/\|addChunks\|ChunkRecord\|startsWith(\"<\")" --include=*.ts --include=*.tsx app src services lib types` → brak trafień.
- [ ] **Krok 3: Ręczny przegląd UI** (`NEXUS_VAULT_PATH` ustawiony, `npm run dev`; człowiek lub agent z przeglądarką):
  - **Notatki:** lista pokazuje 6 zaimportowanych notatek; otwarcie notatki z `bez-tytulu.md` renderuje Markdown; edycja (pogrubienie, nagłówek `## `, lista `- `) i zapis → plik w `NEXUS/Vault/Notes/` ma Markdown (`**…**`, `## …`) i zachowane `tags`; nowa notatka „Test 0c-4" → `Notes/test-0c-4.md`; zmiana tytułu nie zmienia nazwy pliku; usunięcie usuwa plik, a `Notes/.html/` zostaje; toolbar ma tylko B/I/S.
  - **Dokumenty:** upload pliku `.txt` w panelu Zasobów → `Documents/<slug>.md`; lista dokumentów i usuwanie działają.
  - **Mapy myśli:** nowa mapa → `MindMaps/<id>.json`; edycja węzła z notatką (edytor nadal ma pełny toolbar, w tym kolor), zmiana szerokości kolumn, zmiana tytułu, usunięcie.
  - **Tablica:** dodanie kafla i ramki, przeładowanie strony → stan zachowany w `Board/board.json`.
  - Po przeglądzie **wycofaj dane testowe**: `git -C ../NEXUS status -s` i `git -C ../NEXUS checkout -- . && git -C ../NEXUS clean -fd` na plikach utworzonych przez test (najpierw obejrzyj listę).
- [ ] **Krok 4: Review** (CLAUDE.md): `scripts/ask-helper.sh --role review --fresh agy "<cel, ścieżki, git diff main...HEAD, pytania: konflikty zapisu i usuwania w vault-fs/markdown-dir, bezpieczeństwo ścieżek (id z URL, slug), utrata danych w notatkach (nieznane klucze frontmattera), regresje w NoteEditor dla map myśli>"`. Drugi pomocnik (`cursor`, `--role advice`) sprawdza testy: czy każda reguła z N1–N4, D1, M1–M2, B1 ma test. Opinie traktuj jak hipotezy: zweryfikuj w kodzie przed zmianą.
- [ ] **Krok 5: PR** do `main` zwykłym merge commitem. Opis: skrót decyzji X1–X2, N1–N4, D1, M1–M2, B1, E1–E3; wyniki weryfikacji; że kalendarz/mapy/tablica/dokumenty startują puste, a dane w Firestore zostają nietknięte do 0e; że `agent_log` został odroczony (X1). Po merge'u następny jest etap 0d (usunięcie auth i `userId`).

---

## Samoocena planu względem specu

- **§3.3 / §5 (0c-4):** `notes` (Task 3–4, 10–11), `documents` (5), `mindMaps` (6), `board` (7), usunięcie `chunks` wraz z `addChunks` w `documentService` i zapisami w `notes` (8); edytor na Markdown (9–11); `agent_log` — świadomie wycięty (X1), do zatwierdzenia przez użytkownika.
- **P2:** E2 (Task 10). **P3:** N2 (Task 2, 3). **C4:** archiwum HTML nietknięte (N3, Task 13). **C5:** nakładanie przez `updateVaultFile` w `markdown-dir`/`mindMaps`/`board`; usuwanie z kontrolą wersji (Task 1).
- **Kryteria §6:** katalog `lib/firestore/` usunięty (Task 8), formaty opisane (Task 12), commity na osobnej gałęzi + PR (Task 0, 13).
- **Spójność nazw:** `listEntries`/`findEntry`/`createEntry`/`updateEntry`/`deleteEntry` (Task 3) są jedynymi funkcjami używanymi w Task 4–5; `deleteVaultFile` (Task 1) używane w Task 3 i 6; `markdownToHtml`/`htmlToMarkdown` (Task 9) używane w Task 10–11.
