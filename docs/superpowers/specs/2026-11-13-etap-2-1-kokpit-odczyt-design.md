# Etap 2-1: Kokpit Dnia (odczyt)

Data: 2026-11-13. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.2 „Kokpit Dnia”, §5 „Prywatność i dane z etatu”) i makietę `docs/mockups/karty/cards/01-kokpit.html`.

## 1. Cel i zakres

Karta Kokpit (Alt+1) pokazuje jednym spojrzeniem: aktywne tematy (maks. 3, przypięte ręcznie), kolejkę zadań na dziś i dzisiejsze wydarzenia. Całość jest odczytem z istniejących danych; jedyny nowy zapis to lista przypiętych projektów.

**Poza zakresem (etap 2-2 lub później):** szybki inbox (`Vault/Inbox/`), rytuał zamknięcia dnia (`Vault/Sessions/`), pasek „Zaczep z wczoraj”, brief i link spotkań, action items, pole `[energy::]` i filtry energii, planer slotów, wykres tygodnia, kafle KPI (Inbox, Commity), raporty i przegląd tygodnia z AI, kalendarz etatu (`Vault/Work/` jest zablokowany do odczytu w `lib/nexus/vault-fs.ts`, więc etatowe wydarzenia nie pojawią się na osi; to świadoma granica).

## 2. Decyzje

| #   | Decyzja               | Wybór                                                                                                                                                                                                                                                                                         |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Podział etapu 2       | 2-1 = odczyt (ten spec). 2-2 = inbox + rytuał zamknięcia (osobny spec, kontekst i PR; zapisy do vaulta wymagają osobnego review). Wybór użytkownika, 2026-11-13.                                                                                                                              |
| D2  | Aktywne tematy        | Przypinane ręcznie, maks. 3. Odrzucone: wybór automatyczny po świeżości (przy pustych danych daje przypadkowe tematy) i wszystkie projekty z rejestru (łamie limit skupienia ze specu §6.2).                                                                                                  |
| D3  | Źródło tematu         | `next_step` i `blocker` ze `state.md`; gdy `state.md` nie ma (dziś w całym vaulcie nie ma żadnego), „Gdzie skończyłem” z `index.md`. Świeżość z `freshness` projektu (próg 14 dni): stare dane dostają znacznik „do sprawdzenia”, nie są ukrywane.                                            |
| D4  | Kolejka na dziś       | Zadania `[now::]` ze wszystkich projektów rejestru oraz zadania ogólne (`Vault/Tasks/tasks.md`) z `due` ≤ dziś i statusem innym niż `done`. Bez energii (osobna iteracja z planerem slotów). Kolejność: zaległe i dzisiejsze `due`, potem `[now::]`; grupy per projekt, ogólne jako „Ogólne”. |
| D5  | Dzisiejsze wydarzenia | Wpisy kalendarza z dzisiejszą datą po `start_minutes`. Terminy zadań (`type: "task_deadline"`, doklejane przez `bc_calendar`) są odrzucane, bo kolejka już je pokazuje.                                                                                                                       |
| D6  | Przypinanie           | Przycisk „Zmień aktywne” na Kokpicie, zapis do `Vault/Cockpit/pinned.yaml` przez `PUT /api/cockpit/pinned`. Odrzucone: tylko ręczna edycja pliku, przypinanie w karcie Projekty (większy zakres).                                                                                             |
| D7  | Prywatność `owner`    | Zadania i tematy projektu z `owner: work` dostają znacznik „Dane z firmy” (jak karta projektu, etap 1-5; test `isWorkProject`). Zadania ogólne nie mają pola `owner`, więc w 2-1 są traktowane jako prywatne (do rewizji, gdy powstanie `Work/`).                                             |
| D8  | Dzisiejsza data       | Jedna data „dziś” liczona w `bc_cockpit/services` w lokalnej strefie (`YYYY-MM-DD`, wstrzykiwalna `today: Date` jak w `bc_projects/services`). UI jej nie liczy (obecny `HomeView` używa UTC przez `toISOString()`, co przesuwa dzień przy północy).                                          |
| D9  | Błędy źródeł          | `GET /api/cockpit` degraduje się częściowo: każde źródło (rejestr, zadania ogólne, kalendarz) w osobnym `try/catch`; awaria daje pustą sekcję i wpis w `warnings`, nie 500. Wynika z tego, że zły YAML rejestru lub kalendarza dziś rzuca wyjątek.                                            |
| D10 | `ActivityLog`         | Zostaje na dole Kokpitu (start/stop sesji; `PlanowanieView` nie przekazuje `onStartSession`, więc jego usunięcie zabrałoby jedyny przycisk). Wypadają kafle KPI, liczniki i pobieranie pełnych kolekcji notatek, zasobów i map tylko dla `.length`.                                           |

## 3. Zmiany w kodzie (ADR-021)

**Nowy kontekst `contexts/bc_cockpit/`** (pięć plików):

- `repositories.ts`: czyta i zapisuje `Vault/Cockpit/pinned.yaml` przez `lib/nexus/yaml-store` (nie importuje `vault-fs`, więc lista `VAULT_FS_IMPORTERS` w teście architektury nie zmienia się). Format zgodny z `yaml-lists` (lista map): `projects:` z elementami `- id: <id>`. Brak pliku = lista pusta. Zapis przez `updateList` (`PUT` zastępuje całą listę): `yaml-store` przy zmianie zewnętrznej ponawia zapis na świeżej treści (maks. 3 razy), a po wyczerpaniu prób rzuca `ConflictError` (409); klient nie wysyła `expected` (to dotyczy tylko operacji indeksowych na `tasks.md`). Plik, który się nie parsuje, nie jest nadpisywany: `PUT` kończy się błędem z nazwą pliku, a poprawia go użytkownik ręcznie.
- `models.ts`: `Pinned = { ids: string[] }`, typy wewnętrzne widoku.
- `services.ts`: `getCockpit(today = new Date())` i `setPinned(ids)`; wołają wyłącznie `services` innych kontekstów:
  - `bc_projects`: `getProject(id, today)` dla każdego przypiętego (pole `nextStep`, `blocker`, „Gdzie skończyłem”, `freshness`, `owner`); **nowa** `listNowTasks()` (wszystkie niezakończone `[now::]` ze wszystkich projektów rejestru, z `projectId`, nazwą projektu i `owner`; nie obcina do 3, bo limit dotyczy UI tablicy);
  - `bc_tasks`: `getTasks()`, filtr w `bc_cockpit/services`: `due_date` poprawną datą `RRRR-MM-DD` (inaczej zadanie pomijane i wpis w `warnings`, np. `due:: 0006-08-26` z dzisiejszego `Tasks/tasks.md`), `due_date <= today`, `status !== "done"`;
  - `bc_calendar`: `getCalendarEvents({ startDate: today, endDate: today })` z odrzuceniem `type === "task_deadline"`.
  - `setPinned`: sprawdza, że id jest w rejestrze (`DomainError` 400); przypięty id, którego nie ma już w rejestrze, jest w `GET` pomijany z ostrzeżeniem.
- `schemas.ts` (bezpieczny dla klienta): zod wejścia `PUT` (tablica tekstów, maks. 3, unikalne, niepuste) i `CockpitDto = { date, topics[], queue[], events[], warnings[] }`, mapery model → DTO. Istnienie id w rejestrze nie jest tu sprawdzane (R2/R3 zabraniają importu `bc_projects` w `schemas`).
- `router.ts`: `GET` i `PUT` przez `handleServiceError`.
- Trasy `app/api/cockpit/route.ts` i `app/api/cockpit/pinned/route.ts`: tylko re-eksport.
- Test architektury nie jest zmieniany. Jeśli pęknie, naprawiamy kodem.

**`contexts/bc_projects`:** dodatek `listNowTasks()` w `services` (skan rejestru przez istniejące `readProjectBoard`), bez zmian formatu `tasks.md`.

**UI `src/features/home/`:** `HomeView.tsx` przepisany według makiety (sekcje: aktywne tematy, kolejka, oś dnia; pod spodem `ActivityLog` bez zmian). Importuje tylko `bc_cockpit/schemas`. „Zmień aktywne” pobiera listę projektów z istniejącego `GET /api/projects` (DTO `CockpitDto` nie zawiera listy do wyboru). Pusty stan: „Przypnij projekty”. Znaczniki „Dane z firmy” i „do sprawdzenia” jak w karcie projektu (te same klasy/tokeny).

## 4. Testy (TDD, czerwony przed zielonym)

- `repositories.test.ts`: brak pliku = pusta lista; zapis i odczyt `projects: [{id}]`; uszkodzony YAML = błąd obsługiwany w serwisie (ostrzeżenie), nie 500.
- `services.test.ts` (wirtualny vault z fixtur; nigdy prawdziwy rejestr): kolejność kolejki (zaległe → dziś → `[now::]`); jedna wspólna data „dziś” (wstrzyknięta, w tym 00:30 lokalnie nie przesuwa dnia); brak `state.md` → fallback z `index.md`; stary `last_worked` → znacznik „do sprawdzenia”, temat nie znika; przypięty id spoza rejestru → pominięty z ostrzeżeniem; `owner: work` → znacznik; `due:: 0006-08-26` i inne złe daty pomijane z ostrzeżeniem; oś bez `task_deadline` (brak duplikatu z kolejką); awaria jednego źródła (mock `getTasks` rzuca) → pozostałe sekcje działają i jest ostrzeżenie; `setPinned`: nieznane id, 4 id, duplikaty → 400.
- `bc_projects/services.test.ts`: `listNowTasks` (kilka projektów, `owner`, pominięcie ukończonych).
- `schemas.test.ts`: walidacja `PUT`, kształt DTO.
- UI `tests/unit/features/home/HomeView.test.tsx` (istniejący test aktualizowany): kafle tematów, kolejka, oś, pusty stan, „Dane z firmy”, „do sprawdzenia”, „Zmień aktywne” zapisuje i odświeża; `ActivityLog` nadal renderowany.
- Po wdrożeniu: sprawdzenie w przeglądarce (Playwright) na kopii vaulta ze scratchpada, bez dotykania `Projects/_registry.yaml` w NEXUS; jeśli niesprawdzone, napisać to w opisie PR.

## 5. Po wykonaniu

W `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „Etap 2-1” (PR #NN, data) i dopisać do Backlogu: etap 2-2 (inbox i rytuał zamknięcia), pole energii i planer slotów, kalendarz etatu (`Work/`), `owner` dla zadań ogólnych. Commit tylko `tasks.md`, za zgodą użytkownika.
