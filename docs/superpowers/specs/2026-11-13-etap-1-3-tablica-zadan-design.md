# Etap 1-3: tablica zadań projektu (zapis `tasks.md`) — projekt

Data: 2026-11-13
Status: wykonany (2026-11-13)
Nadrzędne: `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1 tablica zadań, §7 etap 1), `2026-11-13-etap-1-2-save-state-devlog-design.md` (wzorzec zapisu z wersją pliku, D6/D8/D9/D10), `2026-11-12-struktura-kontekstow-design.md` (siatka kontekstu, reguły importów)

## 1. Cel i zakres

Podetap 1-3 zamienia sekcję zadań w teczce projektu (dziś tylko odczyt) w **tablicę z pełną edycją**: cztery kolumny (Blokery / Teraz / Następne / Icebox), odhaczanie, dodawanie, edycja tekstu, usuwanie i przenoszenie między kolumnami. Zapis idzie do `Projects/<id>/tasks.md`.

**W zakresie:**

- Widok kolumn nad istniejącym formatem pliku (`## Blokery`, `## Next`, `## Backlog`), **bez migracji** siedmiu plików w vaulcie.
- Operacje: `add`, `toggle`, `edit`, `remove`, `move`; jedna trasa API.
- Limit 3 zadań w „Teraz”.
- Odczyt: `GET /api/projects/[id]` zwraca także `board`.

**Poza zakresem:** pole ticketu/ID (`owner: work`, 1-5), energia Deep/Quick, sortowanie w obrębie kolumny (etap 2; przeciąganie zmienia tylko kolumnę), procent kamienia liczony z zadań, migracja globalnego `Tasks/tasks.md` (PR 4, `bc_tasks`), paczka kontekstu (1-4), edycja nagłówków i sekcji spoza trzech znanych.

**Warunek wstępny:** 1-2 zmergowane (PR #24).

## 2. Decyzje

| #   | Temat                    | Decyzja                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Kolumny a plik           | Kolumny to widok. Blokery = `## Blokery`; Teraz = zadania z `## Next` ze znacznikiem ` [now::]` na końcu linii; Następne = pozostałe z `## Next`; Icebox = `## Backlog`. Nazwy sekcji w pliku się nie zmieniają.                                                                                                                                       |
| D2  | Limit „Teraz”            | Maks. 3 **nieukończone** zadania z `[now::]` (422 przy czwartym). Zadanie ukończone nie ma znacznika: `toggle` na ukończone zdejmuje `[now::]`, więc nie blokuje slotu. Odznaczenie ukończonego zwraca je do „Następne”, nie do „Teraz”.                                                                                                               |
| D3  | Co jest zadaniem         | Zadanie tablicy = linia `- [ ] ` / `- [x] ` (także `[X]`) **bez wcięcia**. Wcięte linie po niej (podpunkty, notatki) należą do jej bloku: `move` i `remove` biorą cały blok, `edit` i `toggle` zmieniają tylko pierwszą linię. Istniejące `parseChecklist` (płaskie, dla starego pola `tasks`) zostaje bez zmian.                                      |
| D4  | Edycja tekstowa          | Zapis zmienia tylko linie wskazanych bloków; reszta pliku (nagłówki, linki wiki, akapity, notatki, sekcje spoza trzech) pozostaje bajt w bajt. Nie używamy `lib/nexus/task-line.ts` ani `markdown-edit.ts` (format z `[id::]`/`[status::]`, edycja po id, przeformatowanie linii): osobny edytor w `contexts/bc_projects/repositories/tasks-file.ts`.  |
| D5  | Kanoniczny tekst zadania | `text` = treść po zdjęciu końcowego ` [now::]` i końcowego ` — YYYY-MM-DD` (data ukończenia). Format linii: `- [x] <text> — YYYY-MM-DD`, `- [ ] <text> [now::]`. Walidacja wejścia (`add`, `edit`): jedna linia, niepusty, bez `[now::]` i bez końcówki ` — YYYY-MM-DD`. Odznaczenie usuwa datę.                                                       |
| D6  | Identyfikacja zadania    | Klient wysyła `column` + `index` (pozycja w **kolumnie**, liczona w kolejności pliku) + `text` (kanoniczny) + `version`. Serwer sprawdza wersję pliku i zgodność `text` z zadaniem pod indeksem; niezgodność → `ConflictError` (409). Duplikaty tekstu rozróżnia indeks.                                                                               |
| D7  | Wersja pliku             | Każda operacja wymaga `version` (token z `readVaultFile`), `null` tylko gdy plik nie istnieje (pierwszy `add` tworzy plik). Zapis przez `writeVaultFile(rel, text, { expected })`, **bez ponawiania** (operacje po indeksie nie są lokalne). DTO ma jedną wersję: `board.version`. UI blokuje równoległe mutacje i po 409 odświeża szczegóły projektu. |
| D8  | Jedna trasa              | `POST /api/projects/[id]/tasks`, ciało `z.discriminatedUnion("op", …)`. Odpowiedź: pełny `ProjectDetailDto` (D9 z 1-2). Handler w `router.ts`, `route.ts` tylko re-eksport.                                                                                                                                                                            |
| D9  | Data ukończenia          | Ustawia serwer (czas lokalny, `YYYY-MM-DD`) przy `toggle` na ukończone; klient jej nie wysyła (jak `updated` w D8 z 1-2).                                                                                                                                                                                                                              |
| D10 | Placeholdery i braki     | Sekcja, w której jedyną treścią jest linia `Brak…` / `_Brak…_` (regex `^_?Brak\b`), traci ją przy pierwszym `add`/`move` do tej sekcji. Brakującą sekcję `add`/`move` dopisuje na końcu pliku. Brak pliku: `add` tworzy `# Tasks — <nazwa>` z trzema sekcjami.                                                                                         |
| D11 | Miejsce wstawienia       | Nowy lub przeniesiony blok ląduje na końcu listy zadań sekcji (po ostatnim bloku zadania, przed pustymi liniami poprzedzającymi kolejny nagłówek). Do „Teraz” wchodzi na końcu `## Next` ze znacznikiem.                                                                                                                                               |
| D12 | Ścieżki                  | Jak w 1-2 (D10): ścieżka z `folder` rejestru, `assertWritable`, strażnik `Work/`; zapis tylko w `Projects/<id>/`.                                                                                                                                                                                                                                      |

## 3. Operacje

| `op`     | Wejście                              | Skutek                                                                                                                                                                                                      |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`    | `column`, `text`                     | Nowe `- [ ] <text>` w sekcji kolumny (`now` → `## Next` + znacznik, limit D2).                                                                                                                              |
| `toggle` | `column`, `index`, `text`            | `[ ]` ↔ `[x]`; na ukończone: dopisuje ` — <data>` i zdejmuje `[now::]`; na nieukończone: usuwa datę (zadanie z „Teraz” trafia do „Następne”).                                                               |
| `edit`   | `column`, `index`, `text`, `newText` | Podmienia tekst, zachowuje stan, znacznik i datę.                                                                                                                                                           |
| `remove` | `column`, `index`, `text`            | Usuwa blok zadania.                                                                                                                                                                                         |
| `move`   | `column`, `index`, `text`, `to`      | `next` ↔ `now` zmienia tylko znacznik w miejscu; ruch do/z `blockers` i `icebox` przenosi blok do sekcji docelowej (znacznik zdejmowany). Ukończonego zadania nie można przenieść do `now` (422), limit D2. |

Błędy: zła wersja lub niezgodny `text`/`index` → 409; czwarte „Teraz”, ukończone do „Teraz”, nieprawidłowy `text` → 422 (`DomainError`); zapis poza `Projects/<id>/` → istniejące błędy strażnika.

## 4. Kontekst `contexts/bc_projects/`

| Plik                           | Zmiana                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`                    | `TaskColumn = "blockers" \| "now" \| "next" \| "icebox"`, `BoardTask { text, done, doneDate? }`, `TasksBoard { blockers, now, next, icebox, version }`.                                             |
| `repositories/tasks-file.ts`   | Czyste funkcje na tekście: skaner bloków (sekcja, kolumna, numery linii), `addTask`, `toggleTask`, `editTask`, `removeTask`, `moveTask`, `readBoard`. Nie importuje nic spoza `lib/nexus` i modeli. |
| `repositories/index.ts`        | `readProjectBoard(entry)` (odczyt + wersja) i `mutateProjectTasks(entry, mutate, expected)` (`assertWritable` + `writeVaultFile`), wzór `writeProjectState`.                                        |
| `services.ts`                  | Reguły: limit D2, zgodność `text` (D6), data ukończenia (D9), przejścia kolumn; mapowanie błędów na `DomainError`/`ConflictError`.                                                                  |
| `schemas.ts`                   | `taskOpSchema` (discriminated union), `BoardTaskDto`, `TasksBoardDto`; `ProjectDetailDto` dostaje `board`; stare `tasks: ChecklistSectionDto[]` zostaje.                                            |
| `router.ts`, `app/api/…/tasks` | `postTasks`; `route.ts` tylko re-eksport.                                                                                                                                                           |

UI (`src/features/projects/`): `ProjectTasksBoard.tsx` zastępuje listę sekcji w `ProjectDossier.tsx`: cztery kolumny, odhaczanie, edycja inline, usuwanie, pole „Dodaj”, przenoszenie między kolumnami przeciąganiem uchwytu zadania na kolumnę (natywny HTML5 DnD jak w zakładce Zadania, na życzenie użytkownika 2026-11-13; bez menu „Przenieś do…”), z lokalną kontrolą reguł limitu i ukończonych (ten sam komunikat co 422). Importuje z kontekstu tylko `schemas`; mutacje przez `mutation.ts` (jedna naraz, po 409 odświeżenie). Test architektury (`tests/unit/architecture.static.test.ts`) nie wymaga zmian.

## 5. Testy (TDD)

Dane testowe: teksty odwzorowujące prawdziwe pliki (`../NEXUS/Vault/Projects/*/tasks.md`).

- **`tasks-file` (jednostkowe):** każda operacja zachowuje resztę pliku bajt w bajt; plik z nagłówkiem i linkami wiki przed pierwszą sekcją; placeholdery `Brak blokerów.` i `_Brak aktywnych blokerów_` (D10); linie `- [x] … — 2026-05-19` (odznaczenie usuwa datę, `edit` ją zachowuje); `[X]` wielką literą; pogrubienia i backticki w tekście; zagnieżdżony podpunkt przenosi się z blokiem (D3); duplikaty tekstu rozróżnione indeksem; brakująca sekcja; CRLF na wejściu; `index` w kolumnie `next` pomija zadania z `[now::]`.
- **Serwis:** czwarte „Teraz” → 422; ukończone do „Teraz” → 422; `toggle` ukończonego zdejmuje `[now::]` i zwalnia slot; niezgodny `text` → 409; zła wersja → 409; `add` przy `version: null` tworzy plik.
- **Router:** 409/422 mapowane przez `handleServiceError`; odpowiedź to pełny `ProjectDetailDto` z `board`.
- **Schemas:** nieprawidłowy `text` (wiele linii, `[now::]`, końcowa data) odrzucony; istniejące testy `tasks` bez zmian, `toDetailDto` mapuje `board`.
- **UI:** render czterech kolumn, blokada równoległych mutacji, odświeżenie po 409.
- **Ręczny przegląd:** po wdrożeniu odhaczyć i przenieść zadanie w przeglądarce (restart `npm run dev`, `/dashboard#projekty`).

## 6. Ryzyka

- **Ręczna edycja w Obsidianie w trakcie sesji:** wykrywa ją wersja pliku (409); dodatkowa kontrola `text` chroni przed przesunięciem indeksu.
- **Stary parser a nowy:** dwa sposoby odczytu zadań (`parseChecklist` płaski, skaner tablicy tylko z zadaniami bez wcięcia). Zgodność wsteczna jest celowa; sprzątanie przy migracji `bc_tasks`.
- **Sekcje spoza trzech:** nie pojawiają się w tablicy i nie są zmieniane; zostają widoczne w starym polu `tasks`.
