# Zadania: status „Odłożone”

Data: 2026-11-15. Status: szkic do przeglądu. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.2 „Kolejka zadań na dziś”) i spec Kokpitu 2-1 (`2026-11-13-etap-2-1-kokpit-odczyt-design.md`, D4).

## 1. Cel

Aplikacja ma pomagać zarządzać czasem i pracą, a nie utrudniać życie zbędnymi bajerami; rozwijamy ją w miarę potrzeb (wypowiedź użytkownika, 2026-11-15).

Realny ból: Kokpit wciąga do kolejki „na dziś” wszystkie niezakończone zadania ogólne (`Vault/Tasks/tasks.md`), także te, których użytkownik świadomie nie robi (np. kurs Playwright leżący od dwóch miesięcy). Nie ma sposobu, by je zdjąć z kolejki, nie usuwając ich ani nie udając, że są zrobione. Rozwiązanie: nowy status **Odłożone**, pierwsza kolumna tablicy Zadań, wykluczana z Kokpitu, statystyk terminów i terminów w kalendarzu.

Burza mózgów z pomocnikami (`agy`, `cursor`) dała dłuższą listę usprawnień Kokpitu (action items po spotkaniu, radar zablokowanych projektów, terminy projektów w kolejce, przegląd tygodnia, kalendarz etatu). Użytkownik wybrał z niej tylko tę jedną zmianę; reszta odpada (zob. §6).

## 2. Decyzje (brainstorming 2026-11-15)

| ID  | Temat               | Decyzja                                                                                                                                                                                                                           |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Reprezentacja       | Nowa wartość statusu `deferred` (pole `status::` w linii zadania). Odrzucone: znacznik w tekście (nie daje kolumny) i osobna flaga obok statusu (zadanie byłoby naraz „w toku” i „odłożone”).                                     |
| D2  | Kolejność kolumn    | `deferred`, `todo`, `in_progress`, `to_review`, `done`. „Odłożone” jest pierwsze (wybór użytkownika).                                                                                                                             |
| D3  | Kokpit              | Zadania `deferred` nigdy nie trafiają do kolejki, także gdy mają `due` na dziś lub są zaległe (wybór użytkownika: „zawsze ukryte”). Pilny znacznik działa jak dotąd dla zadań aktywnych.                                          |
| D4  | Kalendarz           | Zadania `deferred` nie są doklejane jako `task_deadline` (rekomendacja przyjęta: „Odłożone” znaczy „nie teraz” wszędzie).                                                                                                         |
| D5  | Statystyki terminów | `getTaskDueState` zwraca `null` dla `deferred`, więc zadanie nie jest „zaległe” ani „na dziś” (kafelki i filtr „tylko terminy” w karcie Zadania). Licznik aktywnych w nagłówku nie liczy odłożonych.                              |
| D6  | Zakres danych       | Tylko zadania ogólne (`Vault/Tasks/tasks.md`, kontekst `bc_tasks`). Zadania projektów (`Projects/<id>/tasks.md`, tablica Teraz / Następne / Icebox) mają własny podział; Icebox już pełni tam rolę odłożonych i nie jest ruszany. |
| D7  | Prywatność          | Bez zmian: zapis wyłącznie do `Vault/Tasks/tasks.md`, nie dotyka `Work/` ani `owner`.                                                                                                                                             |

## 3. Zmiany w kodzie (ADR-021)

**Format i parser (`lib/nexus/task-line.ts`):** `TASK_STATUSES = ["deferred", "todo", "in_progress", "to_review", "done"]`. Linia: `- [ ] Tytuł [id:: …] [status:: deferred] …`; pole wyboru zostaje `[ ]` (`[x]` tylko dla `done`). Stare pliki działają bez zmian; nieznany status nadal rzuca błąd jak dziś.

**Kontekst `bc_tasks`:** `models.ts` i `schemas.ts` rozszerzają typ `status` o `"deferred"`. `router.ts`, `services.ts` i `repositories/tasks.ts` bez zmian (status przechodzi jak każdy inny). Test architektury nie jest zmieniany.

**Kontekst `bc_cockpit/services.ts`:** w `loadQueue` (okolice linii 217) warunek pomijania zadań ogólnych obejmuje `deferred`: `done`, `to_review` i `deferred` nie wracają do kolejki.

**Kontekst `bc_calendar/services.ts`:** filtr terminów zadań (okolice linii 61) pomija też `deferred` (obok `done`).

**UI `src/features/tasks/`:**

- `taskOrderUtils.ts`: `TASK_STATUSES` z `deferred` na początku (kolejność kolumn i `orderedIds`).
- `TasksSection.tsx`: etykieta kolumny `deferred` (`tasksDeferred`), `activeCount` nie liczy `deferred`.
- `TaskDetailModal.tsx`: nowa opcja wyboru statusu.
- `taskStatsUtils.ts`: `getTaskDueState` zwraca `null` także dla `deferred`; statystyki wg statusu (`todo`, `in_progress`, `done`) nie liczą odłożonych jako aktywnych.
- `tasks.css`: siatka `.zad-board` na szerokich ekranach z 4 na 5 kolumn (`repeat(5, …)` od 1024 px); pozostałe progi bez zmian.
- `src/translations.ts`: `tasksDeferred` (PL „Odłożone”, EN „Deferred”).

**Dokumentacja:** `docs/nexus-vault-formaty-yaml.md` (wiersz o statusach zadań: dopisać `deferred`); `docs/mockups/karty/STAN-W-KODZIE.md` bez zmian (nie dotyczy stanu funkcji karty).

## 4. Testy (TDD, czerwony przed zielonym)

- `tests/unit/lib/nexus/task-line.test.ts`: parsowanie `[status:: deferred]` z `[ ]` daje `status: "deferred"`; serializacja daje `[ ]` i `[status:: deferred]`; `[x]` bez pola statusu nadal daje `done`; nieznany status nadal błąd.
- `tests/unit/features/tasks/taskOrderUtils.test.ts`: kolejność kolumn `deferred` pierwsza; `tasksByStatus` grupuje odłożone osobno.
- `tests/unit/features/tasks/taskStatsUtils.test.ts`: `getTaskDueState` dla odłożonego z `due` wczoraj i dziś = `null`.
- `tests/unit/contexts/bc_cockpit/services.test.ts`: zadanie ogólne `deferred` z `due` dziś i zaległe nie trafia do kolejki; zadanie `todo` obok nadal tak; brak ostrzeżenia w `warnings`.
- `tests/unit/contexts/bc_calendar/services.test.ts`: zadanie `deferred` z `due` w zakresie nie tworzy `task_deadline`.
- Po wdrożeniu: sprawdzenie w przeglądarce (Playwright) na kopii vaulta ze scratchpada, bez dotykania prawdziwego `Tasks/tasks.md`; jeśli niesprawdzone, napisać to w opisie PR.

## 5. Po wykonaniu

W `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć wpis o statusie „Odłożone” (PR #NN, data). Commit tylko `tasks.md`, za zgodą użytkownika. Użytkownik sam przesuwa istniejące zadania (np. kurs Playwright) do „Odłożone” po wdrożeniu; migracji danych nie ma.

## 6. Poza zakresem

Odrzucone w tym brainstormingu (użytkownik: terminy projektów zostają w karcie Projekty, wnioski ze spotkań trafiają do notatek lub inboxu, świeżość projektów widać w Projektach, Agenda w Kalendarzu zostaje jak jest):

- terminy `due` z `tasks.md` projektów w kolejce Kokpitu (zadania do kolejki dodaje użytkownik albo agent na jego prośbę przez `[now::]`);
- action items po spotkaniu na osi dnia;
- radar blokad i przeterminowanych tematów poza przypiętymi;
- przegląd tygodnia (deterministyczny lub z AI), kalendarz etatu z `Work/`, `owner` dla zadań ogólnych;
- ograniczenie horyzontu kolejki do 7 dni i wybór roli paczki na karcie tematu (pomysły `agy`): nie potrzebne po wprowadzeniu „Odłożone”; wracają tylko, jeśli kolejka znów będzie zaszumiona.
