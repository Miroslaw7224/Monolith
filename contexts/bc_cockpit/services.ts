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
  type QueueGroup,
  type QueueItem,
  type Topic,
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

function loadTopics(today: Date, warnings: string[]): Topic[] {
  let ids: string[];
  try {
    ids = repositories.readPinned().ids;
  } catch (err) {
    warnings.push(`Przypięte projekty: ${reason(err)}`);
    return [];
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
  return topics;
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

type QueueEntry = { projectId: string | null; name: string; owner: Owner; item: QueueItem };

const KIND_RANK: Record<QueueItem["kind"], number> = { overdue: 0, today: 1, now: 2 };

/** Sortuje (zaległe → dziś → now; w obrębie rodzaju po `due`), potem grupuje wg kolejności pierwszego wystąpienia. */
function groupQueue(entries: QueueEntry[]): QueueGroup[] {
  const sorted = [...entries].sort(
    (a, b) =>
      KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
      (a.item.due ?? "").localeCompare(b.item.due ?? "")
  );
  const groups = new Map<string, QueueGroup>();
  for (const entry of sorted) {
    const key = entry.projectId === null ? "general:" : `project:${entry.projectId}`;
    let group = groups.get(key);
    if (!group) {
      group = { projectId: entry.projectId, name: entry.name, owner: entry.owner, items: [] };
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
        item: {
          kind: "now",
          title: extractEnergy(t.text).title,
          due: null,
          projectName: t.projectName,
          priority: t.priority || null,
          energy: extractEnergy(t.text).energy,
        },
      });
    }
  } catch (err) {
    warnings.push(`Zadania projektów: ${reason(err)}`);
  }

  try {
    for (const t of await tasksServices.getTasks()) {
      if (t.status === "done" || !t.due_date) continue;
      if (!isPlausibleDate(t.due_date)) {
        warnings.push(`Zadanie "${t.title}": pominięto błędny termin ${t.due_date}`);
        continue;
      }
      if (t.due_date > date) continue;
      // Zadania ogólne nie mają pola `owner`: w 2-1 traktowane jako prywatne (spec D7).
      entries.push({
        projectId: null,
        name: GENERAL_NAME,
        owner: "personal",
        item: {
          kind: t.due_date < date ? "overdue" : "today",
          title: extractEnergy(t.title).title,
          due: t.due_date,
          projectName: null,
          priority: null,
          energy: extractEnergy(t.title).energy,
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
    return entries.flatMap((e) =>
      e.type === "task_deadline"
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
            },
          ]
    );
  } catch (err) {
    warnings.push(`Kalendarz: ${reason(err)}`);
    return [];
  }
}

/** Pierwsze dzisiejsze `meeting`, które jeszcze się nie skończyło (trwające liczy się jako następne). */
export function pickNextMeeting(events: DayEvent[], nowMinutes: number): NextMeeting | null {
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
const DAY_END = 18 * 60;
const MIN_WINDOW = 45;
const DEEP_MIN_WINDOW = 60;
const MAX_WINDOW = 150;
const MAX_WINDOWS = 3;

/**
 * Do 3 proponowanych okien w wolnych godzinach 08–18 (od „teraz”, zaokrąglonego w górę do 15 min):
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

// ── API serwisu ────────────────────────────────────────────────────────────────

/** Każde źródło w osobnym try/catch: awaria daje pustą sekcję i wpis w `warnings`, nie wyjątek. */
export async function getCockpit(today: Date = new Date()): Promise<Cockpit> {
  const date = localDate(today);
  const warnings: string[] = [];
  const topics = loadTopics(today, warnings);
  const queue = await loadQueue(date, warnings);
  const events = await loadEvents(date, warnings);
  const nextMeeting = pickNextMeeting(events, today.getHours() * 60 + today.getMinutes());
  const git = loadGit(today, topics, warnings);
  const inbox = loadInbox(warnings);
  const closing = loadClosing(date, warnings);
  const windows = planWindows(events, queue, today.getHours() * 60 + today.getMinutes());
  return { date, topics, queue, events, nextMeeting, git, inbox, windows, closing, warnings };
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
