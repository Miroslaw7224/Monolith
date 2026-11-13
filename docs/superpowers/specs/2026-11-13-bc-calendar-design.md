# PR 5: migracja domeny kalendarza do `contexts/bc_calendar/` — projekt

Data: 2026-11-13
Status: do review
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (§4 siatka plików, §5.1 UI wspólne, §6 reguły, §7 wiersz PR 5), wzór: PR 4 `bc_tasks` (#27), `2026-11-13-bc-tasks-design.md`

## 1. Cel

Przenieść domenę zdarzeń kalendarza ze starej warstwy (`services/`, `lib/nexus/repos/`, `lib/validation/`, `lib/`, `types/`) do jednego kontekstu `contexts/bc_calendar/`, razem z UI kalendarza (`src/features/calendar/`) i wspólnym UI sesji (`src/components/sessions/`). Bez zmiany zachowania: te same testy przechodzą po przeniesieniu.

**Zasada nadrzędna:** projekt dopasowuje się do siatki i reguł 1–9, nie odwrotnie. Test `architecture.static.test.ts` i jego baseline zostają bez zmian; każdy nowy import jest dopuszczony przez `LAYER_ALLOWED` (test, L62-68). Każdy plik trafia w jedno miejsce według tego, kto go używa.

## 2. Zakres

**W zakresie:**

- zdarzenia kalendarza (`Calendar/RRRR-MM.yaml`, klucz `events`) i wirtualne zdarzenia `task_deadline` (doklejane w serwisie z zadań, nigdy nie zapisywane);
- 2 trasy API: `calendar/events` (`GET`, `POST`), `calendar/events/[id]` (`PUT`, `DELETE`);
- UI kalendarza: `CalendarView`, `CalendarEventForm`, `calendar/*` (`CalendarDayColumn`, `calendarUtils`, `useCalendarData`) → `src/features/calendar/`;
- UI sesji: `ActivityLog`, `StartSessionModal`, `src/lib/activeSession.ts` → `src/components/sessions/` (spec §5.1). Konsumenci: `HomeView`, `PlanowanieView`, a także sam kalendarz (`CalendarView.tsx:4,15` importuje `StartSessionModal` i typ `ActiveSession`, `CalendarDayColumn.tsx:6` typ `ActiveSession`), więc to wspólne UI, nie część `src/features/calendar/`;
- rozdzielenie `lib/calendarRange.ts` według konsumentów (§4).

**Poza zakresem:** format plików w vaulcie, `lib/dateRef.ts` (nie dotyczy kalendarza: martwy kod po wycofanym agencie AI, używa go tylko własny test; zostaje do PR 10), `src/lib/calendarConstants.ts` (zostaje, §5.1), zmiany zachowania UI.

## 3. Struktura kontekstu

| Plik            | Zawartość                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`     | `CalendarEvent` (zapisany: `type: "work" \| "meeting"`, `created_at?`) i `CalendarEntry` (wynik serwisu: ten sam kształt z `type` rozszerzonym o `"task_deadline"`)                                                                                                                                                                                                 |
| `schemas.ts`    | zod `CreateCalendarEventBodySchema` / `UpdateCalendarEventBodySchema` z `lib/validation/calendarEvents.ts` 1:1; `CalendarEventDto` (kształt dzisiejszego `CalendarEvent` z `types/records`, pola bez zmian); mapper `toCalendarEventDto(entry: CalendarEntry): CalendarEventDto` (przyjmuje `CalendarEntry`, bo lista z `task_deadline` też przez niego przechodzi) |
| `repositories/` | `index.ts`: `lib/nexus/repos/calendarEvents.ts` 1:1 (`vault-fs`, `yaml-store`); `range.ts`: pomocniki zakresu dat (§4). Plik → folder, jak w `bc_tasks`                                                                                                                                                                                                             |
| `services.ts`   | CRUD, reguła „`duration_minutes` wielokrotność 15", scalanie z `task_deadline` przez `bc_tasks/services.getTasks()` (stałe: 23:30, 30 min, kolor `#6B7280`), sortowanie                                                                                                                                                                                             |
| `router.ts`     | 4 handlery (`listCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`); koercje z dzisiejszych `route.ts` (`Number(start_minutes)`, domyślny kolor, zawężenie `type`) 1:1, jak `createTask` w `bc_tasks/router.ts`                                                                                                                  |

`app/api/calendar/events/route.ts` i `events/[id]/route.ts` stają się cienkim re-eksportem z `contexts/bc_calendar/router` (reguła 4).

## 4. `lib/calendarRange.ts` rozdzielony według konsumentów

`lib/` to infrastruktura (`nexus`, `http`, `schema`, `errors`), a kod kalendarza wchodzi do kontekstu (spec §5). Siatka nie ma miejsca na funkcję używaną naraz przez domenę i UI (`schemas` nie importuje `lib/calendarRange` ani `models` w runtime, `repositories` i `services` nie importują `schemas`), ale nie jest to potrzebne: żadna funkcja nie ma dwóch konsumentów.

- `eventOverlapsInclusiveRange` + `parseLocalMidnight`, `eventStartMs`, `eventEndMs` (jedyny konsument: repozytorium, `lib/nexus/repos/calendarEvents.ts:76`) → `contexts/bc_calendar/repositories/range.ts`;
- `eventMinutesInInclusiveRange` (jedyny konsument: `ActivityLog.tsx:81,191`) → `src/components/sessions/activityRange.ts` (kod UI używany przez moduł, §5.1; bez importu z `lib/` i z kontekstu).

**Koszt, świadomie przyjęty:** kilka linii matematyki dat (`parseLocalMidnight`, start/end) występuje w obu plikach. Funkcje nie zmieniają zachowania; ich testy (`tests/unit/lib/calendarRange.test.ts`) dzielą się odpowiednio (§6). `lib/calendarRange.ts` jest usunięty.

## 5. Przepięcia

- `app/api/calendar/events/**`: re-eksport (§3).
- `lib/nexus/repos/calendarEvents.ts`, `services/calendarService.ts`, `lib/validation/calendarEvents.ts`, `lib/calendarRange.ts`: usunięte.
- `lib/firestore-db.ts`, `types/index.ts`, `types/records.ts` tracą `CalendarEvent` i `CalendarEventRecord`; konsumenci typu: `calendarUtils.ts:1` i `ActivityLog.tsx:17` biorą `CalendarEventDto` z `contexts/bc_calendar/schemas` (reguła 1). Gdyby implementacja znalazła dodatkowego konsumenta, re-eksport idzie wyłącznie ze `schemas` (reguła 9).
- `PlanowanieView.tsx:10`: `CalendarView` z `src/features/calendar/` (`planowanie` składa widoki, spec §5). `src/features/calendar/` jest płaski (jak `src/features/tasks/`): `./calendar/*` w `CalendarView` i `CalendarEventForm` staje się `./*`, a `calendarUtils.ts:3` re-eksportuje `CalendarEventDto as CalendarEvent`, żeby `CalendarView`, `CalendarDayColumn` i `useCalendarData` nie zmieniały nazw typu.
- Sesje: `HomeView.tsx:5,7,13`, `PlanowanieView.tsx:24` oraz **oba** dynamiczne importy `ActivityLog` w `PlanowanieView.tsx:29-31` (typ i fabryka), `CalendarView.tsx:4,15`, `CalendarDayColumn.tsx:6` i `ActivityLog.tsx:16` biorą `ActivityLog`, `StartSessionModal`, `activeSession` z `src/components/sessions/`.
- `README.md:46` i `docs/mockups/karty/STAN-W-KODZIE.md` (stare ścieżki) aktualizuje zbiorczo PR 10 (spec §7).
- `calendarConstants` (`src/lib/`, używany też przez `TagsSection`) bez zmian.
- Zależność `bc_calendar/services → bc_tasks/services` jest już zgodna z regułami 2 i 8 (graf acykliczny); stary import w `calendarService` zniknie razem z plikiem.

## 6. Testy (TDD)

Kolejność: najpierw testy przenoszone i nowe czerwone (brak modułu), potem kod.

- `tests/unit/lib/nexus/repos/calendarEvents.test.ts` → `tests/unit/contexts/bc_calendar/repositories.test.ts`; **pierwszy czerwony test: filtr zakresu dat** (`startDate`/`endDate` przez `repositories/range`);
- `tests/unit/lib/calendarRange.test.ts` → dzieli się: `parseLocalMidnight`, `eventStartMs/EndMs`, `eventOverlapsInclusiveRange` → `tests/unit/contexts/bc_calendar/repositories.range.test.ts`; `eventMinutesInInclusiveRange` → `tests/unit/components/sessions/activityRange.test.ts`;
- `tests/unit/services/calendarService.test.ts` → `tests/unit/contexts/bc_calendar/services.test.ts`; mock `lib/firestore-db` zastąpiony mockiem repozytorium kontekstu, mock `@/contexts/bc_tasks/services` zostaje. Istniejące przypadki (scalanie `task_deadline`, pomijanie `done`, zakres dat, CRUD) przechodzą bez zmian asercji; **nowe, do dopisania** (dziś nie ma ich w `calendarService.test.ts`): sortowanie scalonej listy (`date`, potem `start_minutes`) oraz odrzucenie `duration_minutes` niebędącego wielokrotnością 15 w `create` i `update` przez serwis (bez polegania na mocku repozytorium);
- nowe testy tras (dziś brak testów API kalendarza): `router.events.test.ts` i `router.events-id.test.ts` w `tests/unit/contexts/bc_calendar/` (osobne pliki z sufiksem jak w `bc_tasks`, bo trasy mają kolidujące nazwy `GET`/`POST`/`PUT`); mock `bc_calendar/services`;
- `tests/unit/lib/nexus/repos-static.test.ts`: `FILE_REPOS` (L18) zamienia `calendarEvents` na `contexts/bc_calendar/repositories/index.ts`; lista importerów `vault-fs` (L73) tylko traci `lib/nexus/repos/calendarEvents.ts` (`walk` skanuje wyłącznie `lib/nexus`, więc ścieżki `contexts/...` tam nie dodajemy); lista barrel (L87) traci `calendarEvents`. To test starej warstwy, aktualizowany razem z kodem (spec §6, jak w PR 4);
- `tests/unit/no-user-id.static.test.ts:32`: `src/lib/activeSession.ts` → `src/components/sessions/activeSession.ts`;
- `tests/unit/components/CalendarView.test.tsx` → `tests/unit/features/calendar/CalendarView.test.tsx` (importy: `src/features/calendar/...`); `tests/unit/lib/activeSession.test.ts` → `tests/unit/components/sessions/activeSession.test.ts`; mock w `tests/unit/features/home/HomeView.test.tsx:7` → `@/src/components/sessions/ActivityLog`;
- `tests/unit/architecture.static.test.ts` i baseline: **bez zmian**, test musi zostać zielony (baseline nie zawiera wpisów o kalendarzu).

## 7. Kolejność i weryfikacja

Jeden PR, trzy commity; po każdym `npx tsc --noEmit` i `npx vitest run` zielone. Kolejność wynika z zależności (każdy commit musi się budować):

1. sessions → `src/components/sessions/` + `activityRange.ts`; z `lib/calendarRange.ts` znika `eventMinutesInInclusiveRange` (jedyny konsument: `ActivityLog`), jego testy przechodzą do `activityRange.test.ts`; przepięcia Home, Planowanie (oba dynamiczne importy), `CalendarView`, `CalendarDayColumn`; ścieżki w `no-user-id.static.test.ts` i mock w `HomeView.test.tsx`. `CalendarView` zostaje jeszcze w `src/components/`, więc jego względny import `./StartSessionModal` zmienia się na `@/src/components/sessions/StartSessionModal`;
2. backend: `contexts/bc_calendar/` + trasy + przepięcie typów (`ActivityLog` i `calendarUtils` biorą `CalendarEventDto`), usunięcie `lib/calendarRange.ts` (jego reszta ląduje w `repositories/range.ts`), testy domeny i tras, `repos-static`;
3. UI kalendarza → płaski `src/features/calendar/`, przepięcie `PlanowanieView`, test `CalendarView`.

Na końcu `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build`: przez `cursor` z podsumowaniem „przeszło" / lista `plik:linia + przyczyna`. Review diffa przez `agy --role review` (zapis do vaulta, filtr zakresu, scalanie `task_deadline`). Ręcznie w przeglądarce: karta Planowanie → kalendarz (dodanie, edycja, usunięcie zdarzenia, terminy zadań) i `ActivityLog` w Home i Planowaniu; łączy się z zadaniem w NEXUS „Obejrzeć w przeglądarce kartę Planowanie i Home po PR 4".

## 8. Ryzyka

- **Przeniesienie UI zmienia wiele importów** (kalendarz, sesje, Home, Planowanie): błędy wychodzą w `tsc`/`build`, nie w testach jednostkowych, więc `build` jest obowiązkowy.
- **Kolejność commitów** (§7) jest wymuszona zależnościami: usunięcie `lib/calendarRange.ts` przed `activityRange.ts` albo przeniesienie `CalendarView` przed sessions zepsułoby `tsc` w pośrednim commicie.
- **Podział `calendarRange`** to jedyne miejsce, gdzie kod się rozdziela: testy obu połówek muszą przejść ze zmianą wyłącznie ścieżek importu, bez zmiany asercji.
- **Wirtualne `task_deadline`:** `CalendarView.tsx:108` i `CalendarDayColumn.tsx:85` rozróżniają je po `type`; DTO zachowuje unię `"work" | "meeting" | "task_deadline"`, inaczej `tsc` nie złapie regresji w UI.
- **Reguła 15 minut** jest w `services`, nie w zod (jak dziś); walidacja body w `schemas` nie sprawdza jej, więc test serwisu pokrywa `create` i `update`.
