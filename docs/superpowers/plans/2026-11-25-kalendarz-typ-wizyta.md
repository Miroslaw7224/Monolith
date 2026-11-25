# Kalendarz: typ „wizyta” i przypomnienie w Kokpicie, plan wdrożenia

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans (albo subagent-driven-development). Kroki mają checkboxy (`- [ ]`). Spec: `docs/superpowers/specs/2026-11-25-kalendarz-typ-wizyta-design.md`.

**Cel:** nowy typ wydarzenia `visit` („Wizyta”) w kalendarzu oraz sekcja „Jutro · wizyta” w Kokpicie nad blokiem „Pilne”.

**Architektura:** typ przechodzi przez `bc_calendar` (models → repositories/router/services → DTO); `bc_cockpit` dostaje pole `tomorrowVisits` liczone przez `calendarServices.getCalendarEvents` (jedyne dozwolone wołanie innego kontekstu: jego `services`); UI importuje z kontekstów tylko `schemas`.

**Stos:** Next.js 14, TypeScript, zod, Vitest (`tests/unit/**`), React Testing Library.

**Gałąź:** `feat/kalendarz-typ-wizyta` (już utworzona, spec zacommitowany). Każdy commit kończy się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook pre-commit uruchamia prettier. **Nie zmieniaj** `tests/unit/architecture.static.test.ts`.

**Podział pracy (CLAUDE.md, ekonomia tokenów):** Zadania 1 i 2 (logika domeny, TDD) robi Claude. Mechaniczne części zadań 3 i 4 (i18n, CSS, aktualizacja fixture'ów) może zrobić `cursor --role task --tier light`; Claude sprawdza `git diff`. Testy/lint/tsc: `/verify` (cursor, `--approve-allowed`). Końcowy review diffa: `agy --role review`. Pomocnicy muszą być żywymi sesjami (`open-agent`), bez `-p`.

## Mapa plików

| Plik                                                          | Zmiana                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `contexts/bc_calendar/models.ts`                              | `EventType`, `normalizeEventType`, typ `visit` w `CalendarEvent`/`CalendarEntry` |
| `contexts/bc_calendar/repositories/index.ts`                  | użycie `normalizeEventType` (odczyt, create, update), typy                       |
| `contexts/bc_calendar/router.ts`                              | użycie `normalizeEventType` (POST, PUT)                                          |
| `contexts/bc_calendar/services.ts`                            | typ `EventType` w sygnaturach                                                    |
| `contexts/bc_calendar/schemas.ts`                             | `CalendarEventDto.type` z `visit`                                                |
| `contexts/bc_cockpit/models.ts`                               | `DayEvent.type` z `visit`, `TomorrowVisit`, `Cockpit.tomorrowVisits`             |
| `contexts/bc_cockpit/services.ts`                             | `loadTomorrowVisits`, `getCockpit` dodaje pole                                   |
| `contexts/bc_cockpit/schemas.ts`                              | `TomorrowVisitDto`, mapowanie w `toCockpitDto`                                   |
| `src/lib/calendarConstants.ts`                                | `visit: 60`                                                                      |
| `src/features/calendar/CalendarEventForm.tsx`                 | opcja „Wizyta”, typ stanu                                                        |
| `src/features/calendar/CalendarView.tsx`                      | normalizacja typu przy edycji (`:429`)                                           |
| `src/features/calendar/calendarEventStyle.ts`, `calendar.css` | klasa `kal-ev--visit`                                                            |
| `src/features/home/CockpitSections.tsx`, `home.css`           | sekcja `kok-visit` przed `kok-urgent`                                            |
| `src/i18n/locales/{pl,en}/planning.ts`, `home.ts`             | etykiety                                                                         |
| testy (zob. zadania)                                          | nowe przypadki + aktualizacja fixture'ów `CockpitDto`/`Cockpit`                  |

---

### Task 1: Typ `visit` w `bc_calendar`

**Pliki:**

- Modyfikuj: `contexts/bc_calendar/models.ts`, `contexts/bc_calendar/repositories/index.ts`, `contexts/bc_calendar/router.ts`, `contexts/bc_calendar/services.ts`, `contexts/bc_calendar/schemas.ts`
- Testy: `tests/unit/contexts/bc_calendar/repositories.test.ts`, `tests/unit/contexts/bc_calendar/router.events.test.ts`, `tests/unit/contexts/bc_calendar/router.events-id.test.ts`

- [ ] **Krok 1: testy (czerwone)**

W `repositories.test.ts`, w `describe("createCalendarEvent")` zaraz po teście `6b`:

```ts
it("6c. keeps type visit; unknown type falls back to work", async () => {
  seed();
  const visit = await createCalendarEvent({ ...NEW, type: "visit" });
  expect(visit.type).toBe("visit");
  expect(readList(NOV, "events").at(-1)).toMatchObject({ id: visit.id, type: "visit" });
  const unknown = await createCalendarEvent({
    ...NEW,
    type: "foo" as unknown as "work",
  });
  expect(unknown.type).toBe("work");
});
```

W `describe("getCalendarEvents")` (na końcu bloku, przed zamykającym `});`):

```ts
it("reads type visit from the file as visit", async () => {
  writeEvents(NOV, [{ ...E2, id: "v1", type: "visit" }]);
  const events = await getCalendarEvents({ startDate: "2026-11-01", endDate: "2026-11-30" });
  expect(events.find((e) => e.id === "v1")?.type).toBe("visit");
});
```

W `describe("updateCalendarEvent")` na końcu bloku:

```ts
it("changes type work to visit and keeps other fields", async () => {
  seed();
  await updateCalendarEvent("e1", { type: "visit" });
  expect(readList(NOV, "events")[0]).toMatchObject({
    id: "e1",
    type: "visit",
    title: "Nocna sesja",
    x_note: "ręcznie",
  });
});
```

W `router.events-id.test.ts` zamień test „zachowuje meeting…” na:

```ts
it("zachowuje meeting i visit, nieznany typ zamienia na work, brak typu zostaje undefined", async () => {
  mockUpdateCalendarEvent.mockResolvedValue(undefined);
  await PUT(request("PUT", { type: "meeting" }), { params });
  await PUT(request("PUT", { type: "visit" }), { params });
  await PUT(request("PUT", { type: "foo" }), { params });
  await PUT(request("PUT", { title: "x" }), { params });
  expect(mockUpdateCalendarEvent.mock.calls.map((c) => c[1].type)).toEqual([
    "meeting",
    "visit",
    "work",
    undefined,
  ]);
});
```

W `router.events.test.ts` obok istniejącego testu z `type: "meeting"` (około linii 87) dodaj test w tym samym stylu (przeczytaj sąsiedni test i powtórz jego `post(...)`/asercje):

```ts
it("POST zachowuje typ visit", async () => {
  mockCreateCalendarEvent.mockResolvedValue({ ...EVENT, type: "visit" });
  const res = await POST(
    post({ date: "2026-11-13", start_minutes: 450, duration_minutes: 60, type: "visit" })
  );
  expect(res.status).toBe(200);
  expect(mockCreateCalendarEvent.mock.calls[0][0].type).toBe("visit");
  expect((await res.json()).type).toBe("visit");
});
```

- [ ] **Krok 2: uruchom, zobacz czerwone**

Run: `npx vitest run tests/unit/contexts/bc_calendar`
Expected: FAIL (`visit` jest normalizowane do `work`; `tsc` jeszcze nie sprawdzamy).

- [ ] **Krok 3: implementacja**

`contexts/bc_calendar/models.ts`: nad `CalendarEvent` dodaj

```ts
/** Typ zapisanego wydarzenia; każda inna wartość w pliku lub w żądaniu jest czytana jako `work`. */
export type EventType = "work" | "meeting" | "visit";

export function normalizeEventType(value: unknown): EventType {
  return value === "meeting" || value === "visit" ? value : "work";
}
```

oraz `type: "work" | "meeting";` → `type: EventType;`, a w `CalendarEntry` `type: "work" | "meeting" | "task_deadline";` → `type: EventType | "task_deadline";`.

`contexts/bc_calendar/repositories/index.ts`: do importu z `"../models"` dodaj `normalizeEventType` i `type EventType` (import ma postać `import type { CalendarEvent } from "../models";`: zamień na `import { normalizeEventType, type CalendarEvent, type EventType } from "../models";`). Zamień:

- `type: r.type === "meeting" ? "meeting" : "work",` → `type: normalizeEventType(r.type),`
- `type?: "work" | "meeting";` (w `createCalendarEvent`) → `type?: EventType;`
- `type: data.type === "meeting" ? "meeting" : "work",` → `type: normalizeEventType(data.type),`
- `type: "work" | "meeting";` (w `Partial<{…}>` update) → `type: EventType;`
- `if (data.type !== undefined) patch.type = data.type === "meeting" ? "meeting" : "work";` → `if (data.type !== undefined) patch.type = normalizeEventType(data.type);`

`contexts/bc_calendar/router.ts`: dodaj import `import { normalizeEventType } from "./models";` i zamień

- `type: type === "meeting" ? "meeting" : "work",` → `type: normalizeEventType(type),`
- `type: body.type !== undefined ? (body.type === "meeting" ? "meeting" : "work") : undefined,` → `type: body.type !== undefined ? normalizeEventType(body.type) : undefined,`

`contexts/bc_calendar/services.ts`: `import type { CalendarEntry } from "./models";` → `import type { CalendarEntry, EventType } from "./models";`, oba `"work" | "meeting"` (`type?:` i `type:`) → `EventType`.

`contexts/bc_calendar/schemas.ts:46`: `type: "work" | "meeting" | "task_deadline";` → `type: "work" | "meeting" | "visit" | "task_deadline";`.

- [ ] **Krok 4: zielone**

Run: `npx vitest run tests/unit/contexts/bc_calendar tests/unit/architecture.static.test.ts`
Expected: PASS (jeśli test architektury protestuje przeciw funkcji w `models.ts`, przenieś `normalizeEventType` do `contexts/bc_calendar/repositories/type.ts` dla repozytorium i do `schemas.ts` dla routera, nie ruszając testu).

Run: `npx tsc --noEmit` → Expected: błędy tylko w `bc_cockpit`/UI (typ `visit` jeszcze niezaakceptowany dalej); jeśli są inne, napraw.

- [ ] **Krok 5: commit**

```bash
git add contexts/bc_calendar tests/unit/contexts/bc_calendar
git commit -m "feat(calendar): typ wydarzenia visit (wizyta)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `tomorrowVisits` w `bc_cockpit`

**Pliki:**

- Modyfikuj: `contexts/bc_cockpit/models.ts`, `contexts/bc_cockpit/services.ts`, `contexts/bc_cockpit/schemas.ts`
- Testy: `tests/unit/contexts/bc_cockpit/services.test.ts`, `schemas.test.ts`, `router.test.ts`, `tests/unit/features/home/HomeView.test.tsx`, `HomeView.en.test.tsx` (fixture'y)

- [ ] **Krok 1: testy (czerwone)**

W `services.test.ts` dodaj `describe` po bloku „następne spotkanie” (`cal(...)` jest pomocnikiem zdefiniowanym wyżej w pliku, używanym przez testy z `future`: przeczytaj jego sygnaturę `cal(date, over)` i użyj go; poniżej ten sam kształt rekordu):

```ts
describe("jutrzejsze wizyty (tomorrowVisits)", () => {
  const entry = (date: string, over: Partial<CalendarEntry> = {}): CalendarEntry => ({
    id: `id-${date}-${over.title ?? "x"}`,
    date,
    start_minutes: 450,
    duration_minutes: 60,
    title: "Wizyta u kardiologa",
    tags: [],
    color: "#3B82F6",
    type: "visit",
    ...over,
  });

  it("jutrzejsza wizyta trafia do tomorrowVisits, posortowana po godzinie", async () => {
    mockGetCalendarEvents.mockImplementation(async (r = {}) =>
      r.startDate === "2026-11-14" && r.endDate === "2026-11-14"
        ? [
            entry("2026-11-14", { title: "Dentysta", start_minutes: 540 }),
            entry("2026-11-14", { title: "Kardiolog", start_minutes: 450 }),
          ]
        : []
    );
    const { tomorrowVisits } = await getCockpit(TODAY);
    expect(tomorrowVisits).toEqual([
      { id: "id-2026-11-14-Kardiolog", title: "Kardiolog", startMinutes: 450, durationMinutes: 60 },
      { id: "id-2026-11-14-Dentysta", title: "Dentysta", startMinutes: 540, durationMinutes: 60 },
    ]);
  });

  it("wizyta dziś, pojutrze, spotkanie i praca jutro nie trafiają do tomorrowVisits", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      entry("2026-11-13", { title: "Dziś" }),
      entry("2026-11-15", { title: "Pojutrze" }),
      entry("2026-11-14", { title: "Spotkanie", type: "meeting" }),
      entry("2026-11-14", { title: "Praca", type: "work" }),
      entry("2026-11-14", { title: "Termin", type: "task_deadline" }),
    ]);
    expect((await getCockpit(TODAY)).tomorrowVisits).toEqual([]);
  });

  it("granica miesiąca i roku: 31.12 widzi wizytę z 1.01", async () => {
    mockGetCalendarEvents.mockImplementation(async (r = {}) =>
      r.startDate === "2027-01-01" ? [entry("2027-01-01", { title: "Noworoczna" })] : []
    );
    const { tomorrowVisits } = await getCockpit(new Date(2026, 11, 31, 10, 0));
    expect(tomorrowVisits.map((v) => v.title)).toEqual(["Noworoczna"]);
  });

  it("wizyta nie zmienia nextMeeting ani liczby spotkań", async () => {
    mockGetCalendarEvents.mockResolvedValue([entry("2026-11-14")]);
    const result = await getCockpit(TODAY);
    expect(result.nextMeeting).toBeNull();
    expect(result.events).toEqual([]);
  });

  it("dzisiejsza wizyta jest na osi dnia (type visit), ale nie w tomorrowVisits", async () => {
    mockGetCalendarEvents.mockImplementation(async (r = {}) =>
      r.startDate === "2026-11-13" && r.endDate === "2026-11-13"
        ? [entry("2026-11-13", { title: "Dziś" })]
        : []
    );
    const result = await getCockpit(TODAY);
    expect(result.events.map((e) => [e.title, e.type])).toEqual([["Dziś", "visit"]]);
    expect(result.tomorrowVisits).toEqual([]);
  });

  it("awaria kalendarza: pusta lista i jedno ostrzeżenie", async () => {
    mockGetCalendarEvents.mockRejectedValue(new Error("boom"));
    const result = await getCockpit(TODAY);
    expect(result.tomorrowVisits).toEqual([]);
    expect(result.warnings).toEqual(["Kalendarz: boom"]);
  });
});
```

(`CalendarEntry` jest już importowane na górze pliku.)

W istniejącym teście „getCockpit podaje nextMeeting z godziny „dziś”” (około linii 493) zamień
`expect(mockGetCalendarEvents).toHaveBeenCalledTimes(1);` na:

```ts
// dzisiejsze spotkanie wystarcza: kalendarz nie jest pytany o 60 dni naprzód
expect(mockGetCalendarEvents).not.toHaveBeenCalledWith({
  startDate: "2026-11-14",
  endDate: "2027-01-12",
});
```

W `schemas.test.ts`: do obiektu `model` (przed `git:`) dodaj `tomorrowVisits: [{ id: "v1", title: "Kardiolog", startMinutes: 450, durationMinutes: 60 }],`, a na posortowaną listę kluczy dodaj `"tomorrowVisits"` (alfabetycznie między `"topics"` a `"warnings"`: kolejność `…"queue", "tomorrowVisits", "topics", "warnings"…`; `sort()` ułoży `tomorrowVisits` przed `topics`, bo `m` < `p`). W `router.test.ts` (dwa obiekty) dodaj `tomorrowVisits: [],` po `nextMeeting: null,`. W `HomeView.test.tsx` (`EMPTY`, `FULL` i każdy literał pełnego `CockpitDto` bez spreadu) oraz `HomeView.en.test.tsx` dodaj `tomorrowVisits: [],` po `nextMeeting…` (literały rozszerzające `...FULL`/`...EMPTY` już dziedziczą pole).

- [ ] **Krok 2: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_cockpit`
Expected: FAIL (`tomorrowVisits` is undefined).

- [ ] **Krok 3: implementacja**

`contexts/bc_cockpit/models.ts`:

- w `DayEvent`: `type: "work" | "meeting";` → `type: "work" | "meeting" | "visit";`
- po `NextMeeting` dodaj

```ts
/** Wizyta (typ `visit`) z jutrzejszego dnia: przypomnienie w Kokpicie z wyprzedzeniem jednego dnia. */
export type TomorrowVisit = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
};
```

- w `Cockpit` po `nextMeeting: NextMeeting | null;` dodaj `/** Wizyty z jutra, od najwcześniejszej; puste, gdy brak albo kalendarz zawiódł (jest wtedy ostrzeżenie). */ tomorrowVisits: TomorrowVisit[];`

`contexts/bc_cockpit/services.ts`: dodaj `type TomorrowVisit` do importu typów z `./models`. Po `loadUpcomingMeeting` dodaj:

```ts
/** Wizyty (`visit`) z jutrzejszego dnia, od najwcześniejszej; awaria kalendarza daje `[]` i jedno ostrzeżenie. */
async function loadTomorrowVisits(today: Date, warnings: string[]): Promise<TomorrowVisit[]> {
  const tomorrow = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  try {
    const entries = await calendarServices.getCalendarEvents({
      startDate: tomorrow,
      endDate: tomorrow,
    });
    return entries
      .filter((e) => e.type === "visit" && e.date === tomorrow)
      .sort((a, b) => a.start_minutes - b.start_minutes)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startMinutes: e.start_minutes,
        durationMinutes: e.duration_minutes,
      }));
  } catch (err) {
    const message = `Kalendarz: ${reason(err)}`;
    if (!warnings.includes(message)) warnings.push(message);
    return [];
  }
}
```

W `getCockpit`, po `nextMeeting`: `const tomorrowVisits = await loadTomorrowVisits(today, warnings);` i dodaj `tomorrowVisits,` w zwracanym obiekcie po `nextMeeting,`.

`contexts/bc_cockpit/schemas.ts`: obok `DayEventDto` dodaj `export type TomorrowVisitDto = TomorrowVisit;` (dodaj `TomorrowVisit` do importu typów) i w `toCockpitDto` po `nextMeeting: …` dodaj

```ts
    tomorrowVisits: c.tomorrowVisits.map((v) => ({
      id: v.id,
      title: v.title,
      startMinutes: v.startMinutes,
      durationMinutes: v.durationMinutes,
    })),
```

- [ ] **Krok 4: zielone**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/boundaries tests/unit/features/home tests/unit/architecture.static.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit` → Expected: bez błędów w `contexts/**` (UI może jeszcze zgłaszać brak `visit` w formularzu: naprawia Task 3).

- [ ] **Krok 5: commit**

```bash
git add contexts/bc_cockpit tests/unit
git commit -m "feat(kokpit): tomorrowVisits, jutrzejsze wizyty z kalendarza" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wizyta w formularzu i w kalendarzu (UI)

**Pliki:**

- Modyfikuj: `src/lib/calendarConstants.ts`, `src/features/calendar/CalendarEventForm.tsx`, `src/features/calendar/CalendarView.tsx`, `src/features/calendar/calendarEventStyle.ts`, `src/features/calendar/calendar.css`, `src/i18n/locales/pl/planning.ts`, `src/i18n/locales/en/planning.ts`
- Testy: `tests/unit/features/calendar/CalendarEventForm.test.tsx`; nowy `tests/unit/features/calendar/calendarEventStyle.test.ts`

- [ ] **Krok 1: testy (czerwone)**

Do `CalendarEventForm.test.tsx` dodaj `describe` (etykieta pola to „Typ wydarzenia”, polska):

```tsx
describe("CalendarEventForm: typ wizyta", () => {
  test("opcja „Wizyta” ustawia typ visit i domyślne 60 min", () => {
    const onSubmit = vi.fn();
    render(
      <CalendarEventForm
        initial={{ date: "2026-12-07", title: "Kardiolog", type: "meeting" }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText("Typ wydarzenia"), { target: { value: "visit" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj wpis" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: "visit", duration_minutes: 60 });
  });

  test("istniejąca wizyta otwiera się z typem Wizyta", () => {
    render(
      <CalendarEventForm
        initial={{ date: "2026-12-07", title: "Kardiolog", type: "visit" }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText("Typ wydarzenia")).toHaveValue("visit");
    expect(screen.getByRole("option", { name: "Wizyta" })).toBeInTheDocument();
  });
});
```

Jeśli `getByLabelText("Typ wydarzenia")` nie znajdzie selecta (etykieta bez `htmlFor`), użyj `screen.getByRole("combobox", { name: /Typ wydarzenia/ })` albo, gdy w formularzu jest więcej comboboxów, `container.querySelector("select.kal-select")` z odpowiednim indeksem; sprawdź w pliku formularza (`:158-178`).

Nowy plik `tests/unit/features/calendar/calendarEventStyle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventModifier } from "@/src/features/calendar/calendarEventStyle";
import type { CalendarEvent } from "@/src/features/calendar/calendarUtils";

const ev = (over: Partial<CalendarEvent>): CalendarEvent =>
  ({
    id: "e",
    date: "2026-12-07",
    start_minutes: 450,
    duration_minutes: 60,
    title: "T",
    tags: [],
    color: "#3B82F6",
    type: "work",
    ...over,
  }) as CalendarEvent;

describe("eventModifier", () => {
  it("visit ma własną klasę, meeting i work jak dotąd", () => {
    expect(eventModifier(ev({ type: "visit" }))).toBe("kal-ev--visit");
    expect(eventModifier(ev({ type: "meeting" }))).toBe("kal-ev--meeting");
    expect(eventModifier(ev({ type: "work" }))).toBe("");
  });

  it("tag etat i termin zadania mają pierwszeństwo przed typem", () => {
    expect(eventModifier(ev({ type: "visit", tags: ["Etat"] }))).toBe("kal-ev--etat");
    expect(eventModifier(ev({ type: "task_deadline" }))).toBe("kal-ev--deadline");
  });
});
```

(Przed pisaniem sprawdź `CalendarEvent` w `src/features/calendar/calendarUtils.ts`; jeśli typ ma inne wymagane pola, uzupełnij fabrykę `ev`.)

- [ ] **Krok 2: czerwone**

Run: `npx vitest run tests/unit/features/calendar`
Expected: FAIL (brak opcji „Wizyta”; `eventModifier` zwraca `""` dla visit).

- [ ] **Krok 3: implementacja** (mechaniczne: może wykonać `cursor --role task`)

- `src/lib/calendarConstants.ts`: `Record<"work" | "meeting", number>` → `Record<"work" | "meeting" | "visit", number>` i dodaj `visit: 60,`.
- `src/features/calendar/CalendarEventForm.tsx`: wszystkie trzy wystąpienia `"work" | "meeting"` (`type:` w `CalendarEventFormData`, `useState<…>` i `as …` w `onChange`) → `"work" | "meeting" | "visit"`; po opcji meeting dodaj `<option value="visit">{t("planning:calendarFormTypeVisit")}</option>`.
- `src/features/calendar/CalendarView.tsx:429`: `type: editingEvent.type === "meeting" ? "meeting" : "work",` → `type: editingEvent.type === "meeting" || editingEvent.type === "visit" ? editingEvent.type : "work",`.
- `src/features/calendar/calendarEventStyle.ts`: po linii z `meeting` dodaj `if (ev.type === "visit") return "kal-ev--visit";`.
- `src/features/calendar/calendar.css`: po regule `.kal-ev--meeting` dodaj

```css
.kal-ev--visit {
  border-left-color: var(--ok) !important;
}
```

- `src/i18n/locales/pl/planning.ts`: po `calendarFormTypeMeeting` dodaj `calendarFormTypeVisit: "Wizyta",`; `en/planning.ts`: `calendarFormTypeVisit: "Visit",`.

- [ ] **Krok 4: zielone**

Run: `npx vitest run tests/unit/features/calendar tests/unit/i18n` (jeśli katalog `tests/unit/i18n` nie istnieje, pomiń; chodzi o ewentualny test zgodności kluczy pl/en)
Expected: PASS.

Run: `npx tsc --noEmit` → Expected: bez błędów.

- [ ] **Krok 5: commit**

```bash
git add src tests/unit/features/calendar
git commit -m "feat(kalendarz): typ Wizyta w formularzu i na siatce" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sekcja „Jutro · wizyta” w Kokpicie

**Pliki:**

- Modyfikuj: `src/features/home/CockpitSections.tsx` (przed `{urgentEntries.length > 0 ? (`, około `:532`), `src/features/home/home.css`, `src/i18n/locales/pl/home.ts`, `src/i18n/locales/en/home.ts`
- Testy: `tests/unit/features/home/HomeView.test.tsx`, `HomeView.en.test.tsx`

- [ ] **Krok 1: testy (czerwone)**

W `HomeView.test.tsx`, obok testów o „Pilne” (okolice `:1493`):

```tsx
test("jutrzejsza wizyta: sekcja „Jutro” jest nad „Pilne” i pokazuje godzinę oraz czas", async () => {
  respond({
    ...EMPTY,
    tomorrowVisits: [
      { id: "v1", title: "Wizyta u kardiologa", startMinutes: 450, durationMinutes: 60 },
    ],
    queue: [
      {
        projectId: null,
        name: "Ogólne",
        owner: "personal",
        items: [
          {
            kind: "undated",
            title: "Zadzwonić do banku",
            due: null,
            projectName: null,
            priority: null,
            energy: null,
            urgent: true,
            source: { type: "task", taskId: "t-pilne" },
          },
        ],
      },
    ],
  });
  render(<HomeView {...defaultProps} />);
  const visit = await screen.findByRole("region", { name: "Jutro: wizyta" });
  expect(within(visit).getByText("07:30")).toBeInTheDocument();
  expect(within(visit).getByText("Wizyta u kardiologa")).toBeInTheDocument();
  expect(within(visit).getByText("60 min")).toBeInTheDocument();
  const urgent = screen.getByRole("region", { name: "Pilne" });
  expect(visit.compareDocumentPosition(urgent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("jutrzejsza wizyta bez pilnych zadań: sekcja nadal się pokazuje", async () => {
  respond({
    ...EMPTY,
    tomorrowVisits: [{ id: "v1", title: "Dentysta", startMinutes: 480, durationMinutes: 60 }],
  });
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByRole("region", { name: "Jutro: wizyta" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Pilne" })).not.toBeInTheDocument();
});

test("brak jutrzejszych wizyt: sekcji „Jutro: wizyta” nie ma", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByRole("region", { name: "Kolejka na dziś" });
  expect(screen.queryByRole("region", { name: "Jutro: wizyta" })).not.toBeInTheDocument();
});
```

W `HomeView.en.test.tsx` jeden test analogiczny do pierwszego (bez „Pilne”): `respond({ ...EMPTY, tomorrowVisits: [...] })` (użyj sposobu renderu i nazwy fixture'a z tego pliku, czyli tego, którym tworzone są tam inne testy) i oczekuj regionu `{ name: "Tomorrow: visit" }` oraz tekstu `"07:30"`.

- [ ] **Krok 2: czerwone**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx tests/unit/features/home/HomeView.en.test.tsx`
Expected: FAIL (brak regionu).

- [ ] **Krok 3: implementacja**

`src/i18n/locales/pl/home.ts` w sekcji `cockpit`, po `urgentSub`:

```ts
    visitAria: "Jutro: wizyta",
    visitBold: "Jutro",
    visitSub: "wizyta",
```

`en/home.ts`:

```ts
    visitAria: "Tomorrow: visit",
    visitBold: "Tomorrow",
    visitSub: "visit",
```

`CockpitSections.tsx`, tuż przed `{urgentEntries.length > 0 ? (`:

```tsx
{
  data.tomorrowVisits.length > 0 ? (
    <section className="kok-visit" aria-label={t("home:cockpit.visitAria")}>
      <h3 className="kok-visit__title">
        <b>{t("home:cockpit.visitBold")}</b> · {t("home:cockpit.visitSub")}
      </h3>
      <ul className="kok-visit__list">
        {data.tomorrowVisits.map((v) => (
          <li key={v.id} className="kok-visit__item">
            <span className="kok-visit__time">{hhmm(v.startMinutes)}</span>
            <span className="kok-visit__name">{v.title}</span>
            <span className="kok-visit__dur">
              {t("home:cockpit.durationMin", { count: v.durationMinutes })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
```

(`hhmm` jest już importowane z `./cockpitFormat`.)

`src/features/home/home.css`, po regułach `.kok-urgent*` (po `:1342`):

```css
/* Jutro: wizyty (typ visit), nad blokiem „Pilne” */
.kok-visit {
  background: color-mix(in srgb, var(--ok) 7%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--ok) 55%, var(--line));
  border-left: 3px solid var(--ok);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-4);
  margin-bottom: var(--s-4);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.kok-visit__title {
  margin: 0;
  font: 600 var(--fs-xs) / 1.2 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--muted);
}

.kok-visit__title b {
  color: var(--ok);
}

.kok-visit__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.kok-visit__item {
  display: flex;
  align-items: baseline;
  gap: var(--s-3);
}

.kok-visit__time {
  font: 600 var(--fs-sm) / 1.2 var(--font-mono);
  color: var(--ok);
}

.kok-visit__dur {
  margin-left: auto;
  font: 500 var(--fs-xs) / 1.2 var(--font-mono);
  color: var(--muted);
}
```

(Jeśli któraś ze zmiennych `--fs-sm`, `--s-3` nie istnieje w `home.css`, użyj tych, które ma sąsiednia reguła `.kok-urgent__title` / `.kok-list__item`.)

- [ ] **Krok 4: zielone**

Run: `npx vitest run tests/unit/features/home`
Expected: PASS.

- [ ] **Krok 5: commit**

```bash
git add src tests/unit/features/home
git commit -m "feat(kokpit): sekcja Jutro, wizyta nad blokiem Pilne" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Weryfikacja, review, PR

- [ ] **Krok 1:** `/verify build` (cursor: `tsc --noEmit`, `vitest run`, `lint`, `build`). Oczekiwane: wszystkie pozycje `PRZESZŁO`, każda `exit 0`. Pełny output czytam tylko przy porażce.
- [ ] **Krok 2:** `git diff --stat main...HEAD`: zmiany tylko w plikach z mapy; `tests/unit/architecture.static.test.ts` bez zmian.
- [ ] **Krok 3:** niezależny review diffa: `scripts/ask-helper.sh --role review agy "Zrecenzuj git diff main...HEAD (Monolith, gałąź feat/kalendarz-typ-wizyta): typ wydarzenia visit w bc_calendar i pole tomorrowVisits w bc_cockpit + sekcja kok-visit. Sprawdź zgodność ze specem docs/superpowers/specs/2026-11-25-kalendarz-typ-wizyta-design.md, granice kontekstów (ADR-021), granicę daty (jutro, 31.12→1.01), regresje dla meeting/work. Odpowiedz listą plik:linia + problem albo GOTOWE: brak uwag."`. Opinie są hipotezami: weryfikuj w kodzie.
- [ ] **Krok 4:** PR (`git push -u origin feat/kalendarz-typ-wizyta`, `gh pr create`) tylko na prośbę użytkownika; opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### Task 6: Dane w vaulcie (po merge'u do `main` i restarcie aplikacji ze skrótu)

Dopiero gdy działa build z `visit` (port 3101; ikona sama przebuduje po merge'u):

- [ ] `PUT http://127.0.0.1:3101/api/calendar/events/SfqCY9dkuVxsVlUR6SCJ` z `{"type":"visit"}` (nagłówek `X-Nexus-Client: 1`, ciało przez heredoc `<<'JSON'`); sprawdź `GET …?startDate=2026-12-07&endDate=2026-12-07` → `type: "visit"`.
- [ ] Po zgodzie użytkownika na treść zapisu: `POST` wizyty u dentysty `{"date":"2027-01-28","start_minutes":480,"duration_minutes":60,"title":"Wizyta u dentysty","tags":["prywatny"],"color":"#3B82F6","type":"visit"}`.
- [ ] Sprawdź w przeglądarce (Alt+1 Kokpit): w dniu 6.12 sekcja „Jutro · wizyta” pokazuje kardiologa (można zasymulować, zmieniając tymczasowo datę testowej wizyty w kopii vaulta, nie w prawdziwym).

## Samoprzegląd planu względem specu

- §3 `bc_calendar` → Task 1; `bc_cockpit` (model, service, DTO) → Task 2; UI (formularz, stała 60 min, `CalendarView`, styl, sekcja Kokpitu, i18n pl/en) → Tasks 3–4.
- §5 testy → każdy przypadek ze specu ma test: zapis/odczyt/PUT/nieznany typ (Task 1), jutro/dziś/pojutrze/meeting/kolejność/31.12/nextMeeting/błąd kalendarza/DTO (Task 2), formularz 60 min i opcja (Task 3), kolejność przed „Pilne”, brak wizyt, brak pilnych (Task 4).
- §6 migracja danych → Task 6. §4 prywatność: bez zmian w `Work/`, test architektury nietknięty.
- Spójność nazw: `EventType`, `normalizeEventType`, `TomorrowVisit`, `tomorrowVisits`, `loadTomorrowVisits`, klasy `kal-ev--visit`, `kok-visit*`, klucze i18n `calendarFormTypeVisit`, `cockpit.visitAria|visitBold|visitSub`.
