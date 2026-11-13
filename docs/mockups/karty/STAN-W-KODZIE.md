# Makiety kart a obecny kod (ścieżki zaktualizowane 2026-11-13 po migracji do `contexts/`; statusy funkcji z 2026-11-11)

Przegląd gałęzi `main` (app/, src/, lib/, types/) oraz gałęzi `feat/tablica-plotno` (od 2026-11-11 scalona do main).
Źródło: agy (karty 1–4), cursor (karty 5–8), wyrywkowa weryfikacja Claude.
Legenda: **JEST** · **CZĘŚCIOWO** (co brakuje) · **BRAK**.

**Wygląd (2026-11-13):** karty Kokpit, Kalendarz, Zadania, Projekty, Notatki, Płótno i Arsenał mają wygląd z makiet
(osobny plik CSS z motywem `[data-card]`: `home.css`, `calendar.css`, `tasks.css`, `projects.css`, `notes.css`,
`board.css`, `resources.css`). Odmalowany jest tylko **wygląd istniejących funkcji**: statusy funkcji w tabelach
poniżej się nie zmieniły. Mapa i Kodeks zostają zaślepkami (makieta Kodeksu `09-kodeks.html` jest pełna, kod: część B specu Kodeksu).

## 1. Kokpit (`src/features/home/HomeView.tsx`)

| Funkcja                           | Stan          | Gdzie / uwagi                                                                                                                             |
| --------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Kafle z liczbami dnia             | CZĘŚCIOWO     | CockpitSections.tsx (następne spotkanie, kolejka, aktywne tematy, commity dziś z git (K7), inbox (K3), deep/quick w kafelku kolejki (K2)) |
| Kolejka zadań na dziś             | CZĘŚCIOWO     | HomeView.tsx (zadania z terminem dziś); brak energii Deep/Quick i projektów                                                               |
| Spotkania dnia                    | CZĘŚCIOWO     | HomeView.tsx (lista 48 h); brak osi czasu, linku do spotkania                                                                             |
| Sesja pracy                       | CZĘŚCIOWO     | src/components/sessions/activeSession.ts (timer); to nie Save State                                                                       |
| Punkty skupienia z Save State     | JEST          | CockpitSections.tsx (K1, 2026-11-13): następny krok, branch, bloker, ostatnio + pewność, Kopiuj kontekst, Wejdź                           |
| Brief i action items              | BRAK          |                                                                                                                                           |
| Szybki inbox                      | JEST          | bc_inbox, InboxPanel.tsx, Inbox/inbox.md, Alt+I (K3, 2026-11-13)                                                                          |
| Historia commitów (dzień po dniu) | JEST          | CommitHistory.tsx, GET /api/cockpit/commits (K8, 2026-11-13)                                                                              |
| Rytuał zamknięcia dnia / zaczep   | JEST          | ClosingAnchor.tsx, CloseDayDialog.tsx, Cockpit/closing.yaml (K6, 2026-11-13)                                                              |
| Przełącznik praca / życie         | POZA ZAKRESEM | decyzja 2026-11-11: etat nie na tym PC, praca i życie się nie mieszają                                                                    |
| Ctrl+K i Alt+1…9                  | JEST          | src/features/cards/ (pasek kart, skróty, paleta); gałąź feat/karty-szkielet; Alt+9 = Kodeks (zaślepka)                                    |

## 2. Kalendarz (`src/features/calendar/CalendarView.tsx`)

| Funkcja                            | Stan      | Gdzie / uwagi                                                 |
| ---------------------------------- | --------- | ------------------------------------------------------------- |
| Dodawanie wydarzenia               | JEST      | src/features/calendar/CalendarView.tsx, CalendarEventForm.tsx |
| Widok miesiąc / tydzień / agenda   | CZĘŚCIOWO | CalendarView.tsx; jest tylko siatka 24 h jednego dnia         |
| Tag projektu, etat vs projekty     | CZĘŚCIOWO | CalendarView.tsx; ogólne tagi i typ work/meeting              |
| Planer slotów Deep Work            | BRAK      |                                                               |
| Szczegóły z briefem i action items | BRAK      |                                                               |
| Mini-kalendarz miesiąca            | BRAK      |                                                               |

## 3. Zadania (`src/features/tasks/TasksSection.tsx`)

| Funkcja                              | Stan      | Gdzie / uwagi                                                               |
| ------------------------------------ | --------- | --------------------------------------------------------------------------- |
| Termin                               | JEST      | src/features/tasks/TaskCard.tsx, `contexts/bc_tasks/models.ts` (`due_date`) |
| Szablony zadań                       | JEST      | TaskTemplatesModal.tsx                                                      |
| Wspólna lista                        | CZĘŚCIOWO | TasksSection.tsx; globalna, bez powiązania z projektami                     |
| Priorytet                            | CZĘŚCIOWO | pole `priority` w `contexts/bc_tasks/models.ts`, brak kontrolki w UI        |
| Panel szczegółów                     | CZĘŚCIOWO | TaskDetailModal.tsx; modal, bez checklisty kroków                           |
| Energia Deep / Quick                 | BRAK      |                                                                             |
| Filtry projekt / energia / priorytet | BRAK      | jest tylko wyszukiwanie tekstu (useTasksBoard.ts)                           |
| Grupy Teraz / Następne / Icebox      | BRAK      | są kolumny todo / in_progress / to_review / done                            |
| Szybkie dodawanie ze składnią        | BRAK      |                                                                             |

## 4. Projekty (`src/features/projects/`, `contexts/bc_projects/`)

Etap **1-1 (odczyt)** zrobiony: Alt+4 / `#projekty` otwiera kartę; rejestr z vaulta (`GET /api/projects`),
teczka (`GET /api/projects/[id]`), freshness/stale (>14 dni), metryczka (linki, `localPath`),
„Gdzie skończyłem”, zadania z `tasks.md`, bugi z `bugs.md` (aktywne + licznik zamkniętych).
Etap **1-2 (zapis)** zrobiony: Save State (`state.md`, formularz, kontrola wersji pliku i komunikat o konflikcie 409),
dziennik decyzji (`devlog.md`, tylko dopisywanie na górze), `type` projektu (zmiana jednej linii w `index.md`),
`PUT /api/projects/[id]/state`, `POST …/devlog`, `PATCH /api/projects/[id]`; świeżość liczona z nowszej z dat
`last_worked` i `state.updated`. Bez `state.md` karta pokazuje dotychczasowy akapit „Gdzie skończyłem”.

| Funkcja                                  | Stan      | Gdzie / uwagi                                                   |
| ---------------------------------------- | --------- | --------------------------------------------------------------- |
| Rejestr i teczka (odczyt)                | JEST      | ProjectsView, ProjectList, ProjectDossier; bc_projects          |
| Wykrywanie porzuconych (freshness stale) | JEST      | services.ts + odznaka `prj-item--stale`                         |
| Kafle statystyk                          | BRAK      | względem makiety `04-projekty.html`                             |
| Owner                                    | BRAK      | względem makiety                                                |
| Kamień milowy                            | CZĘŚCIOWO | nazwa i termin w `state.md`, bez paska procentowego (świadomie) |
| Save State (odczyt i zapis)              | JEST      | ProjectSaveState; `state.md` przez bc_projects                  |
| Devlog (dopisywanie)                     | JEST      | ProjectDevlog; `devlog.md`, bez edycji i usuwania               |
| Typ projektu                             | JEST      | select w metryczce; linia `type:` w `index.md`                  |
| Teraz/Następne/Icebox (edycja)           | BRAK      | podetap 1-3                                                     |
| Paczka kontekstu, etykieta „Firma”       | BRAK      | późniejsze podetapy                                             |

## 5. Notatki (`src/features/notes/`, `src/components/note-editor/NoteEditor.tsx`)

| Funkcja                                      | Stan      | Gdzie / uwagi                                      |
| -------------------------------------------- | --------- | -------------------------------------------------- |
| Edytor notatki                               | JEST      | NoteEditor.tsx                                     |
| Lista notatek                                | CZĘŚCIOWO | NotesPanel.tsx; płaska, bez folderów               |
| Podgląd                                      | CZĘŚCIOWO | NotesPanel.tsx; HTML (prose), nie Markdown         |
| Tagi notatek                                 | BRAK      | rekord notatki nie ma tagów (mają je tylko zasoby) |
| [[wiki]], backlinks, frontmatter, zakreślacz | BRAK      |                                                    |
| Wyszukiwarka notatek                         | BRAK      | pole w AppHeader.tsx bez logiki                    |
| Wyszukiwarka decyzji (devlogi)               | BRAK      |                                                    |

## 6. Płótno

| Funkcja                                  | Stan                                                            | Gdzie / uwagi                                       |
| ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Mapy myśli (drzewo)                      | JEST (main)                                                     | src/features/mind-maps/MindMapEditor.tsx            |
| Lista map                                | JEST (main)                                                     | MindMapList.tsx                                     |
| Zoom                                     | JEST (main)                                                     | MindMapEditorToolbar.tsx                            |
| Eksport                                  | JEST (main)                                                     | MindMapEditor.tsx (HTML)                            |
| Panel właściwości węzła                  | CZĘŚCIOWO                                                       | MindMapNotesPanel.tsx (notatka węzła)               |
| Tablica (xyflow) z minimapą i zoomem     | JEST (zapis w vaulcie: `Board/board.json`, `contexts/bc_board`) | src/features/board/BoardCanvas.tsx                  |
| Kafelki, ramki, strzałki, pasek narzędzi | CZĘŚCIOWO                                                       | boardActions.ts, BoardCanvas.tsx (addTile/addFrame) |
| Wiele tablic, pełny pasek narzędzi       | BRAK                                                            | BoardList.tsx to lista kafelków, nie tablic         |

## 7. Arsenał

| Funkcja                                 | Stan | Gdzie / uwagi                                               |
| --------------------------------------- | ---- | ----------------------------------------------------------- |
| Zasoby (URL, opis, tagi, filtr, kopiuj) | JEST | src/features/resources/ResourceSection.tsx, useResources.ts |
| Katalog skilli i promptów               | BRAK |                                                             |
| Kursy z postępem i action items         | BRAK |                                                             |
| Baza rozwiązań bugów                    | BRAK |                                                             |

## 8. Mapa

Wszystko **BRAK**: graf projektów, radar blokad, agenci z Herdr, sieć NEXUS. Czat agenta w aplikacji
usunięto (aplikacja nie woła modeli po API).

## 9. Kodeks

Wszystko **BRAK** poza zaślepką w szkielecie kart (`src/features/cards/`, `Alt+9`). Czytnik kodeksu
(`Vault/Knowledge/kodeks.md`) i checklisty to część B specu `2026-11-12-karta-kodeks-design.md`,
zależna od warstwy `lib/nexus/` (etap 0c).

## Wnioski do planu wdrożenia

- **Przeniesione do `src/features/*`** (PR 3–9 migracji kontekstów): kalendarz, zadania, notatki, zasoby, tablica, mapy myśli; zostaje do zrobienia wyłącznie to, co w tabelach ma status BRAK/CZĘŚCIOWO.
- **Całkiem nowe:** Projekty i Mapa, oraz wszystko oparte o vault (Save State, devlog, [[wiki]], backlinks,
  paczka kontekstu, sieć NEXUS). Zależą od warstwy `lib/nexus/` z etapu 0.
- **Szkielet:** pasek kart, Alt+1…9 i Ctrl+K istnieją (`src/features/cards/`).
