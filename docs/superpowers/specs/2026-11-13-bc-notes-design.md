# PR 6: migracja domeny notatek do `contexts/bc_notes/` — projekt

Data: 2026-11-13
Status: do review
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (§4 siatka plików, §5.1 UI wspólne, §6 reguły, §7 wiersz PR 6), wzór: PR 3 `bc_tags` (#26), PR 4 `bc_tasks` (#27), PR 5 `bc_calendar` (#28)

## 1. Cel

Przenieść domenę notatek ze starej warstwy (`services/`, `lib/nexus/repos/`, `lib/validation/`, `types/`) do jednego kontekstu `contexts/bc_notes/` oraz wspólny edytor `NoteEditor*` do `src/components/note-editor/` (spec §5.1). Bez zmiany zachowania: te same testy przechodzą po przeniesieniu.

**Zasada nadrzędna:** projekt dopasowuje się do siatki i reguł 1–9, nie odwrotnie. `architecture.static.test.ts` i jego baseline zostają bez zmian (baseline nie zawiera wpisów o notatkach).

## 2. Zakres

**W zakresie:**

- notatki jako pliki `Notes/*.md` (frontmatter `id`, `title`, `created`, `updated`; ciało = `content`);
- 2 trasy API: `notes` (`GET`, `POST`), `notes/[id]` (`PUT`, `DELETE`);
- UI: `NoteEditor`, `NoteEditorToolbar`, `noteEditorExtensions` → `src/components/note-editor/` (używają `NotesPanel` i `MindMapNotesPanel`, więc to wspólne UI, nie część `src/features/notes/`);
- typ `Note` w `useNotesData` przepięty na DTO ze `schemas`.

**Poza zakresem:** `lib/nexus/markdown-dir.ts` i `record-helpers.ts` (wspólne z dokumentami, zostają w `lib/nexus/`), `lib/markdown/html-markdown.ts` (kod wspólny, spec §5), `src/features/notes/NotesPanel.tsx` i `useNotesData.ts` (zostają w `src/features/notes/`, zmieniają się tylko importy), `NoteResourceRecord` (PR 7), format plików w vaulcie, zmiany zachowania UI i API.

## 3. Struktura kontekstu

Plik → folder tylko gdy urośnie; tu wszystko mieści się w 5 plikach, `repositories.ts` jest jednym plikiem (jak `bc_tags`; w odróżnieniu od `bc_tasks` nie miesza repo plikowego z YAML).

| Plik              | Zawartość                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`       | `Note` (`id`, `title`, `content`, `created_at?`, `updated_at?`: dzisiejszy `NoteRecord` z `types/records`)                                                                                                                    |
| `schemas.ts`      | zod `NoteBodySchema` z `lib/validation/notes.ts` 1:1 (create i update to ten sam kształt); `NoteDto` (`id`, `title`, `content`, `created_at?`: kształt dzisiejszej odpowiedzi `GET`); mapper `toNoteDto(note: Note): NoteDto` |
| `repositories.ts` | `lib/nexus/repos/notes.ts` 1:1 (`markdown-dir`, `record-helpers`), typy z `models`; `createNote` zwraca `Note` (`id`, `title`, `content`)                                                                                     |
| `services.ts`     | `listNotes`, `createNote`, `updateNote`, `deleteNote`: cienkie delegowanie do repozytorium (jak dziś `noteService`; dziś nie ma reguł domeny)                                                                                 |
| `router.ts`       | 4 handlery (`listNotes`, `createNote`, `updateNote`, `deleteNote`); koercje z dzisiejszych `route.ts` 1:1: `POST` → `title ?? ""`, `content ?? ""`; `PUT` → rzutowanie bez domyślnych (`title as string`)                     |

`app/api/notes/route.ts` i `notes/[id]/route.ts` stają się cienkim re-eksportem z `contexts/bc_notes/router` (reguła 4).

**Zgodność odpowiedzi JSON:** `POST` zwraca dziś `{ id, title, content }`, a `GET` `{ id, title, content, created_at }` (bez `updated_at`). `toNoteDto` zwraca te same klucze; `created_at`/`updated_at` równe `undefined` znikają z JSON, więc odpowiedź `POST` jest bajt w bajt taka jak dziś.

## 4. Przepięcia

- `app/api/notes/**`: re-eksport (§3).
- `lib/nexus/repos/notes.ts`, `services/noteService.ts`, `lib/validation/notes.ts`: usunięte (`git mv` / `git rm`).
- `lib/firestore-db.ts`: traci eksport `getNotes, createNote, updateNote, deleteNote` i `NoteRecord`; zostaje `NoteResourceRecord` (PR 7). `types/records.ts` i `types/index.ts` tracą `NoteRecord`.
- `src/features/notes/useNotesData.ts:2`: `Note = NoteDto` z `@/contexts/bc_notes/schemas` (reguła 1: UI importuje tylko `schemas`). `NotesPanel` i `PlanowanieView` biorą `Note` z `useNotesData` i się nie zmieniają. `HomeView` pobiera `/api/notes` i typu nie importuje.
- `NotesPanel.tsx:8-9` i `MindMapNotesPanel.tsx:9-10`: dynamiczny import `@/src/components/note-editor/NoteEditor` (oba miejsca: typ w `ComponentProps<typeof import(...)>` i fabryka).
- `src/components/note-editor/NoteEditor.tsx` importuje względnie `./noteEditorExtensions` i `./NoteEditorToolbar` (bez zmian po przeniesieniu razem) i `@/lib/markdown/html-markdown` (dozwolone, spec §5).
- `README.md` i `docs/mockups/karty/STAN-W-KODZIE.md` (stare ścieżki `src/components/NoteEditor.tsx`) aktualizuje zbiorczo PR 10 (spec §7).

## 5. Testy (TDD)

Kolejność: najpierw przeniesione testy ze zmienionymi importami (czerwone: brak modułu), potem kod.

- `tests/unit/lib/nexus/repos/notes.test.ts` → `tests/unit/contexts/bc_notes/repositories.test.ts` (import `@/contexts/bc_notes/repositories`, helper `../../lib/nexus/repos/helpers`); **pierwszy czerwony test**; asercje bez zmian;
- `tests/unit/services/noteService.test.ts` → `tests/unit/contexts/bc_notes/services.test.ts`: mock `lib/firestore-db` zastąpiony mockiem `@/contexts/bc_notes/repositories`; asercje bez zmian;
- `tests/unit/api/notes.test.ts` → `tests/unit/contexts/bc_notes/router.test.ts`: mock `@/contexts/bc_notes/services`, wywołanie przez `app/api/notes/**` (jak `bc_tags/router.test.ts`); istniejące przypadki `GET`/`POST` bez zmian asercji; **nowe** (dziś nie ma tras `[id]` w testach): `PUT` (sukces + przekazanie `title`/`content` do serwisu), `DELETE`, mapowanie `NotFoundError` → 404 przez `handleServiceError`;
- nowy `tests/unit/contexts/bc_notes/schemas.test.ts`: `toNoteDto` pomija `updated_at`, `NoteBodySchema` przepuszcza nieznane pola (`passthrough`);
- `tests/unit/lib/nexus/repos-static.test.ts`: `REPOS` zamienia `notes` na `contexts/bc_notes/repositories.ts`, a lista barrel (L87) traci `notes`; test starej warstwy, aktualizowany razem z kodem (spec §6, jak w PR 4 i 5);
- `tests/unit/no-user-id.static.test.ts:29` i `no-firebase-client.static.test.ts:32`: znacznik `services/noteService.ts` → `contexts/bc_notes/services.ts` (oba skanują `contexts/`);
- `tests/unit/components/NoteEditor.test.tsx` → `tests/unit/components/note-editor/NoteEditor.test.tsx` (import `@/src/components/note-editor/NoteEditor`; mocki rozszerzeń Tiptap bez zmian);
- `tests/unit/architecture.static.test.ts` i baseline: **bez zmian**, test musi zostać zielony.

## 6. Kolejność i weryfikacja

Jeden PR, dwa commity; po każdym `npx tsc --noEmit` i `npx vitest run` zielone:

1. UI: `NoteEditor*` → `src/components/note-editor/` + oba importy dynamiczne + test edytora (niezależne od backendu, więc buduje się samo);
2. backend: `contexts/bc_notes/` + trasy + przepięcie typu w `useNotesData` + usunięcie starych plików i `NoteRecord` + testy domeny, tras i testy starej warstwy (`repos-static`, `no-user-id`, `no-firebase-client`). Między krokami `tsc` jest celowo czerwony, więc jeden commit po całości.

Na końcu `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build`: przez `cursor` z podsumowaniem „przeszło" / lista `plik:linia + przyczyna`. Review diffa przez `agy --role review` (zgodność JSON tras, zapis do vaulta, importy wg reguł 1–9). Ręcznie w przeglądarce: karta Planowanie → Notatki (lista, dodanie, edycja z formatowaniem, zapis, usunięcie) i panel notatek w mapie myśli (ten sam edytor), Home (licznik/lista notatek).

## 7. Ryzyka

- **Dwa dynamiczne importy edytora** (`NotesPanel`, `MindMapNotesPanel`) mają ścieżkę w dwóch miejscach każdy (typ i fabryka): pominięcie jednego wychodzi dopiero w `tsc`/`build`, nie w testach jednostkowych, więc `build` jest obowiązkowy.
- **Odpowiedź `POST`:** zmiana typu zwracanego przez repozytorium (`Note` zamiast `{id,title,content}`) nie może dodać pól do JSON; test routera pilnuje dokładnych kluczy odpowiedzi.
- **`PUT` bez domyślnych:** dziś `title`/`content` bez wartości trafiają do repozytorium jako `undefined` (rzutowanie `as string`); migracja zachowuje to 1:1, bez „naprawiania" w tym PR (osobna decyzja).
