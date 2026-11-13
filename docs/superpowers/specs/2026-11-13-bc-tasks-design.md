# PR 4: migracja domeny zadań do `contexts/bc_tasks/` — projekt

Data: 2026-11-13
Status: zaakceptowany (2026-11-13)
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (§4 siatka plików, §6 reguły, §7 wiersz PR 4), wzór: PR 3 `bc_tags` (#26)

## 1. Cel

Przenieść domenę globalnych zadań i szablonów zadań ze starej warstwy (`services/`, `lib/nexus/repos/`, `lib/validation/`, `types/`) do jednego kontekstu `contexts/bc_tasks/`, razem z UI zadań (`src/features/tasks/`). Bez zmiany zachowania: te same testy przechodzą po przeniesieniu.

## 2. Zakres

**W zakresie:**

- zadania (`Tasks/tasks.md`, linie Dataview przez `lib/nexus/task-line`) i szablony (`Tasks/templates.yaml`), oba w jednym kontekście;
- 5 tras API: `tasks`, `tasks/[id]`, `tasks/reorder`, `task-templates`, `task-templates/[id]`;
- UI: `TasksSection`, `TaskDetailModal`, `TaskTemplatesModal`, `components/tasks/*` → `src/features/tasks/`;
- przepięcie `services/calendarService.ts` na `contexts/bc_tasks/services`.

**Poza zakresem:** format plików w vaulcie, zadania projektów z `bc_projects` (`Projects/<folder>/tasks.md`: osobny storage, model i edytor, brak nakładania), migracja `bc_calendar` (PR 5; tu tylko zmiana jednego importu).

## 3. Struktura kontekstu

| Plik              | Zawartość                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`       | typy wewnętrzne domeny (rekordy repozytorium)                                                                                            |
| `schemas.ts`      | zod wejścia z `lib/validation/{tasks,taskTemplates}.ts`, `TaskRecord` / `TaskTemplateRecord` jako DTO, mapery model → DTO; import z UI   |
| `repositories.ts` | `lib/nexus/repos/{tasks,taskTemplates}.ts` 1:1, dostęp do vaulta wyłącznie przez `lib/nexus`                                             |
| `services.ts`     | `taskService` + `taskTemplateService` (~70 linii razem)                                                                                  |
| `router.ts`       | jeden plik z handlerami 5 tras; folder `router/` (spec §4) tylko, jeśli plik urośnie; trasy w `app/api/**/route.ts` to cienki re-eksport |

## 4. Przepięcia

- `app/api/tasks/**`, `app/api/task-templates/**`: re-eksport z `contexts/bc_tasks/router` (reguła 4).
- `services/calendarService.ts:36`: `getTasks` z `contexts/bc_tasks/services` zamiast barrelu (reguła 7 dopuszcza kierunek stary → nowy); mock w `tests/unit/services/calendarService.test.ts:15-20` zmienia źródło na `@/contexts/bc_tasks/services`.
- `lib/firestore-db.ts`, `types/index.ts`, `types/records.ts` tracą zadania i szablony (`TaskRecord` L48, `TaskTemplateRecord` L61). Poza barrelami, repozytoriami, serwisem i `TasksSection.tsx:9` nikt nie używa tych typów, więc `types/records.ts` nic nie re-eksportuje; UI importuje typy z `contexts/bc_tasks/schemas` (reguła 1). Gdyby implementacja znalazła dodatkowego konsumenta, re-eksport idzie wyłącznie ze `schemas` (reguła 9).
- UI: jedynym konsumentem komponentów jest `src/features/planowanie/PlanowanieView.tsx:11` (`TasksSection`) i importuje z `src/features/tasks/` (`planowanie` jest wyjątkiem składającym widoki, spec §5). `src/features/home/HomeView.tsx:87` nie zmienia się: woła tylko `/api/tasks` przez HTTP i ma własny typ `HomeTask`.
- Usunięcie `lib/validation/tasks.ts`, `lib/validation/taskTemplates.ts`, `services/taskService.ts`, `services/taskTemplateService.ts`, `lib/nexus/repos/tasks.ts`, `lib/nexus/repos/taskTemplates.ts`.

## 5. Testy (TDD)

Kolejność: najpierw testy przenoszone i nowe czerwone (brak modułu), potem kod.

- `tests/unit/lib/nexus/repos/{tasks,taskTemplates}.test.ts` → `tests/unit/contexts/bc_tasks/repositories.test.ts`;
- `tests/unit/services/{taskService,taskTemplateService}.test.ts` → `tests/unit/contexts/bc_tasks/services.test.ts`;
- nowy `tests/unit/contexts/bc_tasks/router.test.ts` dla 5 tras; zastępuje `tests/unit/api/{tasks,tasks-id,task-templates}.test.ts` (jak przy tagach: testy HTTP przechodzą do routera, mock `bc_tasks/services`);
- **pierwszy czerwony test repozytorium: `reorder`**. Zmienia kolejność linii w `tasks.md` i jest najłatwiejszy do zepsucia przy przenosinach;
- `tests/unit/lib/nexus/repos-static.test.ts` (L18, L76, L91) i `tests/unit/no-user-id.static.test.ts` (L31): ścieżki na `contexts/bc_tasks/repositories.ts`;
- `tests/unit/components/TasksSection.test.tsx` przechodzi razem z komponentem; `tests/e2e/tasks.spec.ts` bez zmian (UI przez Playwright);
- `tests/unit/architecture.static.test.ts` i jego baseline: **bez zmian**, test musi zostać zielony (baseline nie zawiera wpisów o zadaniach).

## 6. Weryfikacja

- `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build`: przez `cursor` z podsumowaniem „przeszło” / lista `plik:linia + przyczyna`;
- review diffa przez `agy --role review` po implementacji (logika zapisu do vaulta, `reorder`);
- ręcznie w przeglądarce: karta Planowanie (lista zadań, przeciąganie, modal, szablony) i Home (licznik zadań na dziś, odczyt przez `/api/tasks`).

## 7. Ryzyka

- `reorder` na `tasks.md`: pokryty testem repozytorium na początku (patrz §5).
- Przeniesienie UI zmienia wiele importów; błąd wychodzi w `tsc`/`build`, nie w testach jednostkowych, więc `build` jest obowiązkowy.
- `calendarService` zależy od `getTasks`; przepięcie bez zmiany mocka zepsułoby `calendarService.test.ts`, stąd w §4 jawna zmiana mocka.

## 8. Doprecyzowania z planu

Plan (`docs/superpowers/plans/2026-11-13-bc-tasks.md`) doprecyzowuje spec bez zmiany zakresu:

- `repositories` jest folderem (`repositories/{index,tasks,templates}.ts`, spec §4 „plik → folder"): `tests/unit/lib/nexus/repos-static.test.ts` wymaga, by repozytorium plikowe (`tasks`, importuje `vault-fs`) i YAML (`templates`, nie wolno mu importować `vault-fs`) były osobnymi plikami;
- DTO nazywają się `TaskDto` i `TaskTemplateDto` (jak `UserTagDto`), a `models.ts` ma `Task` i `TaskTemplate`;
- testy w kilku plikach z sufiksem (`repositories.tasks.test.ts`, `router.reorder.test.ts` itd., jak w `bc_projects`), zamiast jednego `router.test.ts`, bo trasy zadań i szablonów mają kolidujące nazwy `GET`/`POST`;
- UI płasko w `src/features/tasks/`, testy UI w `tests/unit/features/tasks/`.
