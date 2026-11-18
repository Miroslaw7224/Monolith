import { fetchMyOpenPrs } from "@/lib/github/my-open-prs";
import { fetchReviewRequests } from "@/lib/github/review-requests";
import { fetchMyReviews } from "@/lib/github/my-reviews";
import { readList, updateList } from "@/lib/nexus/yaml-store";
import type { Closing, MyReview, OpenPrs, Pinned, ReviewRequests, WeekFocus } from "./models";

const FILE = "Cockpit/pinned.yaml";
const LIST_KEY = "projects";

/** Brak pliku = pusta lista. Uszkodzony YAML rzuca błąd z nazwą pliku (serwis robi z niego ostrzeżenie). */
export function readPinned(): Pinned {
  const ids: string[] = [];
  for (const item of readList(FILE, LIST_KEY)) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (id !== "" && !ids.includes(id)) ids.push(id);
  }
  return { ids };
}

/**
 * Zastępuje całą listę przez `updateList` (ponawianie na świeżej treści przy zmianie zewnętrznej,
 * po wyczerpaniu prób `ConflictError` = 409; plik, który się nie parsuje, nie jest nadpisywany).
 */
export async function writePinned(ids: string[]): Promise<void> {
  await updateList(FILE, LIST_KEY, () => ids.map((id) => ({ id })));
}

const CLOSING_FILE = "Cockpit/closing.yaml";
const CLOSING_KEY = "days";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Wpisy rosnąco po dacie; wpisy bez poprawnej daty lub tekstu (ręczna edycja) są pomijane. */
export function readClosings(): Closing[] {
  const result: Closing[] = [];
  for (const item of readList(CLOSING_FILE, CLOSING_KEY)) {
    const date = text(item.date);
    const body = text(item.text);
    if (!DAY_RE.test(date) || body === "") continue;
    result.push({
      date,
      text: body,
      projectId: text(item.project) || null,
      commits:
        typeof item.commits === "number" && Number.isInteger(item.commits) && item.commits >= 0
          ? item.commits
          : null,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** Jeden wpis na dzień: ten sam `date` nadpisuje poprzedni. Plik, który się nie parsuje, nie jest nadpisywany. */
export async function upsertClosing(closing: Closing): Promise<void> {
  await updateList(CLOSING_FILE, CLOSING_KEY, (items) => {
    const kept = items.filter((i) => text(i.date) !== closing.date);
    const entry: Record<string, unknown> = { date: closing.date, text: closing.text };
    if (closing.projectId) entry.project = closing.projectId;
    if (closing.commits !== null) entry.commits = closing.commits;
    return [...kept, entry].sort((a, b) => text(a.date).localeCompare(text(b.date)));
  });
}

const WEEKS_FILE = "Cockpit/weeks.yaml";
const WEEKS_KEY = "weeks";

/** Wpisy rosnąco po `week_start`; wpisy bez poprawnej daty lub tekstu (ręczna edycja) są pomijane. */
export function readWeekFocuses(): WeekFocus[] {
  const result: WeekFocus[] = [];
  for (const item of readList(WEEKS_FILE, WEEKS_KEY)) {
    const weekStart = text(item.week_start);
    const body = text(item.text);
    if (!DAY_RE.test(weekStart) || body === "") continue;
    result.push({ weekStart, text: body });
  }
  return result.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Jeden wpis na tydzień: ten sam `week_start` nadpisuje poprzedni. Plik, który się nie parsuje, nie jest nadpisywany. */
export async function upsertWeekFocus(focus: WeekFocus): Promise<void> {
  await updateList(WEEKS_FILE, WEEKS_KEY, (items) => {
    const kept = items.filter((i) => text(i.week_start) !== focus.weekStart);
    return [...kept, { week_start: focus.weekStart, text: focus.text }].sort((a, b) =>
      text(a.week_start).localeCompare(text(b.week_start))
    );
  });
}

/** Prośby o review z GitHuba (przez `lib/github`); błąd `gh` to `available: false`, nie wyjątek. */
export async function loadReviewRequests(): Promise<ReviewRequests> {
  const res = await fetchReviewRequests();
  if (res.ok === false) return { available: false, total: 0, items: [] };
  return {
    available: true,
    total: res.items.length,
    items: res.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      author: i.author,
      url: i.url,
      updatedAt: i.updatedAt,
      state: i.state,
    })),
  };
}

/** Własne otwarte PR-y z GitHuba (przez `lib/github`); błąd `gh` to `available: false`, nie wyjątek. */
export async function loadOpenPrs(): Promise<OpenPrs> {
  const res = await fetchMyOpenPrs();
  if (res.ok === false) return { available: false, total: 0, items: [] };
  return {
    available: true,
    total: res.items.length,
    items: res.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      url: i.url,
      updatedAt: i.updatedAt,
      draft: i.draft,
    })),
  };
}

/**
 * Własne review z PR-ów zmienionych od `updatedSince` (`RRRR-MM-DD`), przez `lib/github`;
 * błąd `gh` to `available: false`, nie wyjątek.
 */
export async function loadMyReviews(
  updatedSince: string
): Promise<{ available: boolean; reviews: MyReview[] }> {
  const res = await fetchMyReviews(updatedSince);
  if (res.ok === false) return { available: false, reviews: [] };
  return {
    available: true,
    reviews: res.reviews.map((r) => ({
      repo: r.repo,
      number: r.number,
      state: r.state,
      submittedAt: r.submittedAt,
    })),
  };
}
