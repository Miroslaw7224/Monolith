# Zadania ogólne: pole `project` i kolor rodzaju projektu

Data: 2026-11-15. Wynik rozmowy z użytkownikiem przy pracy nad małym backlogiem (zastępuje wpis „Pole `owner` dla zadań ogólnych”).

## 1. Cel

Zadanie ogólne (`Tasks/tasks.md`) ma móc wskazać projekt z rejestru. Zadanie z projektu dostaje kolor i znacznik rodzaju tego projektu (etat zielony, własny niebieski, biblioteka fioletowy), tak samo jak w karcie Projekty. Zadanie bez projektu zostaje w kolorze domyślnym (jak dziś). Kokpit czyta to samo pole z zadań.

## 2. Decyzje

| ID  | Decyzja                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Nowe opcjonalne pole linii `[project:: <id>]` (id projektu z `Projects/_registry.yaml`). Brak pola = zadanie bez projektu. Zamiast osobnego `owner` (wybór użytkownika): rodzaj i ochrona wynikają z projektu.                                                             |
| P2  | Zapis przyjmuje tylko tekst w formie id (małe litery, cyfry, `-`, `_`; do 64 znaków); pusty tekst i `null` czyszczą pole. Aplikacja **nie** sprawdza, czy projekt istnieje: nieznane id (np. projekt usunięty) po prostu nie daje koloru.                                  |
| P3  | Zadanie wybiera projekt w oknie szczegółów zadania (lista projektów z rejestru, opcja „Bez projektu”). Karta zadania dostaje pasek koloru i znacznik rodzaju tylko gdy projekt jest znany.                                                                                 |
| P4  | Kokpit: pozycja kolejki z zadania ogólnego z `project` zostaje w grupie „Ogólne” (grupowanie bez zmian), ale dostaje kolor i znacznik rodzaju projektu, a przy `companyData` znacznik „Dane z firmy”. To zmienia D8 z specu rodzajów (tam zadania ogólne były bez koloru). |
| P5  | Wydarzenia kalendarza zostają przy własnych kolorach (`color`); wydarzenia nie mają pola `project` i go nie dostają (decyzja użytkownika).                                                                                                                                 |
| P6  | Kolor rodzaju liczy się jak dotąd z `ProjectSummaryDto.kind` (po stronie UI Zadań: lista `/api/projects`) i z `projectKind` / `hasCompanyData` z `bc_projects/services` (po stronie Kokpitu). `bc_tasks` nie woła innych kontekstów.                                       |

## 3. Zakres zmian

- `lib/nexus/task-line.ts`: pole `project: string | null` w `TaskLine`, parser i format (`project` po `priority`); bez tego edycja linii kasowałaby pole.
- `contexts/bc_tasks`: `Task.project`, schematy create/update i `TaskDto`, serwis, repozytorium (walidacja z P2 w `services`).
- `src/features/tasks`: wybór projektu w `TaskDetailModal`, pasek i znacznik na `TaskCard` (`useTasksBoard` pobiera listę projektów).
- `contexts/bc_cockpit`: `QueueItem.projectKind` i `companyData` dla zadań ogólnych z `project`; DTO; `CockpitSections.tsx` koloruje pozycję.
- `docs/nexus-vault-formaty-yaml.md`: pole `project` w linii zadania.

## 4. Poza zakresem

- Zmiana grupowania kolejki Kokpitu (zadania z projektem nadal w „Ogólne”).
- Pole `owner` na zadaniu (zastąpione przez `project`).
- Blokady `work` na podstawie projektu zadania (nadal brak funkcji eksportu i AI, które z nich korzystają).
- Kolor wydarzeń kalendarza.

## 5. Testy

- `tests/unit/lib/nexus/task-line.test.ts`: parse i format `project`, round-trip, pole bez wartości, ucieczki.
- `tests/unit/lib/nexus/markdown-edit.test.ts`: edycja linii z `project` zachowuje pole.
- Testy kontekstu zadań: tworzenie i aktualizacja z `project`, czyszczenie, odrzucenie złego id (400).
- Testy UI zadań: okno zadania zapisuje wybór projektu; karta z znanym projektem ma klasę `zad-card--kind-<kind>` i znacznik; bez projektu i z nieznanym id bez klasy.
- Testy Kokpitu: pozycja z `project` ma `projectKind`; grupa nadal „Ogólne”; nieznany projekt bez koloru.
