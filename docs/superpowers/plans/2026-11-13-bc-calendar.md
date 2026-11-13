# PR 5: `bc_calendar` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przenieść domenę zdarzeń kalendarza do `contexts/bc_calendar/` razem z UI kalendarza (`src/features/calendar/`) i wspólnym UI sesji (`src/components/sessions/`), bez zmiany zachowania.

**Architecture:** Wzór: PR 4 (`contexts/bc_tasks/`, #27). Kierunek `app/api/**/route.ts` (re-eksport) → `router` → `services` → `repositories/` → `lib/nexus`. `lib/calendarRange.ts` znika: pomocniki zakresu dla repozytorium idą do `repositories/range.ts`, a `eventMinutesInInclusiveRange` (jedyny konsument: `ActivityLog`) do `src/components/sessions/activityRange.ts`. Trzy commity w kolejności wymuszonej zależnościami: sessions → backend → UI kalendarza.

**Tech Stack:** Next.js 14, TypeScript, zod, vitest, `lib/nexus` (vault Markdown/YAML).

Spec: `docs/superpowers/specs/2026-11-13-bc-calendar-design.md`. Plan doprecyzowuje spec bez zmiany zakresu: `services.ts` dostaje typy z `models` (`CalendarEvent`, `CalendarEntry`), router mapuje wynik przez `toCalendarEventDto(entry: CalendarEntry)`, testy tras w dwóch plikach z sufiksem (`router.events.test.ts`, `router.events-id.test.ts`).

## Zasady wykonania

- Wszystkie komendy z katalogu `~/projects/Brain_7224/Monolith`. Gałąź: zmień nazwę obecnej `docs/pr-5-bc-calendar-spec` na `feat/pr-5-bc-calendar` (`git branch -m feat/pr-5-bc-calendar`); spec i plan są jej pierwszymi commitami, jak w PR 4.
- **Testów, lintu, tsc i builda nie uruchamiam w swoim kontekście**: zlecam `scripts/ask-helper.sh --role task cursor "<komenda> ... odpowiedz: przeszło albo lista plik:linia + przyczyna"` (CLAUDE.md, ekonomia tokenów). Pełny output czytam tylko, gdy podsumowanie nie wystarcza.
- Test architektury (`tests/unit/architecture.static.test.ts`) i jego baseline **nie są zmieniane**. Pęknięcie naprawia się kodem.
- **Trzy commity, każdy zielony** (`tsc`, `vitest`, `lint`, `build`): zadanie 1 = commit A (sessions), zadania 2–5 = commit B (backend, jeden commit po zadaniu 5, bo między zadaniami `tsc` i część testów jest celowo czerwona), zadanie 6 = commit C (UI kalendarza).
- Testy kontekstu (`tests/unit/contexts/**`) mają `// @vitest-environment node` (spec struktury §4).
- Router importuje tylko `services` i `schemas` (R3: `LAYER_ALLOWED.router`), więc typy w `router.ts` biorę ze `schemas`, nigdy z `models`.
- Przenosimy przez `git mv`, żeby zachować historię.
- Dyrektywa `sed` w krokach zakłada GNU sed (WSL).

## Mapa plików

Tworzone:

- `contexts/bc_calendar/models.ts`: `CalendarEvent`, `CalendarEntry`
- `contexts/bc_calendar/schemas.ts`: zod wejścia, `CalendarEventDto`, `toCalendarEventDto`
- `contexts/bc_calendar/repositories/range.ts`: pomocniki zakresu dat (z `lib/calendarRange.ts`)
- `contexts/bc_calendar/router.ts`: 4 handlery HTTP
- `src/components/sessions/activityRange.ts`: `eventMinutesInInclusiveRange` (z `lib/calendarRange.ts`)
- testy: `tests/unit/contexts/bc_calendar/router.events.test.ts`, `router.events-id.test.ts`, `tests/unit/components/sessions/activityRange.test.ts`

Przenoszone (`git mv`):

- `lib/nexus/repos/calendarEvents.ts` → `contexts/bc_calendar/repositories/index.ts`
- `services/calendarService.ts` → `contexts/bc_calendar/services.ts`
- `src/components/{ActivityLog,StartSessionModal}.tsx`, `src/lib/activeSession.ts` → `src/components/sessions/`
- `src/components/{CalendarView,CalendarEventForm}.tsx`, `src/components/calendar/*` → `src/features/calendar/` (płasko)
- testy: `tests/unit/lib/nexus/repos/calendarEvents.test.ts` → `tests/unit/contexts/bc_calendar/repositories.test.ts`; `tests/unit/lib/calendarRange.test.ts` → `tests/unit/contexts/bc_calendar/repositories.range.test.ts`; `tests/unit/services/calendarService.test.ts` → `tests/unit/contexts/bc_calendar/services.test.ts`; `tests/unit/lib/activeSession.test.ts` → `tests/unit/components/sessions/activeSession.test.ts`; `tests/unit/components/CalendarView.test.tsx` → `tests/unit/features/calendar/CalendarView.test.tsx`

Usuwane: `lib/validation/calendarEvents.ts`, `lib/calendarRange.ts`.

Modyfikowane: `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`, `lib/firestore-db.ts`, `types/index.ts`, `types/records.ts`, `tests/unit/lib/nexus/repos-static.test.ts`, `tests/unit/no-user-id.static.test.ts`, `tests/unit/features/home/HomeView.test.tsx`, `src/features/home/HomeView.tsx`, `src/features/planowanie/PlanowanieView.tsx`.

---

### Task 1: Commit A, sessions → `src/components/sessions/`

**Files:** `src/components/{ActivityLog,StartSessionModal}.tsx`, `src/lib/activeSession.ts`, nowy `src/components/sessions/activityRange.ts`, `lib/calendarRange.ts`, testy (lista w „Mapa plików”).

- [ ] **Step 1: Czerwone testy w nowych lokalizacjach**

```bash
mkdir -p tests/unit/components/sessions
git mv tests/unit/lib/activeSession.test.ts tests/unit/components/sessions/activeSession.test.ts
sed -i 's#"@/src/lib/activeSession"#"@/src/components/sessions/activeSession"#' tests/unit/components/sessions/activeSession.test.ts
sed -i 's#vi.mock("@/src/components/ActivityLog"#vi.mock("@/src/components/sessions/ActivityLog"#' tests/unit/features/home/HomeView.test.tsx
sed -i 's#"src/lib/activeSession.ts"#"src/components/sessions/activeSession.ts"#' tests/unit/no-user-id.static.test.ts
```

Wydziel testy `eventMinutesInInclusiveRange` (linie 66–100 `tests/unit/lib/calendarRange.test.ts`, bez zmiany asercji) do nowego pliku:

```bash
{
  printf 'import { describe, it, expect } from "vitest";\nimport { eventMinutesInInclusiveRange } from "@/src/components/sessions/activityRange";\n\ndescribe("sessions/activityRange", () => {\n'
  sed -n '66,100p' tests/unit/lib/calendarRange.test.ts
  printf '});\n'
} > tests/unit/components/sessions/activityRange.test.ts
sed -i '65,100d' tests/unit/lib/calendarRange.test.ts
sed -i '/eventMinutesInInclusiveRange,/d' tests/unit/lib/calendarRange.test.ts
tail -4 tests/unit/lib/calendarRange.test.ts
```

Expected: ostatnie linie to `  });` i `});` (koniec bloku `eventOverlapsInclusiveRange`), w pliku nie ma już `eventMinutesInInclusiveRange`.

- [ ] **Step 2: Uruchom i potwierdź czerwone**

Zlecić cursorowi: `npx vitest run tests/unit/components/sessions tests/unit/features/home tests/unit/no-user-id.static.test.ts`.
Expected: FAIL (brak modułów `@/src/components/sessions/*`; `no-user-id` nie znajduje `src/components/sessions/activeSession.ts`).

- [ ] **Step 3: Przenieś pliki**

```bash
mkdir -p src/components/sessions
git mv src/components/ActivityLog.tsx src/components/StartSessionModal.tsx src/components/sessions/
git mv src/lib/activeSession.ts src/components/sessions/activeSession.ts
```

- [ ] **Step 4: Utwórz `src/components/sessions/activityRange.ts`**

Kod UI używany przez moduł sesji (spec §5.1), bez importów z `lib/` i kontekstów. Pomocniki są prywatne; semantyka identyczna z dawnym `lib/calendarRange.ts`:

```ts
/** Minuty sesji w zakresie dni (lokalny kalendarz, bez przesunięcia UTC dla YYYY-MM-DD). */

const MS_PER_MIN = 60_000;
const MINS_PER_DAY = 24 * 60;

function parseLocalMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

function eventStartMs(ev: { date: string; start_minutes: number }): number {
  return parseLocalMidnight(ev.date) + ev.start_minutes * MS_PER_MIN;
}

function eventEndMs(ev: { date: string; start_minutes: number; duration_minutes: number }): number {
  return eventStartMs(ev) + ev.duration_minutes * MS_PER_MIN;
}

/** Minutes of the event that fall inside [rangeStart 00:00, rangeEnd+1day). */
export function eventMinutesInInclusiveRange(
  ev: { date: string; start_minutes: number; duration_minutes: number },
  rangeStart: string,
  rangeEnd: string
): number {
  if (ev.duration_minutes <= 0) return 0;
  const rs = parseLocalMidnight(rangeStart);
  const reEx = parseLocalMidnight(rangeEnd) + MINS_PER_DAY * MS_PER_MIN;
  if (Number.isNaN(rs) || Number.isNaN(reEx) || reEx <= rs) return 0;
  const evS = eventStartMs(ev);
  const evE = eventEndMs(ev);
  const overlapStart = Math.max(evS, rs);
  const overlapEnd = Math.min(evE, reEx);
  if (overlapStart >= overlapEnd) return 0;
  return Math.round((overlapEnd - overlapStart) / MS_PER_MIN);
}
```

- [ ] **Step 5: Usuń `eventMinutesInInclusiveRange` z `lib/calendarRange.ts`**

```bash
sed -i '41,58d' lib/calendarRange.ts
tail -4 lib/calendarRange.ts
```

Expected: plik kończy się klamrą funkcji `eventOverlapsInclusiveRange` (`  return evStart < reEx && evEnd > rs;` i `}`); `lib/calendarRange.ts` ma 40 linii. (`lib/calendarRange.ts` zniknie całkiem w zadaniu 5.)

- [ ] **Step 6: Przepnij importy**

```bash
sed -i 's#"@/src/lib/activeSession"#"@/src/components/sessions/activeSession"#' \
  src/components/sessions/ActivityLog.tsx src/components/CalendarView.tsx \
  src/components/calendar/CalendarDayColumn.tsx src/features/home/HomeView.tsx \
  src/features/planowanie/PlanowanieView.tsx
sed -i 's#"@/src/components/ActivityLog"#"@/src/components/sessions/ActivityLog"#g; s#"@/src/components/StartSessionModal"#"@/src/components/sessions/StartSessionModal"#' \
  src/features/home/HomeView.tsx src/features/planowanie/PlanowanieView.tsx
sed -i 's#from "\./StartSessionModal"#from "@/src/components/sessions/StartSessionModal"#' src/components/CalendarView.tsx
sed -i 's#import { eventMinutesInInclusiveRange } from "@/lib/calendarRange";#import { eventMinutesInInclusiveRange } from "./activityRange";#' src/components/sessions/ActivityLog.tsx
grep -rn "src/lib/activeSession\|components/ActivityLog\|components/StartSessionModal\|\./StartSessionModal\|@/lib/calendarRange" --include=*.ts --include=*.tsx src app tests lib contexts services | grep -v "^lib/nexus/repos/calendarEvents.ts" || echo "brak starych ścieżek"
```

Expected: `brak starych ścieżek` (repozytorium `lib/nexus/repos/calendarEvents.ts` nadal importuje `@/lib/calendarRange`, to zadanie 3). Obie wystąpienia `ActivityLog` w `PlanowanieView.tsx` (typ w `ComponentProps<typeof import(...)>` i fabryka `import(...)`) obsługuje flaga `g`.

- [ ] **Step 7: Weryfikacja**

Zlecić cursorowi: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: „przeszło”, w tym `architecture.static.test.ts` bez zmian w pliku.

- [ ] **Step 8: Commit A**

```bash
git add -A src lib tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(sessions): ActivityLog, StartSessionModal, activeSession do src/components/sessions (PR 5, 1/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Czerwone testy backendu w nowych lokalizacjach

**Files:** przeniesienie 3 testów, dopisanie przypadków do `services.test.ts`, 2 nowe testy tras.

- [ ] **Step 1: Przenieś testy**

```bash
mkdir -p tests/unit/contexts/bc_calendar
git mv tests/unit/lib/nexus/repos/calendarEvents.test.ts tests/unit/contexts/bc_calendar/repositories.test.ts
git mv tests/unit/lib/calendarRange.test.ts tests/unit/contexts/bc_calendar/repositories.range.test.ts
git mv tests/unit/services/calendarService.test.ts tests/unit/contexts/bc_calendar/services.test.ts
cd tests/unit/contexts/bc_calendar
sed -i 's#"@/lib/nexus/repos/calendarEvents"#"@/contexts/bc_calendar/repositories"#; s#"\./helpers"#"../../lib/nexus/repos/helpers"#' repositories.test.ts
sed -i 's#"\.\./\.\./\.\./lib/calendarRange\.js"#"@/contexts/bc_calendar/repositories/range"#; s#describe("lib/calendarRange"#describe("bc_calendar/repositories/range"#' repositories.range.test.ts
sed -i 's#"\.\./\.\./\.\./services/calendarService\.js"#"@/contexts/bc_calendar/services"#; s#vi\.mock("\.\./\.\./\.\./lib/firestore-db\.js"#vi.mock("@/contexts/bc_calendar/repositories"#' services.test.ts
for f in repositories.range.test.ts services.test.ts; do
  head -1 "$f" | grep -q "@vitest-environment" || sed -i '1i // @vitest-environment node' "$f"
done
cd ../../../..
grep -rn "firestore-db\|services/calendarService\|lib/nexus/repos/calendarEvents\|lib/calendarRange" tests/unit/contexts/bc_calendar || echo "brak starych ścieżek"
```

Expected: `brak starych ścieżek`. Jeśli test w środowisku `node` zależy od `window`, usuń dyrektywę tylko z tego pliku i zapisz powód w komentarzu.

- [ ] **Step 2: Dopisz nowe przypadki do `services.test.ts`**

W `describe("getCalendarEvents")` dodaj (dziś nie ma testu sortowania scalonej listy). `23:30` = `1410` minut:

```ts
it("given stored events and task deadlines, when getCalendarEvents is called, then sorts by date and start_minutes", async () => {
  mockGetCalendarEvents.mockResolvedValue([
    {
      id: "e1",
      date: "2025-02-20",
      start_minutes: 600,
      duration_minutes: 60,
      title: "Praca",
      tags: [],
      color: "#3B82F6",
      type: "work",
    },
  ]);
  mockGetTasks.mockResolvedValue([
    { id: "t1", title: "Termin 20", due_date: "2025-02-20", status: "todo" },
    { id: "t2", title: "Termin 19", due_date: "2025-02-19", status: "in_progress" },
  ]);

  const result = await getCalendarEvents();

  expect(result.map((e) => e.id)).toEqual(["task:t2", "e1", "task:t1"]);
  expect(result[0]).toMatchObject({
    type: "task_deadline",
    start_minutes: 1410,
    duration_minutes: 30,
    color: "#6B7280",
    tags: [],
  });
});
```

W `describe("createCalendarEvent")` i `describe("updateCalendarEvent")` dodaj (reguła 15 minut egzekwowana przez serwis, bez polegania na mocku repozytorium). Dodaj `import { DomainError } from "@/lib/errors";` do importów pliku:

```ts
it("given duration_minutes not a multiple of 15, when createCalendarEvent is called, then rejects before touching the repository", async () => {
  const call = createCalendarEvent({
    date: "2025-02-20",
    start_minutes: 540,
    duration_minutes: 25,
    title: "X",
    tags: [],
    color: "#3B82F6",
  });
  await expect(call).rejects.toBeInstanceOf(DomainError);
  await expect(call).rejects.toThrow("duration_minutes must be a multiple of 15");
  expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
});
```

```ts
it("given duration_minutes not a multiple of 15, when updateCalendarEvent is called, then rejects before touching the repository", async () => {
  await expect(updateCalendarEvent("e1", { duration_minutes: 20 })).rejects.toThrow(
    "duration_minutes must be a multiple of 15"
  );
  expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
});

it("given a patch without duration_minutes, when updateCalendarEvent is called, then the rule does not fire", async () => {
  mockUpdateCalendarEvent.mockResolvedValue(undefined);
  await updateCalendarEvent("e1", { title: "Nowy" });
  expect(mockUpdateCalendarEvent).toHaveBeenCalledWith("e1", { title: "Nowy" });
});
```

- [ ] **Step 3: Nowy test trasy `calendar/events`**

Utwórz `tests/unit/contexts/bc_calendar/router.events.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError } from "@/lib/errors";

const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockCreateCalendarEvent = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_calendar/services", () => ({
  getCalendarEvents: mockGetCalendarEvents,
  createCalendarEvent: mockCreateCalendarEvent,
}));

import { GET, POST } from "@/app/api/calendar/events/route";

const EVENT = {
  id: "e1",
  date: "2026-11-13",
  start_minutes: 540,
  duration_minutes: 60,
  title: "Praca",
  tags: ["a"],
  color: "#111111",
  type: "work" as const,
  created_at: "2026-11-13T08:00:00.000Z",
};

const get = (query = "") => new NextRequest(`http://localhost/api/calendar/events${query}`);
const post = (body: unknown) =>
  new NextRequest("http://localhost/api/calendar/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockGetCalendarEvents.mockReset();
  mockCreateCalendarEvent.mockReset();
});

describe("GET /api/calendar/events", () => {
  it("bez parametrów woła serwis z pustym zakresem i zwraca listę", async () => {
    mockGetCalendarEvents.mockResolvedValue([EVENT]);
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([EVENT]);
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("przekazuje startDate i endDate z query", async () => {
    mockGetCalendarEvents.mockResolvedValue([]);
    await GET(get("?startDate=2026-11-01&endDate=2026-11-30"));
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
  });

  it("zachowuje wirtualne task_deadline bez created_at", async () => {
    const deadline = {
      id: "task:t1",
      date: "2026-11-13",
      start_minutes: 1410,
      duration_minutes: 30,
      title: "Termin",
      tags: [],
      color: "#6B7280",
      type: "task_deadline" as const,
    };
    mockGetCalendarEvents.mockResolvedValue([deadline]);
    const res = await GET(get());
    expect(await res.json()).toEqual([deadline]);
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockGetCalendarEvents.mockRejectedValue(new DomainError("zła data", 400));
    const res = await GET(get());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/calendar/events", () => {
  it("przekazuje pełne body do serwisu i zwraca utworzone zdarzenie", async () => {
    mockCreateCalendarEvent.mockResolvedValue({ ...EVENT, type: "meeting" });
    const res = await POST(
      post({
        date: "2026-11-13",
        start_minutes: 540,
        duration_minutes: 60,
        title: "Spotkanie",
        tags: ["a"],
        color: "#111111",
        type: "meeting",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...EVENT, type: "meeting" });
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
      date: "2026-11-13",
      start_minutes: 540,
      duration_minutes: 60,
      title: "Spotkanie",
      tags: ["a"],
      color: "#111111",
      type: "meeting",
    });
  });

  it("stosuje domyślne: tytuł pusty, tags [], kolor #3B82F6, typ work", async () => {
    mockCreateCalendarEvent.mockResolvedValue(EVENT);
    await POST(post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 30 }));
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
      date: "2026-11-13",
      start_minutes: 0,
      duration_minutes: 30,
      title: "",
      tags: [],
      color: "#3B82F6",
      type: "work",
    });
  });

  it("zamienia pojedynczy tag w tablicę i nieznany typ na work", async () => {
    mockCreateCalendarEvent.mockResolvedValue(EVENT);
    await POST(
      post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 30, tags: "a", type: "foo" })
    );
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["a"], type: "work" })
    );
  });

  it.each([[{ duration_minutes: 30 }], [{ date: "2026-11-13" }]])(
    "zwraca 400, gdy brakuje date albo duration_minutes (%j)",
    async (body) => {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "date and duration_minutes required" });
      expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    }
  );

  it("zwraca 400 dla niepoprawnego JSON", async () => {
    const res = await POST(post("{nie-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("mapuje błąd domeny serwisu na jego status", async () => {
    mockCreateCalendarEvent.mockRejectedValue(
      new DomainError("duration_minutes must be a multiple of 15", 400)
    );
    const res = await POST(post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 25 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Nowy test trasy `calendar/events/[id]`**

Utwórz `tests/unit/contexts/bc_calendar/router.events-id.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError } from "@/lib/errors";

const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_calendar/services", () => ({
  updateCalendarEvent: mockUpdateCalendarEvent,
  deleteCalendarEvent: mockDeleteCalendarEvent,
}));

import { PUT, DELETE } from "@/app/api/calendar/events/[id]/route";

const params = Promise.resolve({ id: "e1" });

const request = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/calendar/events/e1", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockUpdateCalendarEvent.mockReset();
  mockDeleteCalendarEvent.mockReset();
});

describe("PUT /api/calendar/events/[id]", () => {
  it("przekazuje pola do serwisu i zwraca success", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(undefined);
    const res = await PUT(request("PUT", { title: "Nowy", duration_minutes: 45 }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith("e1", {
      title: "Nowy",
      duration_minutes: 45,
    });
  });

  it("zachowuje meeting, nieznany typ zamienia na work, brak typu zostaje undefined", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(undefined);
    await PUT(request("PUT", { type: "meeting" }), { params });
    await PUT(request("PUT", { type: "foo" }), { params });
    await PUT(request("PUT", { title: "x" }), { params });
    expect(mockUpdateCalendarEvent.mock.calls.map((c) => c[1].type)).toEqual([
      "meeting",
      "work",
      undefined,
    ]);
  });

  it("zwraca 400 dla niepoprawnego JSON", async () => {
    const res = await PUT(request("PUT", "{nie-json"), { params });
    expect(res.status).toBe(400);
    expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockUpdateCalendarEvent.mockRejectedValue(new DomainError("Calendar event not found", 404));
    const res = await PUT(request("PUT", { title: "x" }), { params });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/calendar/events/[id]", () => {
  it("usuwa zdarzenie i zwraca success", async () => {
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const res = await DELETE(request("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("e1");
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockDeleteCalendarEvent.mockRejectedValue(new DomainError("brak", 404));
    const res = await DELETE(request("DELETE"), { params });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 5: Uruchom i potwierdź czerwone**

Zlecić cursorowi: `npx vitest run tests/unit/contexts/bc_calendar`.
Expected: FAIL (brak modułów `@/contexts/bc_calendar/{repositories,repositories/range,services}`; testy tras: trasy nadal wołają stary `@/services/calendarService`, więc mocki nie obowiązują). Pierwszy czerwony test z `repositories.test.ts`: `3. a range includes events crossing midnight into it`. Przyczyna to brak nowej implementacji, nie błąd w testach.

---

### Task 3: `models`, `schemas`, `repositories/`, `services`

**Files:** `contexts/bc_calendar/{models,schemas,services}.ts`, `contexts/bc_calendar/repositories/{index,range}.ts`.

- [ ] **Step 1: `models.ts`**

```ts
/** Zdarzenie kalendarza zapisane w vaulcie (`Calendar/RRRR-MM.yaml`, klucz `events`). */
export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD (data lokalna użytkownika)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
  created_at?: string;
};

/** Wynik serwisu: zdarzenie zapisane albo `task_deadline` doklejony z zadań (nigdy nie zapisywany). */
export type CalendarEntry = Omit<CalendarEvent, "type"> & {
  type: "work" | "meeting" | "task_deadline";
};
```

- [ ] **Step 2: `schemas.ts`**

Zod 1:1 z `lib/validation/calendarEvents.ts` (plik usuwa zadanie 5), DTO i mapper:

```ts
import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { CalendarEntry } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const CreateCalendarEventBodySchema = looseObject({
  date: z.unknown().optional(),
  start_minutes: z.unknown().optional(),
  duration_minutes: z.unknown().optional(),
  title: z.unknown().optional(),
  tags: z.unknown().optional(),
  color: z.unknown().optional(),
  type: z.unknown().optional(),
}).superRefine((body, ctx) => {
  const missingDuration = body.duration_minutes === undefined || body.duration_minutes === null;
  if (!body.date || missingDuration) {
    ctx.addIssue("date and duration_minutes required");
  }
});

export const UpdateCalendarEventBodySchema = looseObject({
  date: z.unknown().optional(),
  start_minutes: z.unknown().optional(),
  duration_minutes: z.unknown().optional(),
  title: z.unknown().optional(),
  tags: z.unknown().optional(),
  color: z.unknown().optional(),
  type: z.unknown().optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type CalendarEventDto = {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "task_deadline";
  created_at?: string;
};

export function toCalendarEventDto(entry: CalendarEntry): CalendarEventDto {
  return {
    id: entry.id,
    date: entry.date,
    start_minutes: entry.start_minutes,
    duration_minutes: entry.duration_minutes,
    title: entry.title,
    tags: entry.tags,
    color: entry.color,
    type: entry.type,
    created_at: entry.created_at,
  };
}
```

Przed zapisem sprawdź (`Read`), że `lib/validation/calendarEvents.ts` nadal ma identyczną treść schematów (kopiuj z pliku, jeśli się różni od powyższej).

- [ ] **Step 3: Repozytorium**

```bash
mkdir -p contexts/bc_calendar/repositories
git mv lib/nexus/repos/calendarEvents.ts contexts/bc_calendar/repositories/index.ts
sed -i 's#\bCalendarEventRecord\b#CalendarEvent#g' contexts/bc_calendar/repositories/index.ts
```

Zastąp blok importów (linie 1–15) w `contexts/bc_calendar/repositories/index.ts` tym:

```ts
import { DomainError } from "@/lib/errors";
import type { CalendarEvent } from "../models";
import { listVaultFiles } from "@/lib/nexus/vault-fs";
import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  str,
} from "@/lib/nexus/record-helpers";
import { eventOverlapsInclusiveRange } from "./range";
```

Reszta ciał funkcji bez zmian (`getCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`). Sprawdź `grep -n "CalendarEventRecord" contexts/bc_calendar/repositories/index.ts` → pusto.

- [ ] **Step 4: `repositories/range.ts`**

Pomocniki domeny (jedyny konsument: `index.ts`; eksportowane, bo testuje je `repositories.range.test.ts`). Kopia dawnego `lib/calendarRange.ts` bez `eventMinutesInInclusiveRange`:

```ts
/** Pomocniki zakresu dat dla zdarzeń kalendarza (data lokalna, bez przesunięcia UTC dla YYYY-MM-DD). */

const MS_PER_MIN = 60_000;
const MINS_PER_DAY = 24 * 60;

export function parseLocalMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

export function eventStartMs(ev: { date: string; start_minutes: number }): number {
  return parseLocalMidnight(ev.date) + ev.start_minutes * MS_PER_MIN;
}

export function eventEndMs(ev: {
  date: string;
  start_minutes: number;
  duration_minutes: number;
}): number {
  return eventStartMs(ev) + ev.duration_minutes * MS_PER_MIN;
}

/**
 * Inclusive range [rangeStart, rangeEnd] as calendar days.
 * Event overlaps if it intersects [rangeStart 00:00, rangeEnd+1day).
 */
export function eventOverlapsInclusiveRange(
  ev: { date: string; start_minutes: number; duration_minutes: number },
  rangeStart: string,
  rangeEnd: string
): boolean {
  const rs = parseLocalMidnight(rangeStart);
  const reEx = parseLocalMidnight(rangeEnd) + MINS_PER_DAY * MS_PER_MIN;
  if (Number.isNaN(rs) || Number.isNaN(reEx)) return false;
  const evStart = eventStartMs(ev);
  const evEnd = eventEndMs(ev);
  if (ev.duration_minutes <= 0) return false;
  return evStart < reEx && evEnd > rs;
}
```

- [ ] **Step 5: `services.ts`**

```bash
git mv services/calendarService.ts contexts/bc_calendar/services.ts
sed -i 's#firestoreDb\.#repositories.#g; s#\bCalendarEventWithType\b#CalendarEntry#g' contexts/bc_calendar/services.ts
```

Zastąp linie 1–4 (importy) w `contexts/bc_calendar/services.ts`:

```ts
import { DomainError } from "@/lib/errors";
import * as taskService from "@/contexts/bc_tasks/services";
import type { CalendarEntry } from "./models";
import * as repositories from "./repositories";
```

Usuń linię `export type CalendarEntry = CalendarEvent;` (po `sed` dawne `export type CalendarEventWithType = CalendarEvent;`; typ pochodzi teraz z `models`). Sprawdź: `grep -n "CalendarEvent\b\|firestoreDb\|CalendarEventWithType" contexts/bc_calendar/services.ts` → brak wyników poza nazwami funkcji `...CalendarEvent(`. Wynik `repositories.getCalendarEvents(options)` ma typ `CalendarEvent[]`, więc `[...events, ...deadlineEvents]` pasuje do `CalendarEntry[]` (`type` zawęża się do podzbioru unii).

- [ ] **Step 6: Uruchom testy domeny**

Zlecić cursorowi: `npx vitest run tests/unit/contexts/bc_calendar/repositories.test.ts tests/unit/contexts/bc_calendar/repositories.range.test.ts tests/unit/contexts/bc_calendar/services.test.ts`.
Expected: PASS. Testy tras (`router.events*`) jeszcze czerwone, to zadanie 4.

---

### Task 4: `router.ts` i trasy

**Files:** `contexts/bc_calendar/router.ts`, `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`.

- [ ] **Step 1: `router.ts`**

Koercje 1:1 z dzisiejszych `route.ts` (w tym `Number(start_minutes) ?? 0`, wzór: `createTask` w `bc_tasks/router.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  CreateCalendarEventBodySchema,
  UpdateCalendarEventBodySchema,
  toCalendarEventDto,
} from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listCalendarEvents(request: NextRequest): Promise<NextResponse> {
  const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
  const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;
  try {
    const events = await services.getCalendarEvents({ startDate, endDate });
    return NextResponse.json(events.map(toCalendarEventDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createCalendarEvent(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateCalendarEventBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { date, start_minutes, duration_minutes, title, tags, color, type } = parsed.data;
  try {
    const event = await services.createCalendarEvent({
      date: date as string,
      start_minutes: Number(start_minutes) ?? 0,
      duration_minutes: Number(duration_minutes),
      title: (title ?? "") as string,
      tags: (Array.isArray(tags) ? tags : tags ? [tags] : []) as string[],
      color: (color ?? "#3B82F6") as string,
      type: type === "meeting" ? "meeting" : "work",
    });
    return NextResponse.json(toCalendarEventDto(event));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateCalendarEvent(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, UpdateCalendarEventBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const body = parsed.data;
  try {
    await services.updateCalendarEvent(id, {
      date: body.date as string | undefined,
      start_minutes: body.start_minutes as number | undefined,
      duration_minutes: body.duration_minutes as number | undefined,
      title: body.title as string | undefined,
      tags: body.tags as string[] | undefined,
      color: body.color as string | undefined,
      type: body.type !== undefined ? (body.type === "meeting" ? "meeting" : "work") : undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteCalendarEvent(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteCalendarEvent(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 2: Zamień trasy na cienkie re-eksporty**

Nadpisz zawartość plików jedną linią każdy (reguła 4):

`app/api/calendar/events/route.ts`:

```ts
export {
  listCalendarEvents as GET,
  createCalendarEvent as POST,
} from "@/contexts/bc_calendar/router";
```

`app/api/calendar/events/[id]/route.ts`:

```ts
export {
  updateCalendarEvent as PUT,
  deleteCalendarEvent as DELETE,
} from "@/contexts/bc_calendar/router";
```

- [ ] **Step 3: Uruchom testy tras**

Zlecić cursorowi: `npx vitest run tests/unit/contexts/bc_calendar`.
Expected: PASS (wszystkie 6 plików). Jeśli `tsc`/vitest zgłosi błąd typu przy `GET(get())`, sprawdź, czy `listCalendarEvents` przyjmuje `NextRequest` (tak, czyta `nextUrl`).

---

### Task 5: Przepięcia, sprzątanie starej warstwy, commit B

**Files:** `lib/firestore-db.ts`, `types/index.ts`, `types/records.ts`, `src/components/calendar/calendarUtils.ts`, `src/components/sessions/ActivityLog.tsx`, `tests/unit/lib/nexus/repos-static.test.ts`; usunięcia.

- [ ] **Step 1: Wytnij kalendarz z barreli i typów**

`lib/firestore-db.ts`: usuń `CalendarEventRecord,` z bloku `export type {...}` (linia ~5) oraz cały blok `export { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/nexus/repos/calendarEvents";` (linie ~16–21). `types/index.ts`: usuń linie `CalendarEventRecord,` i `CalendarEvent,`. `types/records.ts`: usuń `export type CalendarEventRecord = {...};` i `export type CalendarEvent = ...;` razem z komentarzami (linie 30–46 przed zmianą). Każdą edycję zrób po `Read` pliku (składnia bloków).

- [ ] **Step 2: Typ w UI z `schemas`**

`src/components/calendar/calendarUtils.ts`: zamień linie 1–3 na:

```ts
import type { CalendarEventDto } from "@/contexts/bc_calendar/schemas";

export type CalendarEvent = CalendarEventDto;
```

`src/components/sessions/ActivityLog.tsx:17`: zamień `import type { CalendarEvent } from "@/types/records";` na:

```ts
import type { CalendarEventDto as CalendarEvent } from "@/contexts/bc_calendar/schemas";
```

- [ ] **Step 3: Popraw test statyczny starej warstwy**

`tests/unit/lib/nexus/repos-static.test.ts`:

- `FILE_REPOS`: zamień `...["calendarEvents", "mindMaps", "board"].map((name) => ...)` na wpis `"contexts/bc_calendar/repositories/index.ts",` plus `...["mindMaps", "board"].map((name) => `lib/nexus/repos/${name}.ts`)`;
- test importerów `vault-fs` (`walk("lib/nexus")` skanuje tylko `lib/nexus`): usuń `"lib/nexus/repos/calendarEvents.ts",` z oczekiwanej listy, nie dodawaj ścieżki `contexts/...`;
- test barrel: usuń `"calendarEvents"` z listy nazw.

- [ ] **Step 4: Usuń starą warstwę**

```bash
git rm lib/validation/calendarEvents.ts lib/calendarRange.ts
grep -rn "lib/nexus/repos/calendarEvents\|services/calendarService\|validation/calendarEvents\|lib/calendarRange\|CalendarEventRecord\|CalendarEventWithType\|types/records.*CalendarEvent" --include=*.ts --include=*.tsx app lib services src types contexts tests || echo "brak starych ścieżek"
```

Expected: `brak starych ścieżek`.

- [ ] **Step 5: Weryfikacja backendu**

Zlecić cursorowi, jednym zadaniem: `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: „przeszło”, w tym `tests/unit/architecture.static.test.ts` **bez zmian w pliku**. Każdy błąd naprawiam kodem.

- [ ] **Step 6: Commit B**

```bash
git add -A contexts app lib services types src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(bc_calendar): migracja domeny kalendarza do contexts/bc_calendar (PR 5, 2/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Commit C, UI kalendarza → `src/features/calendar/`

**Files:** `src/components/{CalendarView,CalendarEventForm}.tsx`, `src/components/calendar/*`, `src/features/planowanie/PlanowanieView.tsx`, `tests/unit/components/CalendarView.test.tsx`.

- [ ] **Step 1: Przenieś pliki (płasko)**

```bash
mkdir -p src/features/calendar tests/unit/features/calendar
git mv src/components/CalendarView.tsx src/components/CalendarEventForm.tsx src/features/calendar/
git mv src/components/calendar/CalendarDayColumn.tsx src/components/calendar/calendarUtils.ts src/components/calendar/useCalendarData.ts src/features/calendar/
git mv tests/unit/components/CalendarView.test.tsx tests/unit/features/calendar/CalendarView.test.tsx
```

- [ ] **Step 2: Popraw importy**

```bash
sed -i 's#from "\./calendar/#from "./#' src/features/calendar/*.ts src/features/calendar/*.tsx
sed -i 's#"@/src/components/CalendarView"#"@/src/features/calendar/CalendarView"#' src/features/planowanie/PlanowanieView.tsx tests/unit/features/calendar/CalendarView.test.tsx
sed -i 's#"@/src/components/calendar/calendarUtils"#"@/src/features/calendar/calendarUtils"#' tests/unit/features/calendar/CalendarView.test.tsx
grep -rn "components/CalendarView\|components/CalendarEventForm\|components/calendar\|\./calendar/" --include=*.ts --include=*.tsx src app tests lib contexts || echo "brak starych ścieżek"
```

Expected: `brak starych ścieżek`. Sprawdź też `grep -n "vi.mock" tests/unit/features/calendar/CalendarView.test.tsx` (dziś brak mocków ścieżek kalendarza). `CalendarView.tsx` zachowuje `export type { CalendarEvent } from "./calendarUtils";` po `sed`.

- [ ] **Step 3: Weryfikacja**

Zlecić cursorowi: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: „przeszło”. `build` obowiązkowy: błędy importów po przeniesieniu UI nie zawsze widać w testach jednostkowych.

- [ ] **Step 4: Commit C**

```bash
git add -A src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(calendar): UI kalendarza do src/features/calendar (PR 5, 3/3)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Weryfikacja końcowa i review

- [ ] **Step 1:** pełny przebieg przez `cursor`: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: „przeszło”.
- [ ] **Step 2:** `git diff main --stat` i sprawdzenie, że `tests/unit/architecture.static.test.ts` nie jest w diffie (`git diff main --name-only | grep architecture` → pusto); `ls lib/calendarRange.ts src/components/calendar src/lib/activeSession.ts` → brak plików.
- [ ] **Step 3:** review diffa przez `agy` (`--role review`, tier deep): zachowanie 1:1 tras (koercje, `task_deadline` w DTO), filtr zakresu dat w `repositories/range.ts`, importy zgodne z regułami 1–9, brak martwych importów po przeniesieniu, kompletność przeniesienia UI (Home, Planowanie, `CalendarView`). Opinie weryfikuję w kodzie przed poprawkami.
- [ ] **Step 4:** ręcznie w przeglądarce (`npm run dev`): karta Planowanie → kalendarz (dodanie, edycja, przeniesienie do innego miesiąca, usunięcie zdarzenia, terminy zadań jako szare `task_deadline`, start i koniec sesji) oraz `ActivityLog` w Planowaniu i Home (wykres, start sesji). Łączy się z zadaniem w NEXUS „Obejrzeć w przeglądarce kartę Planowanie i Home po PR 4”.

### Task 8: Zamknięcie

- [ ] **Step 1:** po zgodzie użytkownika: `git push -u origin feat/pr-5-bc-calendar` i `gh pr create` (opis z attribution z systemu).
- [ ] **Step 2:** po mergu: w `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „PR 5”, dopisać wpis w Backlogu (`PR 5: migracja domeny kalendarza do contexts/bc_calendar/, PR #NN — data`), awansować „PR 6: `bc_notes`” do Next; commit tylko `tasks.md` (niezacommitowany `index.md` w NEXUS nie jest mój).

---

## Self-review

- **Pokrycie spec:** §2 zakres (zdarzenia, `task_deadline`, 2 trasy, UI kalendarza, sessions, rozdzielenie `calendarRange`) → zad. 1, 3–6; §3 struktura → zad. 3–4; §4 `calendarRange` → zad. 1 (`activityRange`), zad. 3 (`range.ts`), zad. 5 (usunięcie); §5 przepięcia (barrel, typy, Home, Planowanie dwa dynamiczne importy, `CalendarView`, `CalendarDayColumn`, `README`/`STAN-W-KODZIE` poza zakresem) → zad. 1, 5, 6; §6 testy (przeniesienia, nowe testy sortowania i reguły 15 minut, testy tras, `repos-static`, `no-user-id`, mock `HomeView`, `CalendarView.test`) → zad. 1, 2, 5, 6; pierwszy czerwony test filtra zakresu → zad. 2 Step 5; §7 trzy commity w kolejności sessions → backend → UI → zad. 1, 5, 6; §8 ryzyka → `build` w każdym commicie.
- **Placeholdery:** brak.
- **Spójność nazw:** handlery `listCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent` w routerze i re-eksportach; `CalendarEvent`/`CalendarEntry` w `models`; `CalendarEventDto`, `toCalendarEventDto(entry: CalendarEntry)` w `schemas` i w UI (`calendarUtils`, `ActivityLog`); `range.ts` eksportuje `parseLocalMidnight`, `eventStartMs`, `eventEndMs`, `eventOverlapsInclusiveRange`, `activityRange.ts` tylko `eventMinutesInInclusiveRange`.
