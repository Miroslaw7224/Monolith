# Kalendarz: typ wydarzenia „wizyta” i przypomnienie w Kokpicie

Data: 2026-11-25. Status: zatwierdzony przez użytkownika (projekt przedstawiony w rozmowie 2026-11-25). Rozwija `2026-11-13-bc-calendar-design.md`.

## 1. Cel

Wizyta (lekarz, dentysta) nie jest ani pracą, ani spotkaniem online, a kalendarz zna dziś tylko typy `work` i `meeting`; każdy inny typ jest czytany jako `work`. Użytkownik chce osobny typ `visit` oraz przypomnienie w Kokpicie dzień wcześniej.

## 2. Decyzje

| ID  | Temat                | Decyzja                                                                                                                                                                           |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Nazwa typu           | `visit`, etykieta „Wizyta” (wybór użytkownika).                                                                                                                                   |
| D2  | Kokpit: spotkania    | Bez zmian: `visit` nie wchodzi do „najbliższego spotkania” ani do licznika spotkań (filtry `=== "meeting"` zostają) (wybór użytkownika, opcja A).                                 |
| D3  | Przypomnienie        | Tylko dla `visit`, 1 dzień przed, stała reguła bez ustawień. Widoczne przez cały dzień poprzedzający wizytę (data lokalna, nie godzina); w dniu wizyty znika, bo jest w osi dnia. |
| D4  | Wygląd przypomnienia | Sekcja nad blokiem „Pilne” w stylu tego bloku (ramka i tło), z własnym akcentem, żeby nie myliła się z czerwonym „Pilne”.                                                         |
| D5  | Domyślny czas        | 60 min (`EVENT_TYPE_DEFAULT_DURATION`).                                                                                                                                           |
| D6  | Migracja             | Brak: pliki `Calendar/*.yaml` bez zmian; stary typ `work` zostaje. Starsza wersja aplikacji czyta `visit` jako `work`.                                                            |
| D7  | Poza zakresem        | Przypomnienia dla innych typów, konfigurowalne wyprzedzenie, powiadomienia systemowe.                                                                                             |

## 3. Zmiany w kodzie (ADR-021)

### `contexts/bc_calendar`

- `models.ts`, `schemas.ts`, `services.ts`: typ `"work" | "meeting" | "visit"` (w `schemas.ts` także z `task_deadline`).
- `repositories/index.ts` (odczyt, dodanie, zmiana) i `router.ts` (POST, PUT): wspólna normalizacja `meeting | visit` → bez zmian, wszystko inne → `work`. Najlepiej jedna funkcja `normalizeEventType` zamiast powtórzonych trójargumentowych warunków.

### `contexts/bc_cockpit`

- `models.ts`: `DayEvent.type` dostaje `"visit"`; nowy typ `TomorrowVisit = { id, title, startMinutes, durationMinutes }`; pole `Cockpit.tomorrowVisits: TomorrowVisit[]`.
- `services.ts`: `loadTomorrowVisits(today, warnings)` woła `calendarServices.getCalendarEvents` dla jutrzejszej daty, bierze wydarzenia z `type === "visit"` i `date === jutro`, sortuje po `start_minutes`. Własny `try/catch`: awaria daje `[]` i wpis w `warnings` (tak jak `loadUpcomingMeeting`). `getCockpit` dodaje `tomorrowVisits`.
- `schemas.ts`: DTO i mapowanie `tomorrowVisits`.

### UI (`src/**`, tylko importy `schemas`)

- `CalendarEventForm.tsx`: opcja `visit` (`planning:calendarFormTypeVisit`, pl „Wizyta”, en „Visit”), typ stanu `"work" | "meeting" | "visit"`; zmiana typu ustawia domyślny czas z `EVENT_TYPE_DEFAULT_DURATION`.
- `calendarConstants.ts`: `visit: 60`.
- `CalendarView.tsx` (`:429`, `:440`): przepuszcza `visit`.
- `calendarEventStyle.ts` i `calendar.css`: klasa `kal-ev--visit` z własnym kolorem lewej krawędzi, z istniejących zmiennych CSS (nie `--accent` ani `--warn`, zajęte przez `meeting` i terminy).
- `CockpitSections.tsx`: sekcja `kok-visit` tuż przed `kok-urgent`, renderowana tylko gdy `data.tomorrowVisits.length > 0`, niezależnie od pilnych zadań. Nagłówek „JUTRO · wizyta” (`home:cockpit.visitBold` / `visitSub`, `visitAria`), wiersz „7:30 · Wizyta u kardiologa (60 min)”. Style `kok-visit*` w `home.css`.

## 4. Vault i prywatność

Zapisy tylko przez istniejące API kalendarza do `Vault/Calendar/`; nie dotyka `Work/` ani `owner`. Nowy kod nie woła modelu (BEZP nie dotyczy). Test architektury bez zmian.

## 5. Testy (Vitest)

- `router.events`, `router.events-id`, `repositories`: `type: "visit"` zapisuje się i odczytuje jako `visit`; nieznany typ daje `work`; `PUT` z `type: "visit"` zmienia typ.
- `bc_cockpit/services`: wizyta jutro trafia do `tomorrowVisits`; wizyta dziś, pojutrze i `meeting` jutro nie; kolejność po godzinie (7:30 przed 9:00); wizyta nie zmienia `nextMeeting` ani `meetings.count`; błąd kalendarza daje `[]` i ostrzeżenie; granica miesiąca (31.12 widzi wizytę z 1.01).
- `bc_cockpit/schemas`: DTO zawiera `tomorrowVisits`.
- `CalendarEventForm`: opcja „Wizyta” i domyślne 60 min.
- `CockpitSections`: `kok-visit` jest przed `kok-urgent`; brak wizyt = brak sekcji; sekcja działa bez pilnych zadań.

## 6. Po wdrożeniu

Przez `PUT` zmienić typ wizyty u kardiologa (7.12.2026, id `SfqCY9dkuVxsVlUR6SCJ`) z `work` na `visit` i dopisać wizytę u dentysty (28.01.2027, 8:00, 60 min, tag `prywatny`, typ `visit`); `POST` dopiero po zgodzie na treść zapisu.
