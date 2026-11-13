# Makiety kart a obecny kod (stan 2026-11-11)

Przegląd gałęzi `main` (app/, src/, lib/, types/) oraz gałęzi `feat/tablica-plotno` (od 2026-11-11 scalona do main).
Źródło: agy (karty 1–4), cursor (karty 5–8), wyrywkowa weryfikacja Claude.
Legenda: **JEST** · **CZĘŚCIOWO** (co brakuje) · **BRAK**.

## 1. Kokpit (`src/features/home/HomeView.tsx`)

| Funkcja                         | Stan          | Gdzie / uwagi                                                                                          |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| Kafle z liczbami dnia           | CZĘŚCIOWO     | HomeView.tsx:257 (zadania dziś, nadchodzące); brak inbox, aktywnych tematów, commitów                  |
| Kolejka zadań na dziś           | CZĘŚCIOWO     | HomeView.tsx:183 (zadania z terminem dziś); brak energii Deep/Quick i projektów                        |
| Spotkania dnia                  | CZĘŚCIOWO     | HomeView.tsx:186 (lista 48 h); brak osi czasu, linku do spotkania                                      |
| Sesja pracy                     | CZĘŚCIOWO     | src/lib/activeSession.ts (timer); to nie Save State                                                    |
| Punkty skupienia z Save State   | BRAK          |                                                                                                        |
| Brief i action items            | BRAK          |                                                                                                        |
| Szybki inbox                    | BRAK          |                                                                                                        |
| Rytuał zamknięcia dnia / zaczep | BRAK          |                                                                                                        |
| Przełącznik praca / życie       | POZA ZAKRESEM | decyzja 2026-11-11: etat nie na tym PC, praca i życie się nie mieszają                                 |
| Ctrl+K i Alt+1…9                | JEST          | src/features/cards/ (pasek kart, skróty, paleta); gałąź feat/karty-szkielet; Alt+9 = Kodeks (zaślepka) |

## 2. Kalendarz (`src/components/CalendarView.tsx`)

| Funkcja                            | Stan      | Gdzie / uwagi                                             |
| ---------------------------------- | --------- | --------------------------------------------------------- |
| Dodawanie wydarzenia               | JEST      | CalendarView.tsx:228, CalendarEventForm.tsx               |
| Widok miesiąc / tydzień / agenda   | CZĘŚCIOWO | CalendarView.tsx:260; jest tylko siatka 24 h jednego dnia |
| Tag projektu, etat vs projekty     | CZĘŚCIOWO | CalendarView.tsx:86; ogólne tagi i typ work/meeting       |
| Planer slotów Deep Work            | BRAK      |                                                           |
| Szczegóły z briefem i action items | BRAK      |                                                           |
| Mini-kalendarz miesiąca            | BRAK      |                                                           |

## 3. Zadania (`src/components/TasksSection.tsx`, `src/components/tasks/`)

| Funkcja                              | Stan      | Gdzie / uwagi                                               |
| ------------------------------------ | --------- | ----------------------------------------------------------- |
| Termin                               | JEST      | tasks/TaskCard.tsx:40, types/records.ts:69                  |
| Szablony zadań                       | JEST      | TaskTemplatesModal.tsx                                      |
| Wspólna lista                        | CZĘŚCIOWO | TasksSection.tsx:107; globalna, bez powiązania z projektami |
| Priorytet                            | CZĘŚCIOWO | pole w types/records.ts:70, brak kontrolki w UI             |
| Panel szczegółów                     | CZĘŚCIOWO | TaskDetailModal.tsx; modal, bez checklisty kroków           |
| Energia Deep / Quick                 | BRAK      |                                                             |
| Filtry projekt / energia / priorytet | BRAK      | jest tylko wyszukiwanie tekstu (useTasksBoard.ts:16)        |
| Grupy Teraz / Następne / Icebox      | BRAK      | są kolumny todo / in_progress / to_review / done            |
| Szybkie dodawanie ze składnią        | BRAK      |                                                             |

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

## 5. Notatki (`src/features/notes/`, `src/components/NoteEditor.tsx`)

| Funkcja                                      | Stan      | Gdzie / uwagi                                      |
| -------------------------------------------- | --------- | -------------------------------------------------- |
| Edytor notatki                               | JEST      | NoteEditor.tsx:16                                  |
| Lista notatek                                | CZĘŚCIOWO | NotesPanel.tsx:46; płaska, bez folderów            |
| Podgląd                                      | CZĘŚCIOWO | NotesPanel.tsx:160; HTML (prose), nie Markdown     |
| Tagi notatek                                 | BRAK      | rekord notatki nie ma tagów (mają je tylko zasoby) |
| [[wiki]], backlinks, frontmatter, zakreślacz | BRAK      |                                                    |
| Wyszukiwarka notatek                         | BRAK      | pole w AppHeader.tsx:45 bez logiki                 |
| Wyszukiwarka decyzji (devlogi)               | BRAK      |                                                    |

## 6. Płótno

| Funkcja                                  | Stan                                                         | Gdzie / uwagi                                              |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Mapy myśli (drzewo)                      | JEST (main)                                                  | src/features/mind-maps/MindMapEditor.tsx                   |
| Lista map                                | JEST (main)                                                  | MindMapList.tsx:28                                         |
| Zoom                                     | JEST (main)                                                  | MindMapEditorToolbar.tsx:11                                |
| Eksport                                  | JEST (main)                                                  | MindMapEditor.tsx:522 (HTML)                               |
| Panel właściwości węzła                  | CZĘŚCIOWO                                                    | MindMapNotesPanel.tsx:20 (notatka węzła)                   |
| Tablica (xyflow) z minimapą i zoomem     | JEST (scalone do main 2026-11-11, zapis jeszcze w Firestore) | src/features/board/BoardCanvas.tsx:300, :344               |
| Kafelki, ramki, strzałki, pasek narzędzi | CZĘŚCIOWO                                                    | boardActions.ts:54, BoardCanvas.tsx:284 (addTile/addFrame) |
| Wiele tablic, pełny pasek narzędzi       | BRAK                                                         | BoardList.tsx to lista kafelków, nie tablic                |

## 7. Arsenał

| Funkcja                                 | Stan | Gdzie / uwagi                                       |
| --------------------------------------- | ---- | --------------------------------------------------- |
| Zasoby (URL, opis, tagi, filtr, kopiuj) | JEST | src/components/ResourceSection.tsx, useResources.ts |
| Katalog skilli i promptów               | BRAK |                                                     |
| Kursy z postępem i action items         | BRAK |                                                     |
| Baza rozwiązań bugów                    | BRAK |                                                     |

## 8. Mapa

Wszystko **BRAK**: graf projektów, radar blokad, agenci z Herdr, sieć NEXUS. Jest czat agenta
(PlanowanieView.tsx:260, AgentPendingActions.tsx:18), ale to nie panel Herdr.

## 9. Kodeks

Wszystko **BRAK** poza zaślepką w szkielecie kart (`src/features/cards/`, `Alt+9`). Czytnik kodeksu
(`Vault/Knowledge/kodeks.md`) i checklisty to część B specu `2026-11-12-karta-kodeks-design.md`,
zależna od warstwy `lib/nexus/` (etap 0c).

## Wnioski do planu wdrożenia

- **Do przeniesienia na karty:** HomeView (kafle, zapytania) → Kokpit; CalendarView + calendarUtils (CRUD,
  przeliczanie czasu) → Kalendarz; TasksSection + useTasksBoard (stan, drag-and-drop, szablony) → Zadania;
  NoteEditor → Notatki; MindMapEditor + `src/features/board/` → Płótno; ResourceSection → Arsenał / Zasoby.
- **Całkiem nowe:** Projekty i Mapa, oraz wszystko oparte o vault (Save State, devlog, [[wiki]], backlinks,
  paczka kontekstu, sieć NEXUS). Zależą od warstwy `lib/nexus/` z etapu 0.
- **Szkielet:** pasek kart, Alt+1…8 i Ctrl+K nie istnieją; to pierwszy krok wdrożenia kart.
