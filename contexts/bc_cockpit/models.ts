/** Maksymalna liczba aktywnych tematów (limit skupienia, spec asystenta §6.2). */
export const MAX_PINNED = 3;

export type Owner = "personal" | "work";
export type Freshness = "fresh" | "stale" | "unknown";

export type Pinned = { ids: string[] };

/** Skąd pochodzą treści tematu: `state.md`, `index.md` („Gdzie skończyłem”) albo nigdzie. */
export type TopicSource = "state" | "index" | "none";

export type Topic = {
  id: string;
  name: string;
  owner: Owner;
  freshness: Freshness;
  source: TopicSource;
  nextStep: string | null;
  blocker: string | null;
  whereIStopped: string | null;
};

/** `overdue`: `due` < dziś, `today`: `due` = dziś, `now`: zadanie `[now::]` projektu. */
export type QueueKind = "overdue" | "today" | "now";
export type QueueItem = { kind: QueueKind; title: string; due: string | null };
/** Grupa kolejki: projekt albo „Ogólne” (`projectId: null`). */
export type QueueGroup = {
  projectId: string | null;
  name: string;
  owner: Owner;
  items: QueueItem[];
};

export type DayEvent = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  type: "work" | "meeting";
  color: string;
};

export type Cockpit = {
  /** Dzień `RRRR-MM-DD` w strefie lokalnej serwera. */
  date: string;
  topics: Topic[];
  queue: QueueGroup[];
  events: DayEvent[];
  warnings: string[];
};
