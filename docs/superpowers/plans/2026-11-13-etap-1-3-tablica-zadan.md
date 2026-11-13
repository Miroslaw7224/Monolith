# Etap 1-3: tablica zadań projektu — plan wykonania

> **Dla agenta wykonującego:** wymagany skill: `superpowers:subagent-driven-development` (zalecany) albo `superpowers:executing-plans`. Kroki mają checkboxy (`- [ ]`). Weryfikacja (czerwony → zielony test) należy do wykonawcy: plan celowo nie zawiera pełnych implementacji, tylko interfejsy, reguły i przypadki testowe z oczekiwanymi wartościami (CLAUDE.md, „Pisanie planów”).

**Spec:** `docs/superpowers/specs/2026-11-13-etap-1-3-tablica-zadan-design.md` (zatwierdzony; decyzje D1–D12 są wiążące).
**Gałąź:** `feat/etap-1-3-tablica-zadan` (już utworzona, spec zacommitowany).

**Cel:** zamienić listę zadań w teczce projektu (odczyt) w tablicę Blokery / Teraz / Następne / Icebox z zapisem do `Projects/<id>/tasks.md` (odhaczanie, dodawanie, edycja, usuwanie, przenoszenie).

**Architektura:** nowy edytor tekstowy `contexts/bc_projects/repositories/tasks-file.ts` (czyste funkcje na tekście, bez `lib/nexus`), cienkie `readProjectBoard` / `writeProjectTasks` w `repositories/index.ts` (wersja pliku, strażnik zapisu), reguły domeny w `services.ts`, jedna trasa `POST /api/projects/[id]/tasks` (`z.discriminatedUnion("op")`), UI `ProjectTasksBoard.tsx`.

**Stack:** Next.js 14, TypeScript, zod, vitest (+ Testing Library), `lib/nexus/vault-fs` (`readVaultFile`, `writeVaultFile`).

## Zasady wykonania (z CLAUDE.md)

- Kierunek importów: `route` → `router` → `services` → `repositories` → `lib/nexus`. `models.ts` nie importuje `lib/nexus`; UI importuje z kontekstu tylko `schemas`. `tests/unit/architecture.static.test.ts` **nie jest zmieniany**; pęknięcie naprawia się kodem.
- Testy, `npx tsc --noEmit`, `npm run lint`, `npm run build` zlecać `cursorowi` (`scripts/ask-helper.sh --role task cursor "…"`, prośba: „przeszło” albo lista `plik:linia + przyczyna`). Po zadaniach 5 i 8 poprosić `agy` o review diffa (`--role review`).
- Komendy testowe (z katalogu `Monolith`): `npx vitest run <ścieżka>`; pełny zestaw: `npx vitest run`.
- Każdy task kończy się osobnym commitem; format wiadomości: `feat(bc_projects): …` / `test(…)`, na końcu `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` uruchamia prettier przy commicie.
- Edytor zakłada **LF**: `readVaultFile` normalizuje CRLF → LF, `writeVaultFile` zapisuje LF.

## Mapa plików

| Plik                                                         | Akcja    | Odpowiedzialność                                                                                           |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `contexts/bc_projects/models.ts`                             | zmiana   | `TaskColumn`, `BoardTask`, `TasksBoard`, `TaskOp`; `ProjectWithContent.board`                              |
| `contexts/bc_projects/repositories/tasks-file.ts`            | **nowy** | czysty edytor tekstu: `readBoardText`, `applyTaskOp`, stałe                                                |
| `contexts/bc_projects/repositories/index.ts`                 | zmiana   | `readProjectBoard`, `writeProjectTasks`                                                                    |
| `contexts/bc_projects/services.ts`                           | zmiana   | `getProject` zwraca `board`; `applyTaskOp` (reguły: limit, zgodność `text`, wersja, data)                  |
| `contexts/bc_projects/schemas.ts`                            | zmiana   | `TaskOpInputSchema`, `TaskOpInputDto`, `BoardTaskDto`, `TasksBoardDto`, `toDetailDto` z `board`            |
| `contexts/bc_projects/router.ts`                             | zmiana   | `postTasks`                                                                                                |
| `app/api/projects/[id]/tasks/route.ts`                       | **nowy** | tylko re-eksport `postTasks as POST`                                                                       |
| `src/features/projects/mutation.ts`                          | zmiana   | `ProjectActions.tasksOp`                                                                                   |
| `src/features/projects/useProjects.ts`                       | zmiana   | `tasksOp` przez istniejące `mutate("POST", "/tasks", …)`                                                   |
| `src/features/projects/ProjectTasksBoard.tsx`                | **nowy** | tablica 4 kolumn                                                                                           |
| `src/features/projects/ProjectDossier.tsx`                   | zmiana   | podmiana listy `project.tasks` na `ProjectTasksBoard`                                                      |
| `src/features/projects/projects.css`                         | zmiana   | style `.prj-board*`                                                                                        |
| `tests/unit/contexts/bc_projects/tasks-file.test.ts`         | **nowy** | testy edytora tekstu                                                                                       |
| `tests/unit/contexts/bc_projects/repositories.tasks.test.ts` | **nowy** | testy `readProjectBoard` / `writeProjectTasks` na tymczasowym vaulcie                                      |
| `tests/unit/contexts/bc_projects/services.test.ts`           | zmiana   | mock `readProjectBoard`/`writeProjectTasks`, testy reguł                                                   |
| `tests/unit/contexts/bc_projects/schemas.test.ts`            | zmiana   | testy wejścia/DTO                                                                                          |
| `tests/unit/contexts/bc_projects/router.test.ts`             | zmiana   | trasa `tasks`, `board` w `detailProject`                                                                   |
| `tests/unit/features/projects/ProjectsView.test.tsx`         | zmiana   | `board` w helperze `detail()`, testy tablicy; stary test listy zadań (ok. l. 312–318) przepisać na `board` |

## Wspólny kontrakt (używany w kilku taskach)

Typy w `models.ts` (małe, współdzielone, więc pełny kod):

```ts
export type TaskColumn = "blockers" | "now" | "next" | "icebox";
export const TASK_COLUMNS: readonly TaskColumn[] = ["blockers", "now", "next", "icebox"];
export const NOW_LIMIT = 3;

/** `text` jest kanoniczny: bez końcowego ` [now::]` i bez końcowego ` — YYYY-MM-DD` ukończonego zadania. */
export type BoardTask = { text: string; done: boolean; doneDate?: string };
export type TasksBoard = {
  blockers: BoardTask[];
  now: BoardTask[];
  next: BoardTask[];
  icebox: BoardTask[];
  /** Wersja `tasks.md`; `null`, gdy pliku nie ma. */
  version: VersionToken | null;
};

export type TaskRef = { column: TaskColumn; index: number; text: string };
export type TaskOp =
  | { op: "add"; column: TaskColumn; text: string }
  | ({ op: "toggle" } & TaskRef)
  | ({ op: "edit"; newText: string } & TaskRef)
  | ({ op: "remove" } & TaskRef)
  | ({ op: "move"; to: TaskColumn } & TaskRef);
```

`ProjectWithContent` dostaje pole `board: TasksBoard`.

**Reguły parsowania linii zadania** (jedyne źródło prawdy; używa ich `tasks-file.ts`):

- Sekcje: linia `^## (.+?)\s*$`. Mapowanie nagłówek → kolumna: `Blokery` → `blockers`, `Next` → `next`/`now`, `Backlog` → `icebox` (dokładnie, po `trim`). Pierwsze wystąpienie nagłówka wygrywa; inne sekcje są ignorowane i nietykane.
- Zadanie tablicy: linia `^- \[( |x|X)\] (.*)$` **bez wcięcia** (wcięte linie i `* [ ]` nie są zadaniami tablicy).
- Blok zadania: linia zadania + kolejne linie zaczynające się od spacji/tabulatora i niepuste (`^[ \t]+\S`). Pusta linia lub linia bez wcięcia kończy blok.
- Treść: `body = match[2].trim()`. Zdejmij z końca dwa możliwe sufiksy **w dowolnej kolejności**, każdy najwyżej raz: `\s\[now::\]` (flaga `now`) oraz, **tylko gdy zadanie ukończone**, `\s—\s(\d{4}-\d{2}-\d{2})` (`doneDate`). Po każdym zdjęciu `trimEnd`. Reszta (`trim`) to `text`. Dla nieukończonego końcowa data zostaje w `text`.
- Kolumna zadania: sekcja `Blokery` → `blockers`; `Backlog` → `icebox`; `Next` → `now`, gdy `now && !done`, inaczej `next` (znacznik przy ukończonym jest ignorowany i znika przy pierwszym przepisaniu linii).
- `index` = pozycja zadania w swojej **kolumnie** w kolejności pliku.
- Kanoniczna linia: `- [ ] <text>` + (`now` ? ` [now::]` : ``) albo `- [x] <text>` + (`doneDate` ? ` — <doneDate>` : ``). Przepisywana jest wyłącznie pierwsza linia bloku i tylko w operacjach, które ją zmieniają (`[X]` → `[x]` na dotkniętej linii jest akceptowane).
- Placeholder sekcji: linia niebędąca zadaniem, po `trim` pasująca do `^_?Brak\b`.

---

## Task 1: Typy i odczyt tablicy z tekstu (`readBoardText`)

**Pliki:** zmiana `contexts/bc_projects/models.ts`; nowe `contexts/bc_projects/repositories/tasks-file.ts`, `tests/unit/contexts/bc_projects/tasks-file.test.ts`.

**Interfejs:**

```ts
// tasks-file.ts
export function readBoardText(text: string | null): Omit<TasksBoard, "version">;
```

`null` (brak pliku) i tekst bez znanych sekcji dają cztery puste kolumny.

Fixture testowy (wspólny dla tasków 1–3, w pliku testowym):

```ts
const SAMPLE = `# Tasks — Demo
> [[demo/demo|Demo]] | [[demo/index|Info]]

## Blokery

_Brak aktywnych blokerów_

## Next

- [ ] **Pierwsze** zadanie z \`kodem\`
  - [ ] podpunkt A
  - notatka B
- [ ] Drugie [now::]
- [ ] Trzecie

Ręczna notatka pod listą.

## Backlog

- [x] Zrobione — 2026-05-19
- [ ] Powtórka
- [ ] Powtórka
`;
```

- [ ] **Krok 1: dopisać typy z „Wspólnego kontraktu” do `models.ts`** (łącznie z `board` w `ProjectWithContent`; `tsc` będzie na razie czerwony w `services`/`router` testach, bo `board` jest wymagane: dodać je w tasku 5).
- [ ] **Krok 2: napisać testy `readBoardText`** (`tasks-file.test.ts`, `// @vitest-environment node`):
  1. `SAMPLE` → `blockers: []`; `now: [{ text: "Drugie", done: false }]`; `next: [{ text: "**Pierwsze** zadanie z `kodem`", done: false }, { text: "Trzecie", done: false }]`; `icebox: [{ text: "Zrobione", done: true, doneDate: "2026-05-19" }, { text: "Powtórka", done: false }, { text: "Powtórka", done: false }]`. Podpunkt A i notatka B nie są zadaniami.
  2. `null` → cztery puste tablice.
  3. Tekst `"## Next\n\n- [x] Gotowe [now::] — 2026-11-01\n"` → `next: [{ text: "Gotowe", done: true, doneDate: "2026-11-01" }]`, `now: []` (znacznik przy ukończonym ignorowany).
  4. `"## Backlog\n\n- [ ] Coś — 2026-05-19\n"` → `icebox: [{ text: "Coś — 2026-05-19", done: false }]` (data przy nieukończonym zostaje w `text`).
  5. `"## Next\n\n* [ ] gwiazdka\n  - [ ] wcięte\n"` → `next: []`.
  6. `"## Blokery\n\n- [x] A\n- [X] B\n"` → `blockers: [{ text: "A", done: true }, { text: "B", done: true }]`.
  7. Sekcje spoza trzech (`## Notatki\n\n- [ ] x`) → ignorowane.
- [ ] **Krok 3: uruchomić** `npx vitest run tests/unit/contexts/bc_projects/tasks-file.test.ts`. Oczekiwane: FAIL (brak modułu).
- [ ] **Krok 4: zaimplementować** wspólny skaner (podział na linie, sekcje, bloki, parsowanie linii wg reguł powyżej), z którego korzystać będą też kolejne funkcje (nie pisać drugiego parsera). Wyeksportować `readBoardText`.
- [ ] **Krok 5: uruchomić testy.** Oczekiwane: PASS.
- [ ] **Krok 6: commit** `feat(bc_projects): skaner tasks.md dla tablicy zadań`.

---

## Task 2: Operacje w miejscu: `toggle`, `edit`, `remove`

**Pliki:** zmiana `tasks-file.ts`, `tasks-file.test.ts`.

**Interfejs (wspólny punkt wejścia dla tasków 2–3):**

```ts
export type TaskFileContext = { projectName: string; today: string }; // today: YYYY-MM-DD
export function applyTaskOp(text: string | null, op: TaskOp, ctx: TaskFileContext): string;
```

W tym tasku obsłużyć `toggle`, `edit`, `remove`; `add` i `move` rzucają na razie `Error("not implemented")` (task 3).

**Wyszukanie zadania:** przez skaner: `board[column][index]`. Brak zadania pod indeksem albo `task.text !== op.text` → `ConflictError("Zadanie zmieniło się w pliku")` (`@/lib/errors`).

**Reguły operacji:**

- `toggle`: nieukończone → ukończone: `- [x] <text> — <ctx.today>`, znacznik `[now::]` zdjęty. Ukończone → nieukończone: `- [ ] <text>` (bez daty, bez znacznika).
- `edit`: podmienia `text` na `op.newText`, zachowuje stan ukończenia, znacznik i datę ukończenia.
- `remove`: usuwa cały blok (linia zadania + wcięte linie); reszta pliku bez zmian.

- [ ] **Krok 1: testy** (na `SAMPLE`; „reszta pliku bez zmian” = po podmianie oczekiwanych linii w `SAMPLE` wynik jest identyczny):
  1. `toggle { column:"next", index:1, text:"Trzecie" }`, `today: "2026-11-13"` → linia `- [x] Trzecie — 2026-11-13`.
  2. `toggle { column:"icebox", index:0, text:"Zrobione" }` → linia `- [ ] Zrobione` (data zniknęła).
  3. `toggle { column:"now", index:0, text:"Drugie" }` → `- [x] Drugie — 2026-11-13`; `readBoardText(wynik).now` to `[]`, a `next[1]` to `{ text:"Drugie", done:true, doneDate:"2026-11-13" }`.
  4. `edit { column:"icebox", index:0, text:"Zrobione", newText:"Zrobione ponownie" }` → `- [x] Zrobione ponownie — 2026-05-19`.
  5. `edit { column:"now", index:0, text:"Drugie", newText:"Drugie v2" }` → `- [ ] Drugie v2 [now::]`.
  6. `edit { column:"icebox", index:2, text:"Powtórka", newText:"Powtórka 2" }` → zmienia **tylko ostatnią** z dwóch identycznych linii.
  7. `remove { column:"next", index:0, text:"**Pierwsze** zadanie z \`kodem\`" }`→ wynik nie zawiera`podpunkt A`, `notatka B`ani linii zadania;`Ręczna notatka pod listą.` zostaje.
  8. `remove { column:"icebox", index:1, text:"Powtórka" }` → usuwa tylko pierwszą z dwóch „Powtórka”.
  9. Niezgodność: `toggle { column:"next", index:1, text:"Nie to" }` → `ConflictError`; `index: 9` → `ConflictError`.
  10. Linia `[X]`: `"## Next\n\n- [X] Duże\n"` + `toggle` → `- [ ] Duże`.
- [ ] **Krok 2: uruchomić** testy. Oczekiwane: FAIL.
- [ ] **Krok 3: zaimplementować** `applyTaskOp` dla trzech operacji, z jednym wspólnym lokalizatorem bloku (indeksy linii początku i końca w `lines[]`).
- [ ] **Krok 4: uruchomić testy.** Oczekiwane: PASS.
- [ ] **Krok 5: commit** `feat(bc_projects): toggle, edit i remove zadań w tasks.md`.

---

## Task 3: Operacje wstawiające: `add` i `move`

**Pliki:** zmiana `tasks-file.ts`, `tasks-file.test.ts`.

**Reguły wstawiania (D10, D11):**

- Sekcja docelowa: `blockers` → `## Blokery`; `now` i `next` → `## Next`; `icebox` → `## Backlog`.
- Miejsce: bezpośrednio po ostatniej linii ostatniego bloku zadania w sekcji. Brak zadań w sekcji → najpierw usuń placeholdery (linie `^_?Brak\b`), potem: jeśli sekcja nie ma żadnej niepustej treści, wstaw `["", <zadanie>]` po nagłówku i zostaw jedną pustą linię przed następnym nagłówkiem (lub koniec pliku zakończony `\n`); jeśli ma inną treść (proza), wstaw `["", <zadanie>]` po ostatniej niepustej linii.
- Brak nagłówka: obetnij końcowe `\n` pliku i dopisz `"\n\n## <Nagłówek>\n\n<zadanie>\n"`.
- Brak pliku (`text === null`): wynik to `# Tasks — <projectName>\n` + dla każdej z sekcji Blokery, Next, Backlog po kolei `\n## <H>\n` i, tylko w sekcji docelowej, `\n<zadanie>\n`.
- `add` do `now`: linia `- [ ] <text> [now::]` w `## Next`; do pozostałych: `- [ ] <text>`.
- `move` (limit i „ukończone do Teraz” sprawdza `services`, tu bez walidacji):
  - `next → now`: dopisz ` [now::]` w miejscu (linia nie zmienia pozycji); `now → next`: zdejmij znacznik w miejscu.
  - Każdy inny ruch: usuń blok z miejsca i wstaw go (z wciętymi liniami, w tej samej kolejności) w sekcji docelowej wg reguł wyżej. Znacznik `[now::]` zdejmij, chyba że celem jest `now` (wtedy dodaj; cel `now` oznacza wstawienie do `## Next`).
  - `column === to` → `Error` (to jest sprawdzane w `services` jako 422; tu zabezpieczenie).

- [ ] **Krok 1: testy** (na `SAMPLE`, o ile nie napisano inaczej):
  1. `add { column:"next", text:"Czwarte" }` → nowa linia `- [ ] Czwarte` zaraz po `- [ ] Trzecie`, przed pustą linią i `Ręczna notatka pod listą.`.
  2. `add { column:"now", text:"Piąte" }` → `- [ ] Piąte [now::]` zaraz po `- [ ] Trzecie`.
  3. `add { column:"blockers", text:"X" }` → sekcja wygląda dokładnie `## Blokery\n\n- [ ] X\n\n## Next` (placeholder zniknął).
  4. `add { column:"icebox", text:"Z" }` → po ostatniej „Powtórka”.
  5. Brak sekcji: wejście `"# Tasks — Demo\n\n## Next\n\n- [ ] a\n"` + `add icebox "b"` → `"# Tasks — Demo\n\n## Next\n\n- [ ] a\n\n## Backlog\n\n- [ ] b\n"`.
  6. Brak pliku: `applyTaskOp(null, { op:"add", column:"next", text:"x" }, { projectName:"Demo", today })` → `"# Tasks — Demo\n\n## Blokery\n\n## Next\n\n- [ ] x\n\n## Backlog\n"`.
  7. Pusta sekcja: `"## Blokery\n\n## Next\n"` + `add blockers "x"` → `"## Blokery\n\n- [ ] x\n\n## Next\n"`; `"## Backlog\n"` + `add icebox "x"` → `"## Backlog\n\n- [ ] x\n"`.
  8. Sekcja z prozą: `"## Next\n\nNotatka.\n\n## Backlog\n"` + `add next "a"` → `"## Next\n\nNotatka.\n\n- [ ] a\n\n## Backlog\n"`.
  9. `move { column:"next", index:1, text:"Trzecie", to:"now" }` → `- [ ] Trzecie [now::]` na tej samej pozycji w pliku.
  10. `move { column:"now", index:0, text:"Drugie", to:"next" }` → `- [ ] Drugie`.
  11. `move { column:"next", index:0, text:"**Pierwsze** zadanie z \`kodem\`", to:"icebox" }`→ blok (3 linie) zniknął z`## Next`, a `## Backlog`kończy się liniami:`- [ ] Powtórka`, `- [ ] **Pierwsze** zadanie z \`kodem\``, ` - [ ] podpunkt A`, ` - notatka B`.
  12. `move { column:"icebox", index:1, text:"Powtórka", to:"blockers" }` → `## Blokery\n\n- [ ] Powtórka\n\n## Next` (placeholder zastąpiony), a w Backlog zostaje jedna „Powtórka”.
  13. `move { column:"now", index:0, text:"Drugie", to:"icebox" }` → w Backlog `- [ ] Drugie` bez znacznika.
  14. `move { column:"icebox", index:1, text:"Powtórka", to:"now" }` → linia `- [ ] Powtórka [now::]` na końcu `## Next` (po `Trzecie`), usunięta z Backlog.
  15. `move` z `to === column` → `Error`.
- [ ] **Krok 2: uruchomić** testy. Oczekiwane: FAIL.
- [ ] **Krok 3: zaimplementować** `add` i `move` (wspólny helper „wstaw linie do sekcji” z regułami powyżej).
- [ ] **Krok 4: uruchomić pełny `tasks-file.test.ts`.** Oczekiwane: PASS.
- [ ] **Krok 5: commit** `feat(bc_projects): add i move zadań w tasks.md`.

---

## Task 4: Repozytorium: `readProjectBoard` i `writeProjectTasks`

**Pliki:** zmiana `contexts/bc_projects/repositories/index.ts`; nowy `tests/unit/contexts/bc_projects/repositories.tasks.test.ts` (wzór: `repositories.test.ts`, `useTempVault` z `tests/unit/lib/nexus/repos/helpers`).

**Interfejs:**

```ts
export function readProjectBoard(entry: RegistryEntry): TasksBoard;
export function writeProjectTasks(
  entry: RegistryEntry,
  op: TaskOp,
  expected: VersionToken | null,
  ctx: { today: string }
): VersionToken;
```

**Reguły:**

- `readProjectBoard`: `readVaultFile(projectPath(entry.folder, "tasks.md"))`; brak pliku → puste kolumny, `version: null`; w innym razie `readBoardText(file.text)` + `file.version`.
- `writeProjectTasks`: `rel = projectPath(entry.folder, "tasks.md")`; `assertWritable(entry, rel)` (istniejąca funkcja; strażnik vaulta i `Projects/<id>/`); `readVaultFile(rel)`; jeśli wersja odczytanego pliku (lub `null` przy braku pliku) nie zgadza się z `expected` → `ConflictError`; `next = applyTaskOp(file?.text ?? null, op, { projectName: entry.name, today: ctx.today })`; `writeVaultFile(rel, next, { expected })`.
- Porównanie wersji: `size` i `hash` (lokalna funkcja w `index.ts`).

- [ ] **Krok 1: testy** (tymczasowy vault, wpis rejestru z `folder: "Projects/demo/"`, `name: "Demo"`):
  1. Brak pliku → `readProjectBoard` zwraca cztery puste kolumny i `version: null`.
  2. Plik `SAMPLE` (zapisany przez `vault.write("Projects/demo/tasks.md", SAMPLE)`) → `board.next[1].text === "Trzecie"`, `version` niepusta.
  3. `writeProjectTasks` z poprawną wersją, `toggle next 1 "Trzecie"` → plik na dysku zawiera `- [x] Trzecie — 2026-11-13`, zwrócona wersja różni się od poprzedniej, a pozostałe linie są bez zmian.
  4. Nieaktualna wersja (inny hash) → `ConflictError`, plik bez zmian.
  5. `add` do nieistniejącego pliku z `expected: null` → plik utworzony z `# Tasks — Demo`; `expected` niepusty przy braku pliku → `ConflictError`.
  6. `folder: "Projects/../x/"` i `folder: "Work/x/"` → te same błędy co w testach `writeProjectState` (`DomainError` 422 / `PathOutsideVaultError` / `WorkAreaBlockedError`): odtworzyć asercje z istniejących testów stanu.
  7. CRLF: plik zapisany z `\r\n` → po `writeProjectTasks` w pliku są same `\n`, treść poza zmienioną linią nietknięta.
- [ ] **Krok 2: uruchomić** `npx vitest run tests/unit/contexts/bc_projects/repositories.tasks.test.ts`. Oczekiwane: FAIL.
- [ ] **Krok 3: zaimplementować** obie funkcje w `repositories/index.ts` (importy z `./tasks-file`).
- [ ] **Krok 4: uruchomić** ten plik i `repositories.test.ts`. Oczekiwane: PASS.
- [ ] **Krok 5: commit** `feat(bc_projects): odczyt i zapis tasks.md z wersją pliku`.

---

## Task 5: Serwis: `getProject` z `board` i `applyTaskOp`

**Pliki:** zmiana `contexts/bc_projects/services.ts`, `tests/unit/contexts/bc_projects/services.test.ts`.

**Interfejs:**

```ts
// services.ts
export async function applyTaskOp(
  id: string,
  op: TaskOp,
  version: VersionToken | null,
  now: Date = new Date()
): Promise<ProjectWithContent>;
```

**Zmiana `getProject`:** dodaje `board: readProjectBoard(entry)` do zwracanego obiektu (ProjectWithContent).

**Algorytm `applyTaskOp`:**

1. `entry = findEntry(id)`; `board = readProjectBoard(entry)`.
2. Wersja: jeśli `board.version` i `version` nie są równe (oba `null` = równe; inaczej porównanie `size` + `hash`, lokalna funkcja w `services.ts`) → `ConflictError("Plik zadań zmienił się w międzyczasie")`.
3. Dla operacji z referencją (`toggle`, `edit`, `remove`, `move`): `task = board[op.column][op.index]`; brak lub `task.text !== op.text` → `ConflictError("Zadanie zmieniło się w pliku")`.
4. Limit „Teraz” (`DomainError`, 422, komunikat `Limit 3 zadań w kolumnie Teraz`): `add` z `column:"now"` albo `move` z `to:"now"`, gdy `board.now.length >= NOW_LIMIT`.
5. `move` ukończonego zadania do `now` → `DomainError("Ukończone zadanie nie może trafić do Teraz", 422)`.
6. `move` z `to === op.column` → `DomainError("Zadanie jest już w tej kolumnie", 422)`.
7. `writeProjectTasks(entry, op, version, { today: localDate(now) })` (istniejąca `localDate`).
8. `return getProject(id, now)`.

Błędy zgłaszać przed zapisem (żadnego zapisu przy błędzie).

- [ ] **Krok 1: zaktualizować istniejące mocki w `services.test.ts`:** dodać `mockReadProjectBoard`, `mockWriteProjectTasks` do `vi.hoisted` i do `vi.mock("@/contexts/bc_projects/repositories", …)`; w `beforeEach` `mockReadProjectBoard.mockReturnValue({ blockers: [], now: [], next: [], icebox: [], version: null })`. Dopisać asercję w istniejącym teście `getProject`: wynik zawiera `board`.
- [ ] **Krok 2: nowe testy `applyTaskOp`** (mock `readProjectBoard` zwraca zadany `board`, `findEntry` przez `mockReadRegistry` jak w istniejących testach):
  1. Poprawny `toggle`: `writeProjectTasks` wywołane z `(entry, op, version, { today: "2026-11-13" })` dla `now = new Date(2026, 10, 13)`; wynik pochodzi z `getProject`.
  2. Inna wersja niż `board.version` → `ConflictError`, `writeProjectTasks` nie wywołane.
  3. `board.next[0].text = "A"`, `op.text = "B"` → `ConflictError`; `index` poza zakresem → `ConflictError`.
  4. `board.now` ma 3 zadania: `add now` → `DomainError` 422 z kodem `statusCode === 422`; `move next→now` → 422; zapis nie wywołany.
  5. `board.now` ma 2 zadania: `add now` przechodzi.
  6. `move` ukończonego zadania (`done: true`) do `now` → 422.
  7. `move` z `to === column` → 422.
  8. `add` przy `version: null` i `board.version: null` → przechodzi; `version` niepusta przy `board.version: null` → `ConflictError`.
  9. Odhaczone zadanie z „Teraz” (`toggle` w `column:"now"`) nie jest blokowane limitem (3 zadania w `now`, `toggle` przechodzi).
- [ ] **Krok 3: uruchomić** `npx vitest run tests/unit/contexts/bc_projects/services.test.ts`. Oczekiwane: FAIL (nowe testy).
- [ ] **Krok 4: zaimplementować** zmianę `getProject` i `applyTaskOp`.
- [ ] **Krok 5: uruchomić** cały katalog `tests/unit/contexts/bc_projects/`. Oczekiwane: PASS (testy `router.test.ts` mogą wymagać `board` w `detailProject`: dodać `board: { blockers: [], now: [], next: [], icebox: [], version: null }`; to część tego kroku).
- [ ] **Krok 6: commit** `feat(bc_projects): reguły zadań projektu (limit Teraz, zgodność wersji i tekstu)`.

---

## Task 6: Schematy: wejście `TaskOpInputSchema` i DTO `board`

**Pliki:** zmiana `contexts/bc_projects/schemas.ts`, `tests/unit/contexts/bc_projects/schemas.test.ts`.

**Zmiany:**

- Wspólny `versionSchema` wydzielony z `StateInputSchema` (zachowanie bez zmian; istniejące testy muszą przechodzić) i wariant wymagający niepustego stringa: `requiredVersion = z.string().regex(VERSION_RE, "Zła wersja pliku").transform(...)` (ta sama transformacja do `{ size, hash }`).
- `TaskColumnSchema = z.enum(["blockers", "now", "next", "icebox"])`; test zgodności z `TASK_COLUMNS` w `models` (wzór istniejącego testu dla `PROJECT_TYPES`).
- `taskText` (nowe/edytowane): `oneLine(300)`, `min(1)`, bez podciągu `[now::]` i bez końcówki ` — YYYY-MM-DD` (`/\s—\s\d{4}-\d{2}-\d{2}$/`).
- `refText`: `z.string().trim().min(1).max(1000)`, jedna linia (bez dodatkowych reguł; istniejący tekst może kończyć się datą).
- `TaskOpInputSchema = z.discriminatedUnion("op", [...])`:
  - `add`: `{ op, column, text: taskText, version: nullable }`
  - `toggle` / `remove`: `{ op, column, index: int 0..999, text: refText, version: requiredVersion }`
  - `edit`: jak wyżej + `newText: taskText`
  - `move`: jak wyżej + `to: TaskColumnSchema`
- Typ `TaskOpInputDto = z.input<typeof TaskOpInputSchema>` (co wysyła UI).
- DTO: `BoardTaskDto = BoardTask`; `TasksBoardDto = { blockers; now; next; icebox: BoardTaskDto[]; version: string | null }`; `ProjectDetailDto` dostaje `board: TasksBoardDto`; `toDetailDto` mapuje `board` (wersja jako `"<size>:<hash>"` lub `null`); stare `tasks` zostaje.

- [ ] **Krok 1: testy w `schemas.test.ts`:**
  1. Poprawne wejścia: `add` z `version: null`; `toggle` z `version: "12:" + "a".repeat(64)` → `data.version` to `{ size: 12, hash: "aaaa…" }`.
  2. `toggle` z `version: null` → błąd (wymagana wersja).
  3. `add` z `text: "linia1\nlinia2"`, `text: "x [now::]"`, `text: "x — 2026-05-19"`, `text: "   "` → błąd każde.
  4. `edit` z `newText: "x — 2026-05-19"` → błąd; `refText` `"Coś — 2026-05-19"` w `toggle` → poprawny.
  5. `index: -1`, `index: 1.5` → błąd; `column: "inbox"` → błąd.
  6. `toDetailDto` z `board.version = { size: 3, hash: "h" }` → `board.version === "3:h"`; z `version: null` → `null`; `board` kolumny przepisane.
- [ ] **Krok 2: uruchomić** `npx vitest run tests/unit/contexts/bc_projects/schemas.test.ts`. Oczekiwane: FAIL.
- [ ] **Krok 3: zaimplementować** schematy i mapper; w istniejącym helperze testowym `ProjectWithContent` dodać `board`.
- [ ] **Krok 4: uruchomić** pliki `schemas.test.ts`, `router.test.ts`. Oczekiwane: PASS.
- [ ] **Krok 5: commit** `feat(bc_projects): schematy wejścia i DTO tablicy zadań`.

---

## Task 7: Router i trasa API

**Pliki:** zmiana `contexts/bc_projects/router.ts`, `tests/unit/contexts/bc_projects/router.test.ts`; nowy `app/api/projects/[id]/tasks/route.ts`.

**Interfejs:**

```ts
// router.ts
export async function postTasks(req: NextRequest, ctx: RouteContext): Promise<NextResponse>;
```

Wzór: `putProjectState`. Przebieg: `parseBody(req, TaskOpInputSchema)` → z `parsed.data` zbudować `TaskOp` (bez pola `version`) → `services.applyTaskOp(id, op, parsed.data.version ?? null)` → `NextResponse.json(toDetailDto(project))` (status 200). Błędy przez `handleServiceError`.

`route.ts`: jedna linia `export { postTasks as POST } from "@/contexts/bc_projects/router";`.

- [ ] **Krok 1: testy** (w `router.test.ts`, mock `services` rozszerzony o `applyTaskOp`):
  1. Poprawne `add` → 200, ciało zawiera `board`; `applyTaskOp` wywołane z `("a", { op:"add", column:"next", text:"x" }, null)`.
  2. Poprawne `move` z wersją → `applyTaskOp("a", { op:"move", column:"next", index:0, text:"x", to:"now" }, { size, hash })`.
  3. Zły kształt (`op:"zly"`, brak `column`, `toggle` bez wersji) → 400, serwis niewywołany.
  4. `applyTaskOp` rzuca `ConflictError` → 409; `DomainError(…, 422)` → 422; `NotFoundError` → 404.
- [ ] **Krok 2: uruchomić** `npx vitest run tests/unit/contexts/bc_projects/router.test.ts`. Oczekiwane: FAIL.
- [ ] **Krok 3: zaimplementować** `postTasks` i `route.ts`.
- [ ] **Krok 4: uruchomić** `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts`. Oczekiwane: PASS (test architektury bez zmian).
- [ ] **Krok 5: commit** `feat(bc_projects): POST /api/projects/[id]/tasks`.

---

## Task 8: UI: tablica w teczce

**Pliki:** zmiana `src/features/projects/mutation.ts`, `useProjects.ts`, `ProjectDossier.tsx`, `projects.css`; nowy `src/features/projects/ProjectTasksBoard.tsx`; zmiana `tests/unit/features/projects/ProjectsView.test.tsx`.

**Interfejsy:**

```ts
// mutation.ts: do ProjectActions
tasksOp: (input: TaskOpInputDto) => Promise<MutationResult>;
// useProjects.ts
const tasksOp = useCallback((input: TaskOpInputDto) => mutate("POST", "/tasks", input), [mutate]);
// ProjectTasksBoard.tsx
export function ProjectTasksBoard(props: {
  board: TasksBoardDto;
  onOp: (input: TaskOpInputDto) => Promise<MutationResult>;
  onReload: () => void;
}): React.JSX.Element;
```

`TaskOpInputDto` importowany z `@/contexts/bc_projects/schemas` (UI importuje z kontekstu tylko `schemas`). `useProjects` zwraca `tasksOp`; `ProjectsView` przekazuje je w `actions` (sprawdzić, jak składane są `actions`, i dodać pole).

**Zachowanie komponentu:**

- Cztery sekcje `<section aria-label="Kolumna Blokery">` itd., z nagłówkami „Blokery”, „Teraz”, „Następne”, „Icebox”; nagłówek „Teraz” pokazuje licznik `n/3`. Pusta kolumna: tekst „Brak”.
- Zadanie: `<li>` z checkboxem (nazwa dostępna przez tekst zadania, `checked={done}`), tekstem (ukończone z klasą przekreślenia i datą `doneDate`), przyciskami `Edytuj: <text>`, `Usuń: <text>` (dwuetapowo: pierwszy klik zmienia etykietę na `Potwierdź usunięcie: <text>`), listą `<select aria-label="Przenieś: <text>">` z opcją „Przenieś do…” (wartość pusta, wyłączona) i pozostałymi trzema kolumnami. Opcja „Teraz” wyłączona dla ukończonych zadań i gdy „Teraz” ma 3.
- Edycja inline: po „Edytuj” pole tekstowe (`aria-label="Edytuj zadanie"`) z przyciskami „Zapisz” i „Anuluj”; Enter zapisuje, Escape anuluje.
- Dodawanie: w każdej kolumnie `<form>` z polem `aria-label="Dodaj zadanie: <Nazwa kolumny>"` i przyciskiem „Dodaj”; w „Teraz” pole i przycisk wyłączone przy 3 zadaniach; po sukcesie pole się czyści; pusty tekst nie wysyła.
- Wszystkie żądania niosą `version: board.version` (dla `add` także `null`). Indeks to pozycja w tablicy kolumny w DTO, `text` to `task.text`.
- Jedna mutacja naraz: w trakcie żądania wszystkie kontrolki `disabled`.
- Błąd: `<p className="prj-alert" role="alert">` z komunikatem; przy `conflict: true` dodatkowo wywołaj `onReload()` i pokaż „Plik zadań zmienił się; odświeżono tablicę”.
- Sukces: nic nie dopisujemy lokalnie; dane przychodzą z odpowiedzi (D9 z 1-2) przez `useProjects`.
- `ProjectDossier` zastępuje blok `<h3>Zadania</h3>` + `project.tasks.map(…)` komponentem `<ProjectTasksBoard key={project.id} … />` w karcie „Zadania”. Pole `project.tasks` zostaje w DTO, ale nie jest już renderowane.
- CSS: nowe klasy `.prj-board` (siatka 4 kolumn, na wąskim ekranie 1 kolumna), `.prj-board__col`, `.prj-board__item`, `.prj-board__item--done`, wykorzystujące istniejące zmienne `--*` z `projects.css`; bez nowych kolorów poza istniejącymi tokenami.

- [ ] **Krok 1: zaktualizować istniejące testy `ProjectsView.test.tsx`:** helper `detail()` dostaje `board: { blockers: [], now: [], next: [], icebox: [], version: null }`; test, który sprawdzał listę `tasks` (ok. l. 312–318), przepisać na asercje o tablicy z `board`.
- [ ] **Krok 2: nowe testy** (`apiFetch` jak `makeApiFetch`, rozszerzony o `POST /api/projects/<id>/tasks`, który zwraca zadany `ProjectDetailDto` lub `Response` błędu; asercje na `apiFetch.mock.calls`):
  1. Render: `board` z zadaniami w czterech kolumnach pokazuje je pod właściwymi nagłówkami; nagłówek „Teraz” ma `1/3` dla jednego zadania.
  2. Odhaczenie: klik checkboxa zadania `Trzecie` (`next`, index 1) → `POST` z ciałem `{ op:"toggle", column:"next", index:1, text:"Trzecie", version:"<wersja>" }`; po odpowiedzi nowy stan z `board` jest widoczny.
  3. Dodawanie: wpis „Nowe” w polu „Dodaj zadanie: Następne” + „Dodaj” → `{ op:"add", column:"next", text:"Nowe", version:"<wersja>" }`; pole puste po sukcesie. Przy `board.version === null` ciało ma `version: null`.
  4. Teraz pełne (3 zadania): pole „Dodaj zadanie: Teraz” i przycisk wyłączone; opcja „Teraz” w selecie przenoszenia wyłączona.
  5. Edycja: „Edytuj: Trzecie” → wpisanie „Trzecie v2” → „Zapisz” → `{ op:"edit", column:"next", index:1, text:"Trzecie", newText:"Trzecie v2", version }`.
  6. Usuwanie: „Usuń: Trzecie” nie wysyła żądania, dopiero „Potwierdź usunięcie: Trzecie” → `{ op:"remove", … }`.
  7. Przenoszenie: wybór „Icebox” w „Przenieś: Trzecie” → `{ op:"move", column:"next", index:1, text:"Trzecie", to:"icebox", version }`.
  8. Konflikt: odpowiedź 409 `{ error: "Zadanie zmieniło się w pliku" }` → widoczny `role="alert"` oraz ponowne `GET /api/projects/<id>` (odświeżenie).
  9. W trakcie oczekującego żądania kontrolki są wyłączone (promise nierozwiązany, asercja `disabled`).
- [ ] **Krok 3: uruchomić** `npx vitest run tests/unit/features/projects`. Oczekiwane: FAIL.
- [ ] **Krok 4: zaimplementować** `tasksOp`, komponent, integrację w `ProjectDossier` i CSS.
- [ ] **Krok 5: uruchomić** `npx vitest run tests/unit/features/projects tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts`. Oczekiwane: PASS.
- [ ] **Krok 6: commit** `feat(projects): tablica zadań w teczce projektu`.

---

## Task 9: Weryfikacja końcowa i domknięcie

- [ ] **Krok 1:** `npx vitest run` (cały zestaw), `npx tsc --noEmit`, `npm run lint`, `npm run build`: zlecić `cursorowi` (prośba: „przeszło” lub lista `plik:linia + przyczyna`). Wszystko zielone.
- [ ] **Krok 2: review diffa:** `agy --role review` (`git diff main...HEAD`): reguły zapisu `tasks-file`, zgodność z regułami architektury, edge-case’y. Opinie zweryfikować w kodzie przed zmianą.
- [ ] **Krok 3: test ręczny w przeglądarce** (zrestartować `npm run dev`, port 3100, bo `.next` bywa nadpisany buildem): `/dashboard#projekty`, projekt `monolith`: odhaczyć zadanie, dodać do „Teraz” (do limitu 3 i próba czwartego), przenieść do Icebox, edytować, usunąć; po każdej operacji `git -C ../NEXUS diff -- Vault/Projects/monolith/tasks.md` pokazuje tylko zamierzone linie (bez szkód w prozie i nagłówkach). **Zmiany w vaulcie cofnąć** (`git -C ../NEXUS checkout -- Vault/Projects/monolith/tasks.md`) po sprawdzeniu; tylko za zgodą użytkownika.
- [ ] **Krok 4:** zaktualizować spec: `Status: wykonany (<data>)`; commit `docs(spec): etap 1-3 wykonany`.
- [ ] **Krok 5: PR** po zatwierdzeniu przez użytkownika (push i PR tylko na jego prośbę). Po zmergowaniu: w NEXUS `Vault/Projects/monolith/tasks.md` odhaczyć „Zmergować PR etapu 1-2” i „Etap 1-3” (osobny commit w NEXUS, bez pusha).

## Samoocena planu względem specu

| Wymaganie specu                       | Task          |
| ------------------------------------- | ------------- |
| D1 kolumny i mapowanie                | 1 (reguły), 3 |
| D2 limit 3, odhaczenie zwalnia slot   | 2, 5          |
| D3 blok zadania, podpunkty            | 1, 2, 3       |
| D4 własny edytor tekstowy             | 1–3           |
| D5 kanoniczny tekst i walidacja       | 1, 6          |
| D6 `column` + `index` + `text`        | 2, 5, 6       |
| D7 wersja pliku, brak ponawiania      | 4, 5, 6, 8    |
| D8 jedna trasa `POST`                 | 6, 7          |
| D9 data ukończenia z serwera          | 2, 5          |
| D10 placeholdery, brak sekcji/pliku   | 3             |
| D11 miejsce wstawienia                | 3             |
| D12 strażnik ścieżek                  | 4             |
| §5 testy (edytor, serwis, router, UI) | 1–8           |
| Poza zakresem (ticket, DnD, energia)  | nie ruszane   |
