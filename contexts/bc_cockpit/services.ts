import * as calendarServices from "@/contexts/bc_calendar/services";
import * as inboxServices from "@/contexts/bc_inbox/services";
import * as projectsServices from "@/contexts/bc_projects/services";
import * as tasksServices from "@/contexts/bc_tasks/services";
import { DomainError, NotFoundError } from "@/lib/errors";
import {
  MAX_PINNED,
  type Closing,
  type CommitHistory,
  type Cockpit,
  type Confidence,
  type DayEvent,
  type DeepWindow,
  type Energy,
  type GitSummary,
  type InboxSummary,
  type NextMeeting,
  type Owner,
  type Pinned,
  type ProjectKind,
  type QueueGroup,
  type ReviewHistory,
  type ReviewRequests,
  type QueueSource,
  type QueueItem,
  type QueueItemProject,
  type Topic,
  type WeekFocus,
  type WeekReview,
  type WeekReviewClosing,
  type WeekReviewProject,
} from "./models";
import * as repositories from "./repositories";

const GENERAL_NAME = "Ogólne";
/** Terminy poza tym zakresem to najpewniej literówki (np. `0006-08-26`). */
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

const pad = (n: number) => String(n).padStart(2, "0");

/** Dzień w strefie lokalnej serwera (`RRRR-MM-DD`); jedyne źródło „dziś” dla Kokpitu. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `RRRR-MM-DD`, istniejący dzień kalendarzowy, rok 2000–2099. */
export function isPlausibleDate(value: string | null | undefined): value is string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

// ── aktywne tematy ─────────────────────────────────────────────────────────────

function toTopic(p: ReturnType<typeof projectsServices.getProject>): Topic {
  const nextStep = p.state?.nextStep.trim() || null;
  const blocker = p.state?.blocker.trim() || null;
  // `state.md` bez treści (puste pola) nie przesłania „Gdzie skończyłem” z `index.md`.
  const source: Topic["source"] =
    nextStep || blocker ? "state" : p.whereIStopped ? "index" : "none";
  const confidence: Confidence =
    p.freshness === "stale" || p.stateConfidence === "unknown" || p.stateConfidence === "low"
      ? "check"
      : "sure";
  return {
    id: p.id,
    name: p.name,
    owner: p.owner,
    kind: projectsServices.projectKind(p.owner, p.type),
    companyData: projectsServices.hasCompanyData(p.owner, p.type),
    freshness: p.freshness,
    source,
    nextStep: source === "state" ? nextStep : null,
    blocker: source === "state" ? blocker : null,
    whereIStopped: source === "index" ? p.whereIStopped : null,
    branch: p.state?.branch.trim() || null,
    lastActivity: p.state?.updated ?? p.lastWorked ?? null,
    confidence,
    nowCount: p.board.now.filter((t) => !t.done).length,
    bugCount: p.bugs.filter((b) => b.section !== "Zamknięte").length,
  };
}

function loadTopics(today: Date, warnings: string[]): { topics: Topic[]; pinnedIds: string[] } {
  let ids: string[];
  try {
    ids = repositories.readPinned().ids;
  } catch (err) {
    warnings.push(`Przypięte projekty: ${reason(err)}`);
    return { topics: [], pinnedIds: [] };
  }
  if (ids.length > MAX_PINNED) {
    warnings.push(`Przypięto ${ids.length} projekty, pokazuję pierwsze ${MAX_PINNED}`);
  }
  const topics: Topic[] = [];
  for (const id of ids.slice(0, MAX_PINNED)) {
    try {
      topics.push(toTopic(projectsServices.getProject(id, today)));
    } catch (err) {
      warnings.push(
        err instanceof NotFoundError
          ? `Przypięty projekt ${id} nie istnieje już w rejestrze`
          : `Projekt ${id}: ${reason(err)}`
      );
    }
  }
  return { topics, pinnedIds: ids.slice(0, MAX_PINNED) };
}

// ── kolejka na dziś ────────────────────────────────────────────────────────────

const ENERGY_MARK =
  /\s*(?:(?<!\S)#(deep|quick)(?![\p{L}\p{N}_-])|\[energy::\s*(deep|quick)\s*\])/giu;

/** Energia z tekstu zadania (pierwszy znacznik wygrywa); zwraca tytuł bez znaczników energii. */
export function extractEnergy(raw: string): { energy: Energy | null; title: string } {
  let energy: Energy | null = null;
  const title = raw
    .replace(ENERGY_MARK, (_m, tag: string | undefined, field: string | undefined) => {
      energy ??= (tag ?? field ?? "").toLowerCase() as Energy;
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { energy, title: energy === null ? raw : title };
}

/** Priorytet zadania ogólnego oznaczający „Pilne” (ten sam co przycisk w karcie Zadania). */
const URGENT_TASK_PRIORITY = 1;

type QueueEntry = {
  projectId: string | null;
  name: string;
  owner: Owner;
  kind?: ProjectKind;
  companyData?: boolean;
  item: QueueItem;
};

const KIND_RANK: Record<QueueItem["kind"], number> = {
  today: 0,
  overdue: 1,
  now: 2,
  upcoming: 3,
  undated: 4,
};

/**
 * Sortuje wg najbliższej daty: dziś → zaległe (od najświeższego, bo najstarsze zaległości zasłaniałyby
 * bieżące) → `[now::]` → z terminem w przyszłości (najbliższy pierwszy) → bez terminu; potem grupuje wg kolejności pierwszego wystąpienia.
 */
function groupQueue(entries: QueueEntry[]): QueueGroup[] {
  const sorted = [...entries].sort((a, b) => {
    const byKind = KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind];
    if (byKind !== 0) return byKind;
    const [da, db] = [a.item.due ?? "", b.item.due ?? ""];
    return a.item.kind === "overdue" ? db.localeCompare(da) : da.localeCompare(db);
  });
  const groups = new Map<string, QueueGroup>();
  for (const entry of sorted) {
    const key = entry.projectId === null ? "general:" : `project:${entry.projectId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        projectId: entry.projectId,
        name: entry.name,
        owner: entry.owner,
        ...(entry.kind !== undefined
          ? { kind: entry.kind, companyData: entry.companyData ?? false }
          : {}),
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(entry.item);
  }
  return [...groups.values()];
}

async function loadQueue(date: string, warnings: string[]): Promise<QueueGroup[]> {
  const entries: QueueEntry[] = [];

  try {
    const { tasks, warnings: nowWarnings } = projectsServices.listNowTasks();
    warnings.push(...nowWarnings);
    for (const t of tasks) {
      entries.push({
        projectId: t.projectId,
        name: t.projectName,
        owner: t.owner,
        kind: t.kind,
        companyData: t.companyData,
        item: {
          kind: "now",
          title: extractEnergy(t.text).title,
          due: null,
          projectName: t.projectName,
          priority: t.priority || null,
          energy: extractEnergy(t.text).energy,
          source: {
            type: "project",
            projectId: t.projectId,
            text: t.text,
            occurrence: t.occurrence,
          },
        },
      });
    }
  } catch (err) {
    warnings.push(`Zadania projektów: ${reason(err)}`);
  }

  try {
    // rejestr czytamy dopiero przy pierwszym zadaniu z `project` (spec zadań ogólnych, P4); błąd = zadania bez koloru
    let projectsById: Map<string, QueueItemProject> | undefined;
    const projectOf = (id: string): QueueItemProject | undefined => {
      if (projectsById === undefined) {
        try {
          projectsById = new Map(
            projectsServices.listProjects().projects.map((p) => [
              p.id,
              {
                id: p.id,
                name: p.name,
                kind: projectsServices.projectKind(p.owner, p.type),
                companyData: projectsServices.hasCompanyData(p.owner, p.type),
              },
            ])
          );
        } catch (err) {
          warnings.push(`Rejestr projektów (kolor zadań): ${reason(err)}`);
          projectsById = new Map();
        }
      }
      return projectsById.get(id);
    };
    for (const t of await tasksServices.getTasks()) {
      // w kolejce tylko „do zrobienia” i „w toku”; „do sprawdzenia” (wysłane komuś), „odłożone” (świadomie nie teraz) i „zrobione” nie wracają do kokpitu
      if (t.status === "done" || t.status === "to_review" || t.status === "deferred") continue;
      if (t.due_date && !isPlausibleDate(t.due_date)) {
        warnings.push(`Zadanie "${t.title}": pominięto błędny termin ${t.due_date}`);
        continue;
      }
      // Zadania ogólne nie mają pola `owner`: w 2-1 traktowane jako prywatne (spec D7).
      const project = t.project ? projectOf(t.project) : undefined;
      entries.push({
        projectId: null,
        name: GENERAL_NAME,
        owner: "personal",
        item: {
          kind: !t.due_date
            ? "undated"
            : t.due_date < date
              ? "overdue"
              : t.due_date === date
                ? "today"
                : "upcoming",
          title: extractEnergy(t.title).title,
          due: t.due_date || null,
          projectName: null,
          priority: null,
          energy: extractEnergy(t.title).energy,
          ...(t.priority === URGENT_TASK_PRIORITY ? { urgent: true } : {}),
          ...(project ? { project } : {}),
          source: { type: "task", taskId: t.id },
        },
      });
    }
  } catch (err) {
    warnings.push(`Zadania ogólne: ${reason(err)}`);
  }

  return groupQueue(entries);
}

// ── dzisiejsze wydarzenia ──────────────────────────────────────────────────────

async function loadEvents(date: string, warnings: string[]): Promise<DayEvent[]> {
  try {
    const entries = await calendarServices.getCalendarEvents({ startDate: date, endDate: date });
    // wydarzenia z poprzednich dni, które sięgają po północy, nie należą do osi dzisiejszego dnia
    return entries.flatMap((e) =>
      e.type === "task_deadline" || e.date !== date
        ? []
        : [
            {
              id: e.id,
              title: e.title,
              startMinutes: e.start_minutes,
              durationMinutes: e.duration_minutes,
              type: e.type,
              color: e.color,
              link: e.link ?? null,
              brief: e.brief ?? null,
            },
          ]
    );
  } catch (err) {
    warnings.push(`Kalendarz: ${reason(err)}`);
    return [];
  }
}

const UPCOMING_DAYS = 60;

/** Najbliższe spotkanie po dniu `date` w ciągu `UPCOMING_DAYS` dni; `null`, gdy brak albo kalendarz zawiódł. */
async function loadUpcomingMeeting(
  today: Date,
  date: string,
  warnings: string[]
): Promise<NextMeeting | null> {
  const day = (offset: number) =>
    localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  try {
    const entries = await calendarServices.getCalendarEvents({
      startDate: day(1),
      endDate: day(UPCOMING_DAYS),
    });
    const next = entries
      .filter((e) => e.type === "meeting" && e.date > date)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes)[0];
    return next
      ? {
          date: next.date,
          title: next.title,
          startMinutes: next.start_minutes,
          durationMinutes: next.duration_minutes,
          link: next.link ?? null,
        }
      : null;
  } catch (err) {
    const message = `Kalendarz: ${reason(err)}`;
    if (!warnings.includes(message)) warnings.push(message);
    return null;
  }
}

/** Pierwsze dzisiejsze `meeting`, które jeszcze się nie skończyło (trwające liczy się jako następne). */
export function pickNextMeeting(
  events: DayEvent[],
  nowMinutes: number
): Omit<NextMeeting, "date"> | null {
  const upcoming = events
    .filter((e) => e.type === "meeting" && e.startMinutes + e.durationMinutes > nowMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];
  return upcoming
    ? {
        title: upcoming.title,
        startMinutes: upcoming.startMinutes,
        durationMinutes: upcoming.durationMinutes,
        link: upcoming.link,
      }
    : null;
}

// ── okna Deep Work ─────────────────────────────────────────────────────────────

const DAY_START = 8 * 60;
const DAY_END = 23 * 60;
const MIN_WINDOW = 45;
const DEEP_MIN_WINDOW = 60;
const MAX_WINDOW = 150;
const MAX_WINDOWS = 3;

/**
 * Do 3 proponowanych okien w wolnych godzinach 08–23 (od „teraz”, zaokrąglonego w górę do 15 min):
 * wolny odcinek ≥ 45 min, okno do 150 min. Zadania z kolejki (kolejność jak w kolejce) wybierane
 * wg energii: okno ≥ 60 min dostaje najpierw deep, potem quick; krótsze tylko quick. Czysta funkcja.
 */
export function planWindows(
  events: DayEvent[],
  queue: QueueGroup[],
  nowMinutes: number
): DeepWindow[] {
  const busy = events
    .map((e) => [e.startMinutes, e.startMinutes + e.durationMinutes] as const)
    .sort((a, b) => a[0] - b[0]);
  const gaps: { start: number; end: number }[] = [];
  let cursor = Math.max(DAY_START, Math.ceil(nowMinutes / 15) * 15);
  for (const [start, end] of busy) {
    if (start > cursor) gaps.push({ start: cursor, end: Math.min(start, DAY_END) });
    cursor = Math.max(cursor, end);
  }
  if (cursor < DAY_END) gaps.push({ start: cursor, end: DAY_END });

  const chosen = gaps
    .filter((g) => g.end - g.start >= MIN_WINDOW)
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, MAX_WINDOWS)
    .sort((a, b) => a.start - b.start);

  const items = queue.flatMap((g) => g.items).filter((i) => i.energy !== null);
  const deep = items.filter((i) => i.energy === "deep");
  const quick = items.filter((i) => i.energy === "quick");

  const windows: DeepWindow[] = [];
  for (const gap of chosen) {
    const long = gap.end - gap.start >= DEEP_MIN_WINDOW;
    const item = (long ? (deep.shift() ?? quick.shift()) : quick.shift()) ?? null;
    if (!item || item.energy === null) continue;
    windows.push({
      startMinutes: gap.start,
      endMinutes: Math.min(gap.end, gap.start + MAX_WINDOW),
      energy: item.energy,
      title: item.title,
      projectName: item.projectName,
    });
  }
  return windows;
}

// ── git ────────────────────────────────────────────────────────────────────────

function loadGit(today: Date, topics: Topic[], warnings: string[]): GitSummary | null {
  try {
    const activity = projectsServices.listGitActivity(today);
    if (activity.length === 0) return null;
    return {
      commitsToday: activity.reduce((sum, a) => sum + a.commitsToday, 0),
      projectsWithCommits: activity.filter((a) => a.commitsToday > 0).length,
      branch: activity.find((a) => a.projectId === topics[0]?.id)?.branch ?? null,
    };
  } catch (err) {
    warnings.push(`Git: ${reason(err)}`);
    return null;
  }
}

// ── inbox ──────────────────────────────────────────────────────────────────────

function loadInbox(warnings: string[]): InboxSummary | null {
  try {
    return { open: inboxServices.countOpen() };
  } catch (err) {
    warnings.push(`Inbox: ${reason(err)}`);
    return null;
  }
}

// ── zamknięcie dnia ────────────────────────────────────────────────────────────

export const MAX_CLOSING_TEXT = 300;

function loadClosing(date: string, warnings: string[]): Cockpit["closing"] {
  try {
    const all = repositories.readClosings();
    const before = all.filter((c) => c.date < date);
    return {
      anchor: before[before.length - 1] ?? null,
      today: all.find((c) => c.date === date) ?? null,
    };
  } catch (err) {
    warnings.push(`Zamknięcie dnia: ${reason(err)}`);
    return { anchor: null, today: null };
  }
}

// ── focus tygodnia ─────────────────────────────────────────────────────────────

export const MAX_FOCUS_TEXT = 300;

/** Przesuwa dzień `RRRR-MM-DD` o `delta` dni (kalendarz lokalny, odporne na zmianę czasu). */
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + delta));
}

/** Poniedziałek tygodnia ISO, w którym jest dzień `RRRR-MM-DD`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return shiftDay(day, -sinceMonday);
}

function loadWeekFocus(date: string, warnings: string[]): WeekFocus | null {
  try {
    const start = weekStart(date);
    return repositories.readWeekFocuses().find((w) => w.weekStart === start) ?? null;
  } catch (err) {
    warnings.push(`Focus tygodnia: ${reason(err)}`);
    return null;
  }
}

// ── API serwisu ────────────────────────────────────────────────────────────────

/** Każde źródło w osobnym try/catch: awaria daje pustą sekcję i wpis w `warnings`, nie wyjątek. */
export async function getCockpit(today: Date = new Date()): Promise<Cockpit> {
  const date = localDate(today);
  const warnings: string[] = [];
  const { topics, pinnedIds } = loadTopics(today, warnings);
  const queue = await loadQueue(date, warnings);
  const events = await loadEvents(date, warnings);
  const todays = pickNextMeeting(events, today.getHours() * 60 + today.getMinutes());
  const nextMeeting: NextMeeting | null = todays
    ? { date, ...todays }
    : await loadUpcomingMeeting(today, date, warnings);
  const git = loadGit(today, topics, warnings);
  const inbox = loadInbox(warnings);
  const closing = loadClosing(date, warnings);
  const weekFocus = loadWeekFocus(date, warnings);
  const windows = planWindows(events, queue, today.getHours() * 60 + today.getMinutes());
  return {
    date,
    topics,
    pinnedIds,
    queue,
    events,
    nextMeeting,
    git,
    inbox,
    windows,
    closing,
    weekFocus,
    warnings,
  };
}

export async function setPinned(ids: string[]): Promise<Pinned> {
  if (ids.length > MAX_PINNED) {
    throw new DomainError(`Maksymalnie ${MAX_PINNED} aktywne tematy`);
  }
  if (new Set(ids).size !== ids.length) throw new DomainError("Powtórzone id projektu");
  const known = new Set(projectsServices.listProjects().projects.map((p) => p.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new DomainError(`Nieznany projekt: ${unknown.join(", ")}`);
  await repositories.writePinned(ids);
  return { ids };
}

/** Zapisuje zamknięcie dzisiejszego dnia (nadpisuje wcześniejsze z tego samego dnia); dołącza commity dnia z gita. */
export async function closeDay(
  input: { text: string; projectId: string | null },
  today: Date = new Date()
): Promise<Closing> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (text === "") throw new DomainError("Wpisz jedno zdanie");
  if (text.length > MAX_CLOSING_TEXT) {
    throw new DomainError(`Maksymalnie ${MAX_CLOSING_TEXT} znaków`);
  }
  if (input.projectId !== null) {
    const known = projectsServices.listProjects().projects.some((p) => p.id === input.projectId);
    if (!known) throw new DomainError(`Nieznany projekt: ${input.projectId}`);
  }
  let commits: number | null = null;
  try {
    const activity = projectsServices.listGitActivity(today);
    if (activity.length > 0) commits = activity.reduce((sum, a) => sum + a.commitsToday, 0);
  } catch {
    // brak gita nie blokuje zapisu zdania
  }
  const closing: Closing = { date: localDate(today), text, projectId: input.projectId, commits };
  await repositories.upsertClosing(closing);
  return closing;
}

/** Zapisuje focus bieżącego tygodnia ISO (nadpisuje wcześniejszy z tego samego tygodnia). */
export async function setWeekFocus(
  input: { text: string },
  today: Date = new Date()
): Promise<WeekFocus> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (text === "") throw new DomainError("Wpisz jedno zdanie");
  if (text.length > MAX_FOCUS_TEXT) throw new DomainError(`Maksymalnie ${MAX_FOCUS_TEXT} znaków`);
  const focus: WeekFocus = { weekStart: weekStart(localDate(today)), text };
  await repositories.upsertWeekFocus(focus);
  return focus;
}

// ── historia commitów ──────────────────────────────────────────────────────────

export const MAX_HISTORY_DAYS = 90;

/** Commity z gita dzień po dniu za ostatnie `days` dni (łącznie z dziś), wszystkie projekty z dostępnym repo. */
export async function getCommitHistory(
  days: number,
  today: Date = new Date()
): Promise<CommitHistory> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
    throw new DomainError(`days musi być liczbą całkowitą 1–${MAX_HISTORY_DAYS}`);
  }
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }
  const from = dates[0];
  const to = dates[dates.length - 1];
  const history = projectsServices.listGitHistory(from, to);
  if (history.length === 0) return { from, to, available: false, total: 0, totalPrs: 0, days: [] };
  const result = dates.map((date) => {
    const projects = history
      .map((h) => ({ projectId: h.projectId, name: h.name, count: h.days[date] ?? 0 }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"));
    const prs = history.reduce((sum, h) => sum + (h.prs[date] ?? 0), 0);
    return { date, total: projects.reduce((sum, p) => sum + p.count, 0), prs, projects };
  });
  return {
    from,
    to,
    available: true,
    total: result.reduce((sum, d) => sum + d.total, 0),
    totalPrs: result.reduce((sum, d) => sum + d.prs, 0),
    days: result,
  };
}

// ── historia review ────────────────────────────────────────────────────────────

/**
 * Review użytkownika dzień po dniu za ostatnie `days` dni (łącznie z dziś), dzień w strefie lokalnej.
 * Zatwierdzone (`APPROVED`) i komentarze (`COMMENTED`) liczone osobno; `CHANGES_REQUESTED` wchodzi
 * tylko do liczby różnych PR-ów.
 */
export async function getReviewHistory(
  days: number,
  today: Date = new Date()
): Promise<ReviewHistory> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
    throw new DomainError(`days musi być liczbą całkowitą 1–${MAX_HISTORY_DAYS}`);
  }
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }
  const from = dates[0];
  const to = dates[dates.length - 1];
  // zapas jednego dnia na strefy czasowe: GitHub filtruje `updated:` po dacie UTC
  const updatedSince = localDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
  );
  const res = await repositories.loadMyReviews(updatedSince);
  if (!res.available) {
    return { from, to, available: false, approved: 0, comments: 0, prs: 0, days: [] };
  }
  const perDay = new Map(dates.map((date) => [date, { date, approved: 0, comments: 0 }]));
  const prs = new Set<string>();
  for (const review of res.reviews) {
    const day = perDay.get(localDate(new Date(review.submittedAt)));
    if (!day) continue;
    prs.add(`${review.repo}#${review.number}`);
    if (review.state === "APPROVED") day.approved += 1;
    else if (review.state === "COMMENTED") day.comments += 1;
  }
  const result = dates.map((date) => perDay.get(date)!);
  return {
    from,
    to,
    available: true,
    approved: result.reduce((sum, d) => sum + d.approved, 0),
    comments: result.reduce((sum, d) => sum + d.comments, 0),
    prs: prs.size,
    days: result,
  };
}

// ── prośby o review ────────────────────────────────────────────────────────────

export const MAX_REVIEW_REQUESTS = 20;

/** Prośby o review z GitHuba (PR-y otwarte i zmergowane): najnowsze pierwsze, maksymalnie `MAX_REVIEW_REQUESTS`. */
export async function getReviewRequests(): Promise<ReviewRequests> {
  const res = await repositories.loadReviewRequests();
  const items = [...res.items]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_REVIEW_REQUESTS);
  return { available: res.available, total: res.total, items };
}

/**
 * Tekst zadania z ustawioną energią: usuwa dotychczasowe znaczniki (`#deep`, `#quick`, `[energy:: …]`),
 * resztę zostawia bez zmian i dopisuje `#energia` na końcu (`null` = sama reszta).
 */
export function withEnergy(raw: string, energy: Energy | null): string {
  const rest = raw.replace(ENERGY_MARK, "").trim();
  return energy === null ? rest : [rest, `#${energy}`].filter((part) => part !== "").join(" ");
}

function assertNotEmpty(text: string): void {
  if (text === "") throw new DomainError("Zadanie nie może składać się tylko ze znacznika energii");
}

/**
 * Ustawia (albo zdejmuje, `null`) energię zadania w jego źródle, przez znacznik w tekście zadania.
 * Zwraca źródło po zmianie: dla zadania projektu ma nowy tekst, którym wskazuje się je dalej.
 */
export async function setQueueItemEnergy(
  source: QueueSource,
  energy: Energy | null
): Promise<QueueSource> {
  if (source.type === "task") {
    const task = (await tasksServices.getTasks()).find((t) => t.id === source.taskId);
    if (!task) throw new NotFoundError("Nie ma takiego zadania");
    const title = withEnergy(task.title, energy);
    assertNotEmpty(title);
    if (title !== task.title) await tasksServices.updateTask(source.taskId, { title });
    return source;
  }
  const text = withEnergy(source.text, energy);
  assertNotEmpty(text);
  if (text === source.text) return source;
  const occurrence = await projectsServices.rewriteNowTask(
    source.projectId,
    source.text,
    text,
    source.occurrence
  );
  return { type: "project", projectId: source.projectId, text, occurrence };
}

/** Oznacza pozycję kolejki jako zrobioną w jej źródle (zadanie ogólne albo zadanie `[now::]` projektu). */
export async function completeQueueItem(source: QueueSource): Promise<void> {
  if (source.type === "task") {
    await tasksServices.updateTask(source.taskId, { status: "done" });
    return;
  }
  await projectsServices.completeNowTask(source.projectId, source.text, source.occurrence);
}

// ── przegląd tygodnia ──────────────────────────────────────────────────────────

export const WEEK_REVIEW_DAYS = 7;
export const MAX_WEEK_SUBJECTS = 15;

/**
 * Prompt dla agenta (Markdown, zawsze po polsku). Sekcje bez danych są pomijane. Nic nie jest
 * wysyłane: tekst trafia do schowka użytkownika. Dane firmy są tu już zamaskowane przez `getWeekReview`.
 */
export function composeWeekPrompt(r: Omit<WeekReview, "prompt">): string {
  const head = [
    `# Przegląd tygodnia ${r.from} – ${r.to}`,
    "",
    "Zrób retrospektywę: co zostało domknięte, co wisi bez ruchu, na czym straciłem czas.",
    `Zaproponuj 1–3 tematy focusu na tydzień od ${r.weekStart} (jedno zdanie każdy).`,
    "Dane pochodzą z mojego vaulta i gita; lista zamkniętych zadań to przybliżenie (liczą się tylko wpisy z datą na końcu).",
  ];
  const sections: string[][] = [];

  const commits = ["## Commity i PR-y"];
  const active = r.projects.filter((p) => p.commits > 0 || p.prs > 0);
  if (!r.git.available) commits.push("Dane z gita niedostępne.");
  else if (active.length === 0) commits.push("Brak commitów w tym oknie.");
  for (const p of active) {
    commits.push(
      `- ${p.name}${p.work ? " (dane z firmy)" : ""} — commity: ${p.commits}, PR: ${p.prs}`
    );
    const shown = p.subjects.slice(0, MAX_WEEK_SUBJECTS);
    for (const subject of shown) commits.push(`  - ${subject}`);
    if (p.subjects.length > shown.length) {
      commits.push(`  - … i ${p.subjects.length - shown.length} więcej`);
    }
  }
  sections.push(commits);

  const done = r.projects.filter((p) => p.doneTasks.length > 0);
  if (done.length > 0) {
    const lines = ["## Zamknięte zadania (przybliżenie)"];
    for (const p of done) {
      lines.push(`- ${p.name}`);
      for (const task of p.doneTasks) lines.push(`  - ${task}`);
    }
    sections.push(lines);
  }

  if (r.closings.length > 0) {
    sections.push([
      "## Zamknięcia dnia",
      ...r.closings.map((c) => `- ${c.date}: ${c.text ?? "(dane z firmy, treść pominięta)"}`),
    ]);
  }

  if (r.reviews.available) {
    sections.push([
      "## Review",
      `Zatwierdzone: ${r.reviews.approved}, komentarze: ${r.reviews.comments}, PR-y: ${r.reviews.prs}`,
    ]);
  }

  if (r.meetings.count > 0) {
    sections.push([
      "## Spotkania",
      `Spotkań: ${r.meetings.count}, łącznie ${r.meetings.minutes} min`,
    ]);
  }

  if (r.containsWork) sections.push(["Uwaga: projekty z danymi firmy są tylko jako liczby."]);

  return [head.join("\n"), ...sections.map((section) => section.join("\n"))].join("\n\n");
}

/**
 * Zestawienie ostatnich 7 dni (łącznie z dziś) i prompt dla agenta. Każde źródło osobno: brak gita,
 * `gh`, kalendarza albo zamknięć dnia daje pustą sekcję, nie wyjątek (błąd rejestru projektów leci wyżej).
 * Projekty z danymi firmy (`hasCompanyData`) trafiają tylko jako nazwa i liczby.
 */
export async function getWeekReview(today: Date = new Date()): Promise<WeekReview> {
  const to = localDate(today);
  const from = shiftDay(to, -(WEEK_REVIEW_DAYS - 1));
  const company = new Map(
    projectsServices
      .listProjects()
      .projects.map((p) => [p.id, projectsServices.hasCompanyData(p.owner, p.type)] as const)
  );
  const isCompany = (id: string | null) => id !== null && company.get(id) === true;

  const history = projectsServices.listGitHistory(from, to);
  const sum = (record: Record<string, number>) =>
    Object.values(record).reduce((total, n) => total + n, 0);
  const rows = new Map<string, WeekReviewProject>();
  const ensure = (projectId: string, name: string): WeekReviewProject => {
    let row = rows.get(projectId);
    if (!row) {
      row = {
        projectId,
        name,
        work: isCompany(projectId),
        commits: 0,
        prs: 0,
        subjects: [],
        doneTasks: [],
      };
      rows.set(projectId, row);
    }
    return row;
  };
  for (const h of history) {
    const commits = sum(h.days);
    const prs = sum(h.prs);
    if (commits === 0 && prs === 0) continue;
    const row = ensure(h.projectId, h.name);
    row.commits = commits;
    row.prs = prs;
  }
  for (const s of projectsServices.listGitSubjects(from, to)) {
    const row = rows.get(s.projectId);
    if (row && !row.work) row.subjects = s.subjects;
  }
  for (const d of projectsServices.listDoneTasksInWindow(from, to)) {
    if (isCompany(d.projectId) || d.tasks.length === 0) continue;
    ensure(d.projectId, d.name).doneTasks = d.tasks;
  }
  const projects = [...rows.values()].sort(
    (a, b) => b.commits - a.commits || a.name.localeCompare(b.name, "pl")
  );

  let closings: WeekReviewClosing[] = [];
  try {
    closings = repositories
      .readClosings()
      .filter((c) => c.date >= from && c.date <= to)
      .map((c) => ({
        date: c.date,
        text: isCompany(c.projectId) ? null : c.text,
        projectId: c.projectId,
      }));
  } catch {
    closings = [];
  }

  let meetings = { count: 0, minutes: 0 };
  try {
    const entries = await calendarServices.getCalendarEvents({ startDate: from, endDate: to });
    const own = entries.filter((e) => e.type === "meeting" && e.date >= from && e.date <= to);
    meetings = {
      count: own.length,
      minutes: own.reduce((total, e) => total + e.duration_minutes, 0),
    };
  } catch {
    meetings = { count: 0, minutes: 0 };
  }

  const reviewHistory = await getReviewHistory(WEEK_REVIEW_DAYS, today);

  const review: Omit<WeekReview, "prompt"> = {
    from,
    to,
    weekStart: weekStart(to),
    git: {
      available: history.length > 0,
      commits: projects.reduce((total, p) => total + p.commits, 0),
      prs: projects.reduce((total, p) => total + p.prs, 0),
    },
    projects,
    closings,
    reviews: {
      available: reviewHistory.available,
      approved: reviewHistory.approved,
      comments: reviewHistory.comments,
      prs: reviewHistory.prs,
    },
    meetings,
    containsWork: projects.some((p) => p.work) || closings.some((c) => c.text === null),
  };
  return { ...review, prompt: composeWeekPrompt(review) };
}
