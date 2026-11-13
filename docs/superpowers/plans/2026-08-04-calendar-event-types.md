# Calendar Event Types (Work / Meeting / Task Deadline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add "meeting" events (not just work sessions) to the calendar, and automatically surface task due dates as read-only deadline markers on the calendar — without a data migration and with full backward compatibility for existing `calendar_events` documents that have no `type` field.

**Architecture:** Add an optional `type: "work" | "meeting"` field to the existing `calendar_events` Firestore documents (default `"work"` for any doc missing it — same fallback pattern already used for `color` in this file). Task deadlines are **not** stored as new documents: `calendarService.getCalendarEvents` reads `tasks` with a `due_date` in range and maps them, in memory, into synthetic calendar entries of a third type, `"task_deadline"`, which only ever exists in the API response — never written back. The existing block-based rendering pipeline (`expandEventToSegments`, `assignLanes`, `getOverlapCounts`) is untouched; deadlines get a fixed 30-minute slot at the end of the day so they render as a normal segment without new layout code.

**Tech Stack:** Next.js 14 API routes, Firebase Admin Firestore, React, TypeScript, Vitest.

## Implementation status (verified 2026-08-04)

| Task                                                  | Status   | Notes                                                                                                          |
| ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| Task 1 — `type` on Firestore events + API             | **Done** | `lib/firestore-db.ts`, `services/calendarService.ts` (create/update only), both API routes already have `type` |
| Task 2 — virtual `task_deadline` events               | Pending  | `getCalendarEvents` in `calendarService.ts` still passthrough                                                  |
| Tasks 3–6 — frontend types, form, grid, click routing | Pending  | No `type` in `calendarUtils.ts` / UI yet                                                                       |
| Task 7 — filter deadlines from ActivityLog / Home     | Pending  | **Added during plan review** — see below                                                                       |
| Task 8 — manual verification                          | Pending  |                                                                                                                |

Task 1 commit may still be outstanding — run `git status` before skipping its commit step.

## File map

| File                                            | Role in this feature                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `lib/firestore-db.ts`                           | `CalendarEventRecord.type`, CRUD persistence, `getTasks` source for deadlines           |
| `services/calendarService.ts`                   | Merge tasks → virtual `task_deadline` entries in `getCalendarEvents`                    |
| `app/api/calendar/events/route.ts`              | GET (passthrough), POST accepts `type`                                                  |
| `app/api/calendar/events/[id]/route.ts`         | PUT accepts `type`, DELETE (real events only)                                           |
| `tests/unit/services/calendarService.test.ts`   | Unit tests for deadline merge                                                           |
| `src/components/calendar/calendarUtils.ts`      | Frontend `CalendarEvent` type                                                           |
| `src/components/calendarConstants.ts`           | `EVENT_TYPE_DEFAULT_DURATION`                                                           |
| `src/components/CalendarEventForm.tsx`          | Work / Meeting selector                                                                 |
| `src/components/calendar/CalendarDayColumn.tsx` | Visual differentiation (bell / flag / dashed border)                                    |
| `src/components/CalendarView.tsx`               | Click routing, form `initial.type`, save passes `type` via form                         |
| `src/features/planowanie/PlanowanieView.tsx`    | `onOpenTaskDeadline` → Tasks tab                                                        |
| `src/components/ActivityLog.tsx`                | **Must exclude** `task:*` ids (not a calendar view)                                     |
| `src/features/home/HomeView.tsx`                | **Must exclude** `task:*` from upcoming-events widget (tasks already listed separately) |

**Untouched (by design):** `services/planService.ts` (creates work sessions; Task 1 fallback keeps them as `"work"`), `expandEventToSegments` / lane layout code.

---

### Task 1: Data model — `type` field on real calendar events

> **Status: already implemented.** Execute only the verify + commit steps unless `git diff` shows missing pieces.

**Files:**

- Modify: `lib/firestore-db.ts:48-58` (`CalendarEventRecord`)
- Modify: `lib/firestore-db.ts:432-467` (`getCalendarEvents`)
- Modify: `lib/firestore-db.ts:469-505` (`createCalendarEvent`)
- Modify: `lib/firestore-db.ts:507-533` (`updateCalendarEvent`)
- Modify: `services/calendarService.ts:10-37` (`createCalendarEvent`, `updateCalendarEvent` param types)
- Modify: `app/api/calendar/events/route.ts:19-58` (`POST`)
- Modify: `app/api/calendar/events/[id]/route.ts:6-42` (`PUT`)

No test changes in this task — it's a backward-compatible additive field with a safe fallback, exercised end-to-end by Task 2's tests and manual verification in Task 6.

- [x] **Step 1: Add `type` to `CalendarEventRecord`**

In `lib/firestore-db.ts`, change:

```ts
export type CalendarEventRecord = {
  id: string;
  date: string; // YYYY-MM-DD (date-only, user's day)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  created_at?: string;
  createdAt?: Timestamp;
};
```

to:

```ts
export type CalendarEventRecord = {
  id: string;
  date: string; // YYYY-MM-DD (date-only, user's day)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
  created_at?: string;
  createdAt?: Timestamp;
};
```

- [x] **Step 2: Read `type` with a `"work"` fallback in `getCalendarEvents`**

In `lib/firestore-db.ts:446-456`, change the mapped object:

```ts
return {
  id: d.id,
  date: data.date ?? "",
  start_minutes: data.start_minutes ?? 0,
  duration_minutes: data.duration_minutes ?? 0,
  title: data.title ?? "",
  tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
  color: data.color ?? "#3B82F6",
  created_at: createdAt?.toDate?.()?.toISOString?.(),
  createdAt: data.createdAt ?? createdAt,
};
```

to:

```ts
return {
  id: d.id,
  date: data.date ?? "",
  start_minutes: data.start_minutes ?? 0,
  duration_minutes: data.duration_minutes ?? 0,
  title: data.title ?? "",
  tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
  color: data.color ?? "#3B82F6",
  type: data.type === "meeting" ? "meeting" : "work",
  created_at: createdAt?.toDate?.()?.toISOString?.(),
  createdAt: data.createdAt ?? createdAt,
};
```

- [x] **Step 3: Accept and persist `type` in `createCalendarEvent`**

In `lib/firestore-db.ts:469-505`, change the function signature and body:

```ts
export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
  }
): Promise<CalendarEventRecord> {
  if (data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = await calendarEventsCol(userId).add({
    date: data.date,
    start_minutes: data.start_minutes,
    duration_minutes: data.duration_minutes,
    title: data.title,
    tags: data.tags ?? [],
    color: data.color ?? "#3B82F6",
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    date: d.date ?? "",
    start_minutes: d.start_minutes ?? 0,
    duration_minutes: d.duration_minutes ?? 0,
    title: d.title ?? "",
    tags: Array.isArray(d.tags) ? d.tags : [],
    color: d.color ?? "#3B82F6",
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}
```

to:

```ts
export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
): Promise<CalendarEventRecord> {
  if (data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = await calendarEventsCol(userId).add({
    date: data.date,
    start_minutes: data.start_minutes,
    duration_minutes: data.duration_minutes,
    title: data.title,
    tags: data.tags ?? [],
    color: data.color ?? "#3B82F6",
    type: data.type === "meeting" ? "meeting" : "work",
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    date: d.date ?? "",
    start_minutes: d.start_minutes ?? 0,
    duration_minutes: d.duration_minutes ?? 0,
    title: d.title ?? "",
    tags: Array.isArray(d.tags) ? d.tags : [],
    color: d.color ?? "#3B82F6",
    type: d.type === "meeting" ? "meeting" : "work",
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}
```

- [x] **Step 4: Accept `type` in `updateCalendarEvent`**

In `lib/firestore-db.ts:507-533`, change:

```ts
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
  }>
): Promise<void> {
  if (data.duration_minutes != null && data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = calendarEventsCol(userId).doc(eventId);
  const update: Record<string, unknown> = {};
  if (data.date !== undefined) update.date = data.date;
  if (data.start_minutes !== undefined) update.start_minutes = data.start_minutes;
  if (data.duration_minutes !== undefined) update.duration_minutes = data.duration_minutes;
  if (data.title !== undefined) update.title = data.title;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.color !== undefined) update.color = data.color;
  if (Object.keys(update).length > 0) {
    await ref.update(update);
  }
}
```

to:

```ts
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
): Promise<void> {
  if (data.duration_minutes != null && data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = calendarEventsCol(userId).doc(eventId);
  const update: Record<string, unknown> = {};
  if (data.date !== undefined) update.date = data.date;
  if (data.start_minutes !== undefined) update.start_minutes = data.start_minutes;
  if (data.duration_minutes !== undefined) update.duration_minutes = data.duration_minutes;
  if (data.title !== undefined) update.title = data.title;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.color !== undefined) update.color = data.color;
  if (data.type !== undefined) update.type = data.type === "meeting" ? "meeting" : "work";
  if (Object.keys(update).length > 0) {
    await ref.update(update);
  }
}
```

- [x] **Step 5: Pass `type` through `services/calendarService.ts`**

In `services/calendarService.ts`, change:

```ts
export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
  }
) {
  return firestoreDb.createCalendarEvent(userId, data);
}

export async function updateCalendarEvent(
  userId: string,
  id: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
  }>
) {
  return firestoreDb.updateCalendarEvent(userId, id, data);
}
```

to:

```ts
export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
) {
  return firestoreDb.createCalendarEvent(userId, data);
}

export async function updateCalendarEvent(
  userId: string,
  id: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
) {
  return firestoreDb.updateCalendarEvent(userId, id, data);
}
```

(`getCalendarEvents` in this file is fully replaced in Task 2 — don't edit it here.)

- [x] **Step 6: Accept `type` in the POST route**

In `app/api/calendar/events/route.ts`, change:

```ts
let body: {
  date?: string;
  start_minutes?: number;
  duration_minutes?: number;
  title?: string;
  tags?: string[];
  color?: string;
};
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
const { date, start_minutes, duration_minutes, title, tags, color } = body;
if (!date || duration_minutes == null) {
  return NextResponse.json({ error: "date and duration_minutes required" }, { status: 400 });
}
if (duration_minutes % 15 !== 0) {
  return NextResponse.json({ error: "duration_minutes must be a multiple of 15" }, { status: 400 });
}
try {
  const event = await calendarService.createCalendarEvent(auth.uid, {
    date,
    start_minutes: Number(start_minutes) ?? 0,
    duration_minutes: Number(duration_minutes),
    title: title ?? "",
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    color: color ?? "#3B82F6",
  });
  return NextResponse.json(event);
} catch (err) {
  return handleServiceError(err);
}
```

to:

```ts
let body: {
  date?: string;
  start_minutes?: number;
  duration_minutes?: number;
  title?: string;
  tags?: string[];
  color?: string;
  type?: string;
};
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
const { date, start_minutes, duration_minutes, title, tags, color, type } = body;
if (!date || duration_minutes == null) {
  return NextResponse.json({ error: "date and duration_minutes required" }, { status: 400 });
}
if (duration_minutes % 15 !== 0) {
  return NextResponse.json({ error: "duration_minutes must be a multiple of 15" }, { status: 400 });
}
try {
  const event = await calendarService.createCalendarEvent(auth.uid, {
    date,
    start_minutes: Number(start_minutes) ?? 0,
    duration_minutes: Number(duration_minutes),
    title: title ?? "",
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    color: color ?? "#3B82F6",
    type: type === "meeting" ? "meeting" : "work",
  });
  return NextResponse.json(event);
} catch (err) {
  return handleServiceError(err);
}
```

- [x] **Step 7: Accept `type` in the PUT route**

In `app/api/calendar/events/[id]/route.ts`, change:

```ts
let body: {
  date?: string;
  start_minutes?: number;
  duration_minutes?: number;
  title?: string;
  tags?: string[];
  color?: string;
};
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
if (body.duration_minutes != null && body.duration_minutes % 15 !== 0) {
  return NextResponse.json({ error: "duration_minutes must be a multiple of 15" }, { status: 400 });
}
try {
  await calendarService.updateCalendarEvent(auth.uid, id, {
    date: body.date,
    start_minutes: body.start_minutes,
    duration_minutes: body.duration_minutes,
    title: body.title,
    tags: body.tags,
    color: body.color,
  });
  return NextResponse.json({ success: true });
} catch (err) {
  return handleServiceError(err);
}
```

to:

```ts
let body: {
  date?: string;
  start_minutes?: number;
  duration_minutes?: number;
  title?: string;
  tags?: string[];
  color?: string;
  type?: string;
};
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
if (body.duration_minutes != null && body.duration_minutes % 15 !== 0) {
  return NextResponse.json({ error: "duration_minutes must be a multiple of 15" }, { status: 400 });
}
try {
  await calendarService.updateCalendarEvent(auth.uid, id, {
    date: body.date,
    start_minutes: body.start_minutes,
    duration_minutes: body.duration_minutes,
    title: body.title,
    tags: body.tags,
    color: body.color,
    type: body.type !== undefined ? (body.type === "meeting" ? "meeting" : "work") : undefined,
  });
  return NextResponse.json({ success: true });
} catch (err) {
  return handleServiceError(err);
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `lib/firestore-db.ts`, `services/calendarService.ts`, `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`. Defer full-project type-check until Task 2 completes.

- [ ] **Step 9: Commit** (skip if already committed)

```bash
git add lib/firestore-db.ts services/calendarService.ts app/api/calendar/events/route.ts "app/api/calendar/events/[id]/route.ts"
git commit -m "feat(calendar): add work/meeting type field to calendar events"
```

---

### Task 2: Task deadlines as virtual calendar events

**Files:**

- Modify: `services/calendarService.ts` (rewrite `getCalendarEvents`)
- Test: `tests/unit/services/calendarService.test.ts`

- [ ] **Step 1: Update the existing mock to include `getTasks`, write the failing tests**

In `tests/unit/services/calendarService.test.ts`, change the mock block:

```ts
const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockCreateCalendarEvent = vi.hoisted(() => vi.fn());
const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  getCalendarEvents: (...args: unknown[]) => mockGetCalendarEvents(...args),
  createCalendarEvent: (...args: unknown[]) => mockCreateCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEvent(...args),
}));

describe("calendarService", () => {
  beforeEach(() => {
    mockGetCalendarEvents.mockReset();
    mockCreateCalendarEvent.mockReset();
    mockUpdateCalendarEvent.mockReset();
    mockDeleteCalendarEvent.mockReset();
  });
```

to:

```ts
const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockCreateCalendarEvent = vi.hoisted(() => vi.fn());
const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  getCalendarEvents: (...args: unknown[]) => mockGetCalendarEvents(...args),
  createCalendarEvent: (...args: unknown[]) => mockCreateCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEvent(...args),
  getTasks: (...args: unknown[]) => mockGetTasks(...args),
}));

describe("calendarService", () => {
  beforeEach(() => {
    mockGetCalendarEvents.mockReset();
    mockCreateCalendarEvent.mockReset();
    mockUpdateCalendarEvent.mockReset();
    mockDeleteCalendarEvent.mockReset();
    mockGetTasks.mockReset();
    mockGetTasks.mockResolvedValue([]);
  });
```

Then, still in the same file, **update the existing happy-path mock** in `describe("getCalendarEvents")` to include `type: "work"` (Firestore now always returns it):

```ts
const events = [
  {
    id: "e1",
    date: "2025-02-20",
    start_minutes: 540,
    duration_minutes: 60,
    title: "Meeting",
    tags: [],
    color: "#3B82F6",
    type: "work" as const,
  },
];
```

Then add these three tests inside the existing `describe("getCalendarEvents", ...)` block (after its two existing `it(...)` cases, before the closing `});` of that `describe`):

```ts
it("given a task with a due_date in range and status not done, when getCalendarEvents is called, then includes a task_deadline pseudo-event", async () => {
  mockGetCalendarEvents.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([
    {
      id: "t1",
      title: "Finish report",
      description: "",
      status: "todo",
      due_date: "2025-02-20",
      priority: null,
    },
  ]);

  const result = await getCalendarEvents("user-1", {
    startDate: "2025-02-01",
    endDate: "2025-02-28",
  });

  expect(result).toEqual([
    expect.objectContaining({
      id: "task:t1",
      date: "2025-02-20",
      title: "Finish report",
      type: "task_deadline",
    }),
  ]);
});

it("given a task with status done, when getCalendarEvents is called, then excludes it from results", async () => {
  mockGetCalendarEvents.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([
    {
      id: "t1",
      title: "Finish report",
      description: "",
      status: "done",
      due_date: "2025-02-20",
      priority: null,
    },
  ]);

  const result = await getCalendarEvents("user-1", {
    startDate: "2025-02-01",
    endDate: "2025-02-28",
  });

  expect(result).toEqual([]);
});

it("given a task due_date outside the requested range, when getCalendarEvents is called, then excludes it from results", async () => {
  mockGetCalendarEvents.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([
    {
      id: "t1",
      title: "Finish report",
      description: "",
      status: "todo",
      due_date: "2025-03-15",
      priority: null,
    },
  ]);

  const result = await getCalendarEvents("user-1", {
    startDate: "2025-02-01",
    endDate: "2025-02-28",
  });

  expect(result).toEqual([]);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/unit/services/calendarService.test.ts`
Expected: the 3 new tests FAIL (either `mockGetTasks is not defined` before the mock edit is saved, or — once the mock is in place — assertion failures, since `getCalendarEvents` doesn't merge tasks yet). The 2 pre-existing tests in `describe("getCalendarEvents", ...)` continue to pass.

- [ ] **Step 3: Implement the merge in `services/calendarService.ts`**

Replace the whole file content with:

```ts
import * as firestoreDb from "@/lib/firestore-db";

const TASK_DEADLINE_START_MINUTES = 23 * 60 + 30; // 23:30 — a fixed end-of-day slot
const TASK_DEADLINE_DURATION_MINUTES = 30;
const TASK_DEADLINE_COLOR = "#6B7280";

export interface CalendarEventWithType {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "task_deadline";
  created_at?: string;
}

function taskDueDateInRange(
  dueDate: string,
  options?: { startDate?: string; endDate?: string }
): boolean {
  if (options?.startDate && options?.endDate) {
    return dueDate >= options.startDate && dueDate <= options.endDate;
  }
  if (options?.startDate) return dueDate >= options.startDate;
  if (options?.endDate) return dueDate <= options.endDate;
  return true;
}

export async function getCalendarEvents(
  userId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<CalendarEventWithType[]> {
  const events = await firestoreDb.getCalendarEvents(userId, options);
  const tasks = await firestoreDb.getTasks(userId);
  const deadlineEvents: CalendarEventWithType[] = tasks
    .filter((task) => task.due_date && task.status !== "done")
    .filter((task) => taskDueDateInRange(task.due_date!, options))
    .map((task) => ({
      id: `task:${task.id}`,
      date: task.due_date!,
      start_minutes: TASK_DEADLINE_START_MINUTES,
      duration_minutes: TASK_DEADLINE_DURATION_MINUTES,
      title: task.title,
      tags: [] as string[],
      color: TASK_DEADLINE_COLOR,
      type: "task_deadline" as const,
    }));
  return [...events, ...deadlineEvents].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes
  );
}

export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
) {
  return firestoreDb.createCalendarEvent(userId, data);
}

export async function updateCalendarEvent(
  userId: string,
  id: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
) {
  return firestoreDb.updateCalendarEvent(userId, id, data);
}

export async function deleteCalendarEvent(userId: string, id: string) {
  return firestoreDb.deleteCalendarEvent(userId, id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/services/calendarService.test.ts`
Expected: all tests PASS (2 pre-existing + 3 new = 5 tests in the `getCalendarEvents` describe block, plus the untouched `createCalendarEvent`/`updateCalendarEvent`/`deleteCalendarEvent` blocks).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `services/calendarService.ts` or its callers.

- [ ] **Step 6: Commit**

```bash
git add services/calendarService.ts tests/unit/services/calendarService.test.ts
git commit -m "feat(calendar): surface task due dates as virtual calendar deadline events"
```

---

### Task 3: Frontend types and shared constants

**Files:**

- Modify: `src/components/calendar/calendarUtils.ts:1-10` (`CalendarEvent`)
- Modify: `src/components/calendarConstants.ts`

- [ ] **Step 1: Add `type` to the frontend `CalendarEvent` interface**

In `src/components/calendar/calendarUtils.ts`, change:

```ts
export interface CalendarEvent {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  created_at?: string;
}
```

to:

```ts
export interface CalendarEvent {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "task_deadline";
  created_at?: string;
}
```

- [ ] **Step 2: Add a default-duration lookup for the form**

In `src/components/calendarConstants.ts`, add this export at the end of the file:

```ts
export const EVENT_TYPE_DEFAULT_DURATION: Record<"work" | "meeting", number> = {
  work: 60,
  meeting: 30,
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: new errors appear in `src/components/CalendarEventForm.tsx`, `src/components/calendar/CalendarDayColumn.tsx`, and `src/components/CalendarView.tsx` (they construct/consume `CalendarEvent`/`CalendarEventFormData` objects without `type` yet) — that's expected here and resolved by Tasks 4–6.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/calendarUtils.ts src/components/calendarConstants.ts
git commit -m "feat(calendar): add event type to frontend calendar types"
```

---

### Task 4: Event type selector in the add/edit form

**Files:**

- Modify: `src/components/CalendarEventForm.tsx`

- [ ] **Step 1: Add `type` to `CalendarEventFormData` and import the default-duration map**

Change:

```ts
import React, { useState, useEffect, useRef } from "react";
import { CALENDAR_COLORS, DURATION_OPTIONS, formatDuration } from "./calendarConstants";
import { addCalendarDays } from "./calendar/calendarUtils";

export interface CalendarEventFormData {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
}
```

to:

```ts
import React, { useState, useEffect, useRef } from "react";
import {
  CALENDAR_COLORS,
  DURATION_OPTIONS,
  EVENT_TYPE_DEFAULT_DURATION,
  formatDuration,
} from "./calendarConstants";
import { addCalendarDays } from "./calendar/calendarUtils";

export interface CalendarEventFormData {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
}
```

- [ ] **Step 2: Add `eventType` state**

Change:

```ts
const [date, setDate] = useState(initial?.date ?? "");
const [startMinutes, setStartMinutes] = useState(
  initial?.start_minutes != null ? Math.round(initial.start_minutes / 15) * 15 : 9 * 60
);
const [durationMinutes, setDurationMinutes] = useState(initial?.duration_minutes ?? 60);
const [title, setTitle] = useState(initial?.title ?? "");
```

to:

```ts
const [date, setDate] = useState(initial?.date ?? "");
const [eventType, setEventType] = useState<"work" | "meeting">(initial?.type ?? "work");
const [startMinutes, setStartMinutes] = useState(
  initial?.start_minutes != null ? Math.round(initial.start_minutes / 15) * 15 : 9 * 60
);
const [durationMinutes, setDurationMinutes] = useState(initial?.duration_minutes ?? 60);
const [title, setTitle] = useState(initial?.title ?? "");
```

- [ ] **Step 3: Include `type` in the submitted payload**

Change:

```ts
onSubmit({
  date,
  start_minutes: startMinutes,
  duration_minutes: durationMinutes,
  title: title.trim(),
  tags,
  color,
});
```

to:

```ts
onSubmit({
  date,
  start_minutes: startMinutes,
  duration_minutes: durationMinutes,
  title: title.trim(),
  tags,
  color,
  type: eventType,
});
```

- [ ] **Step 4: Add the type selector to the form UI**

Change the opening of the form (right after the Title field, before the `grid grid-cols-2` Date/Start time block):

```tsx
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. QA testing, Learning"
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
```

to:

```tsx
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. QA testing, Learning"
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          Event type
        </label>
        <select
          value={eventType}
          onChange={(e) => {
            const next = e.target.value as "work" | "meeting";
            setEventType(next);
            setDurationMinutes(EVENT_TYPE_DEFAULT_DURATION[next]);
          }}
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="work">Work session</option>
          <option value="meeting">Meeting</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/components/CalendarEventForm.tsx`. Errors remain in `CalendarView.tsx` and `CalendarDayColumn.tsx` until Tasks 5–6.

- [ ] **Step 6: Commit**

```bash
git add src/components/CalendarEventForm.tsx
git commit -m "feat(calendar): add event type selector to the entry form"
```

---

### Task 5: Visual differentiation in the day grid

**Files:**

- Modify: `src/components/calendar/CalendarDayColumn.tsx`

- [ ] **Step 1: Import `Bell` and `Flag` icons**

Change:

```ts
import React from "react";
import { Pencil, Square } from "lucide-react";
```

to:

```ts
import React from "react";
import { Pencil, Square, Bell, Flag } from "lucide-react";
```

- [ ] **Step 2: Branch rendering per event type**

Change the segment render block:

```tsx
{
  daySegments.map((seg) => {
    const lane = lanes.get(seg.segmentKey) ?? 0;
    const stackSize = Math.max(
      1,
      Math.min(CALENDAR_MAX_STACK, overlapCounts.get(seg.segmentKey) ?? 1)
    );
    const leftPx = (seg.start_minutes / 60) * cellWidth;
    const widthPx = (seg.duration_minutes / 60) * cellWidth;
    const heightPct = 100 / stackSize - 2;
    const topPct = lane * (100 / stackSize);
    const ev = seg.source;
    const titleTip = `${ev.title} ${ev.tags.map((tag) => `#${tag}`).join(" ")} · ${formatDuration(seg.duration_minutes)}`;
    return (
      <div
        key={seg.segmentKey}
        data-event
        onClick={(e) => {
          e.stopPropagation();
          onEventClick(ev);
        }}
        className="absolute rounded overflow-hidden cursor-pointer border border-white/50 shadow-sm flex items-center gap-1 group hover:ring-2 hover:ring-white/80"
        style={{
          left: leftPx,
          width: Math.max(24, widthPx),
          top: `${topPct}%`,
          height: `${heightPct}%`,
          backgroundColor: ev.color,
        }}
        title={titleTip}
      >
        <span className="truncate text-[10px] font-medium text-white px-1 drop-shadow flex-1 min-w-0">
          {ev.title}
        </span>
        <Pencil
          className="w-3 h-3 text-white/90 flex-shrink-0 opacity-70 group-hover:opacity-100 mr-1"
          aria-hidden
        />
      </div>
    );
  });
}
```

to:

```tsx
{
  daySegments.map((seg) => {
    const lane = lanes.get(seg.segmentKey) ?? 0;
    const stackSize = Math.max(
      1,
      Math.min(CALENDAR_MAX_STACK, overlapCounts.get(seg.segmentKey) ?? 1)
    );
    const leftPx = (seg.start_minutes / 60) * cellWidth;
    const widthPx = (seg.duration_minutes / 60) * cellWidth;
    const heightPct = 100 / stackSize - 2;
    const topPct = lane * (100 / stackSize);
    const ev = seg.source;
    const isMeeting = ev.type === "meeting";
    const isDeadline = ev.type === "task_deadline";
    const typeSuffix = isDeadline ? " · Task deadline" : isMeeting ? " · Meeting" : "";
    const titleTip = `${ev.title} ${ev.tags.map((tag) => `#${tag}`).join(" ")} · ${formatDuration(seg.duration_minutes)}${typeSuffix}`;
    return (
      <div
        key={seg.segmentKey}
        data-event
        onClick={(e) => {
          e.stopPropagation();
          onEventClick(ev);
        }}
        className={`absolute rounded overflow-hidden cursor-pointer shadow-sm flex items-center gap-1 group hover:ring-2 hover:ring-white/80 ${
          isDeadline ? "border-2 border-dashed border-white/80" : "border border-white/50"
        }`}
        style={{
          left: leftPx,
          width: Math.max(24, widthPx),
          top: `${topPct}%`,
          height: `${heightPct}%`,
          backgroundColor: ev.color,
        }}
        title={titleTip}
      >
        {isMeeting && <Bell className="w-3 h-3 text-white/90 flex-shrink-0 ml-1" aria-hidden />}
        {isDeadline && <Flag className="w-3 h-3 text-white/90 flex-shrink-0 ml-1" aria-hidden />}
        <span className="truncate text-[10px] font-medium text-white px-1 drop-shadow flex-1 min-w-0">
          {ev.title}
        </span>
        {!isDeadline && (
          <Pencil
            className="w-3 h-3 text-white/90 flex-shrink-0 opacity-70 group-hover:opacity-100 mr-1"
            aria-hidden
          />
        )}
      </div>
    );
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/components/calendar/CalendarDayColumn.tsx`. The remaining errors are in `CalendarView.tsx` (Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/CalendarDayColumn.tsx
git commit -m "feat(calendar): distinguish meeting and task-deadline segments visually"
```

---

### Task 6: Click routing for deadlines + wiring into Planowanie

**Files:**

- Modify: `src/components/CalendarView.tsx`
- Modify: `src/features/planowanie/PlanowanieView.tsx`

- [ ] **Step 1: Add the `onOpenTaskDeadline` prop**

In `src/components/CalendarView.tsx`, change the props interface:

```ts
interface CalendarViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
  userTags?: UserTag[];
  refreshTrigger?: number;
  activeSession?: ActiveSession | null;
  onStartSession?: (payload: { title: string; tags: string[]; color: string }) => void;
  onEndSession?: () => void | Promise<void>;
  sessionEndError?: string | null;
  clearSessionEndError?: () => void;
}
```

to:

```ts
interface CalendarViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
  userTags?: UserTag[];
  refreshTrigger?: number;
  activeSession?: ActiveSession | null;
  onStartSession?: (payload: { title: string; tags: string[]; color: string }) => void;
  onEndSession?: () => void | Promise<void>;
  sessionEndError?: string | null;
  clearSessionEndError?: () => void;
  onOpenTaskDeadline?: (taskId: string) => void;
}
```

And the component signature:

```ts
export function CalendarView({
  apiFetch,
  lang,
  t,
  userTags = [],
  refreshTrigger,
  activeSession = null,
  onStartSession,
  onEndSession,
  sessionEndError = null,
  clearSessionEndError,
}: CalendarViewProps) {
```

to:

```ts
export function CalendarView({
  apiFetch,
  lang,
  t,
  userTags = [],
  refreshTrigger,
  activeSession = null,
  onStartSession,
  onEndSession,
  sessionEndError = null,
  clearSessionEndError,
  onOpenTaskDeadline,
}: CalendarViewProps) {
```

- [ ] **Step 2: Branch `handleOpenEdit` for deadline segments**

Change:

```ts
const handleOpenEdit = (ev: CalendarEvent) => {
  setEditingEvent(ev);
  setAddDate(null);
  setSaveError(null);
  setModalOpen(true);
};
```

to:

```ts
const handleOpenEdit = (ev: CalendarEvent) => {
  if (ev.type === "task_deadline") {
    onOpenTaskDeadline?.(ev.id.replace(/^task:/, ""));
    return;
  }
  setEditingEvent(ev);
  setAddDate(null);
  setSaveError(null);
  setModalOpen(true);
};
```

- [ ] **Step 3: Include `type` in the form's `initial` values**

Change:

```tsx
            <CalendarEventForm
              initial={
                editingEvent
                  ? {
                      date: editingEvent.date,
                      start_minutes: editingEvent.start_minutes,
                      duration_minutes: editingEvent.duration_minutes,
                      title: editingEvent.title,
                      tags: editingEvent.tags,
                    }
                  : addDate
                    ? {
                        date: addDate,
                        start_minutes: 9 * 60,
                        duration_minutes: 60,
                        title: "",
                        tags: [],
                      }
                    : undefined
              }
```

to:

```tsx
            <CalendarEventForm
              initial={
                editingEvent
                  ? {
                      date: editingEvent.date,
                      start_minutes: editingEvent.start_minutes,
                      duration_minutes: editingEvent.duration_minutes,
                      title: editingEvent.title,
                      tags: editingEvent.tags,
                      type: editingEvent.type === "meeting" ? "meeting" : "work",
                    }
                  : addDate
                    ? {
                        date: addDate,
                        start_minutes: 9 * 60,
                        duration_minutes: 60,
                        title: "",
                        tags: [],
                        type: "work",
                      }
                    : undefined
              }
```

- [ ] **Step 4: Wire the callback from `PlanowanieView`**

In `src/features/planowanie/PlanowanieView.tsx`, change:

```tsx
<CalendarView
  apiFetch={apiFetch}
  lang={lang}
  t={t}
  userTags={userTags}
  refreshTrigger={calendarRefreshKey}
  activeSession={activeSession}
  onStartSession={handleStartSession}
  onEndSession={handleEndSession}
  sessionEndError={sessionEndError}
  clearSessionEndError={() => setSessionEndError(null)}
/>
```

to:

```tsx
<CalendarView
  apiFetch={apiFetch}
  lang={lang}
  t={t}
  userTags={userTags}
  refreshTrigger={calendarRefreshKey}
  activeSession={activeSession}
  onStartSession={handleStartSession}
  onEndSession={handleEndSession}
  sessionEndError={sessionEndError}
  clearSessionEndError={() => setSessionEndError(null)}
  onOpenTaskDeadline={() => setPlanningTab("tasks")}
/>
```

- [ ] **Step 5: Type-check the whole project**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors anywhere (compare against the pre-existing unrelated failures in `tests/unit/lib/parseBody.test.ts`, `tests/unit/lib/uploadFormFile.test.ts`, `tests/unit/lib/waitlistCheckEmail.test.ts`, `tests/unit/services/resourceService.test.ts` — those predate this work and are out of scope).

- [ ] **Step 6: Run the full unit test suite**

Run: `npx vitest run`
Expected: all calendar-related suites pass (`tests/unit/services/calendarService.test.ts`, `tests/unit/lib/calendarRange.test.ts`), and no suite outside the pre-existing failing set regresses.

- [ ] **Step 7: Commit**

```bash
git add src/components/CalendarView.tsx src/features/planowanie/PlanowanieView.tsx
git commit -m "feat(calendar): route task-deadline clicks to the Tasks tab"
```

---

### Task 7: Exclude virtual deadlines from non-calendar consumers

Task 2 merges `task_deadline` pseudo-events into every `GET /api/calendar/events` response. **ActivityLog** ("Moja praca") and **Home** upcoming-events widget also call that endpoint but must not show synthetic 23:30 deadline slots — Home already lists due tasks in a separate widget. Filter by the stable `task:{id}` prefix (no `type` field needed on their local interfaces).

**Files:**

- Modify: `src/components/ActivityLog.tsx:62-73`
- Modify: `src/features/home/HomeView.tsx:186`

- [ ] **Step 1: Filter in ActivityLog after fetch**

In `src/components/ActivityLog.tsx`, change the `.then` body that calls `setEvents`:

```ts
if (!cancelled)
  setEvents(
    Array.isArray(data)
      ? data.sort(
          (a: CalendarEvent, b: CalendarEvent) =>
            a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes
        )
      : []
  );
```

to:

```ts
if (!cancelled)
  setEvents(
    Array.isArray(data)
      ? data
          .filter((ev: CalendarEvent) => !ev.id.startsWith("task:"))
          .sort(
            (a: CalendarEvent, b: CalendarEvent) =>
              a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes
          )
      : []
  );
```

- [ ] **Step 2: Filter in HomeView upcoming-events list**

In `src/features/home/HomeView.tsx`, change:

```ts
const upcomingEvents = events.filter((n) => n.date && n.date >= today && n.date <= limit48h);
```

to:

```ts
const upcomingEvents = events.filter(
  (n) => n.date && n.date >= today && n.date <= limit48h && !n.id.startsWith("task:")
);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `ActivityLog.tsx` or `HomeView.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ActivityLog.tsx src/features/home/HomeView.tsx
git commit -m "fix(calendar): hide virtual task deadlines from activity log and home"
```

---

### Task 8: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify meeting creation**

In the browser, open Planowanie → Kalendarz, click an empty day cell, set "Event type" to "Meeting", confirm duration defaults to 30 min, save, and confirm the new segment renders with a bell icon and a solid border.

- [ ] **Step 3: Verify work session still defaults correctly**

Add a new entry, leave "Event type" as "Work session", confirm duration still defaults to 60 min as before.

- [ ] **Step 4: Verify task deadlines appear**

Go to the Tasks tab, set a due date (today or within the current month) on a task that isn't marked "Done". Switch to the Calendar tab and confirm a dashed, gray, flag-icon segment appears near 23:30 on that day. Click it and confirm it switches you to the Tasks tab instead of opening the edit-entry modal.

- [ ] **Step 5: Verify a done task's deadline is hidden**

Mark that task "Done", switch to another tab and back to Kalendarz — confirm the deadline segment disappears.

- [ ] **Step 6: Verify existing (pre-migration) events still render**

Confirm any calendar events created before this change (no `type` field in Firestore) still render normally as work-session-styled segments (no bell/flag icon, solid border) — this is the backward-compatibility fallback from Task 1, Step 2.

- [ ] **Step 7: Verify Activity Log is not polluted**

Open Planowanie → Moja praca. With a task due in the selected date range, confirm **no** phantom 23:30 / 30-min entries appear in the event list (only real calendar work/meeting sessions).

- [ ] **Step 8: Verify Home upcoming count**

On Home, with a task due today, confirm the "Upcoming" widget counts **calendar events only** — not task deadlines (tasks appear in "Today's tasks" instead).

- [ ] **Step 9: No commit for this task** — it's verification only. If any step fails, fix the underlying task and re-run this verification from Step 1.

---

## Notes on scope (read before executing)

- **Task deadlines are read-only from the calendar.** Clicking one navigates to the Tasks tab; it does not auto-open that specific task's detail modal. Wiring that up would require threading a "preselected task id" prop through `TasksSection` (which currently manages `detailTaskId` as fully internal state) and a matching state slot in `PlanowanieView`. That's a reasonable follow-up but is out of scope here to keep this change additive and low-risk.
- **Calendar refresh on task edits is not required.** `CalendarView` unmounts when leaving the Kalendarz tab (`planningTab !== "calendar"` in `PlanowanieView`), so switching Tasks → Kalendarz always re-fetches. No `onTasksChanged` callback needed for the manual verification flow.
- **Virtual deadlines use `id: "task:{taskId}"`.** Consumers that are not the calendar grid should filter `!id.startsWith("task:")` rather than depending on a `type` field (see Task 7). `DELETE /api/calendar/events/task:…` would no-op against Firestore (no such doc) — the edit modal never opens for deadlines, so this is not exposed in the UI.
- **No i18n added to `CalendarEventForm.tsx`.** That file is already 100% hardcoded English today (`Title`, `Date`, `Start time`, etc. — it never received a `t`/`lang` prop), unlike most of the rest of the app. The new "Event type" / "Work session" / "Meeting" labels follow that existing (if inconsistent) convention rather than introducing partial i18n plumbing into one field of an otherwise untranslated form.
- **Plan AI (`services/planService.ts`) is untouched.** It only creates `"work"`-shaped entries today; Task 1's fallback (`type === "meeting" ? "meeting" : "work"`) means anything it creates keeps defaulting to `"work"`, so no behavior change there.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-calendar-event-types.md`.

**Recommended start:** Task 1 commit (if not yet committed) → Task 2 → Tasks 3–6 → Task 7 → Task 8 manual verification.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks (`superpowers:subagent-driven-development`)
2. **Inline Execution** — run tasks in this session with checkpoints (`superpowers:executing-plans`)

Which approach?
