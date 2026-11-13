/** Maksymalna liczba aktywnych tematów (limit skupienia, spec asystenta §6.2). */
export const MAX_PINNED = 3;

export type Owner = "personal" | "work";
export type Freshness = "fresh" | "stale" | "unknown";
/** `check`: temat zalegający lub z niezweryfikowanym stanem („do sprawdzenia”); `sure`: „pewne”. */
export type Confidence = "sure" | "check";

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
  /** `state.branch` (przycięty); `null`, gdy pusty lub brak `state.md`. */
  branch: string | null;
  /** `state.updated` albo `last_worked`; `null`, gdy brak obu. */
  lastActivity: string | null;
  confidence: Confidence;
  /** Niezakończone zadania kolumny „Teraz” projektu. */
  nowCount: number;
  /** Bugi projektu spoza sekcji „Zamknięte”. */
  bugCount: number;
};

/** `overdue`: `due` < dziś, `today`: `due` = dziś, `now`: zadanie `[now::]` projektu. */
export type QueueKind = "overdue" | "today" | "now";
export type QueueItem = {
  kind: QueueKind;
  title: string;
  due: string | null;
  /** Nazwa projektu; `null` dla zadań ogólnych. */
  projectName: string | null;
  /** Priorytet projektu z rejestru („high”…); `null`, gdy brak. */
  priority: string | null;
};
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

/** Najbliższe jeszcze nie rozpoczęte wydarzenie typu `meeting` z dzisiejszego dnia. */
export type NextMeeting = { title: string; startMinutes: number; durationMinutes: number };

/** Git (tylko odczyt): commity dziś ze wszystkich projektów z dostępnym repo i gałąź pierwszego tematu. */
export type GitSummary = {
  commitsToday: number;
  projectsWithCommits: number;
  branch: string | null;
};

/** Rytuał zamknięcia dnia: jedno zdanie „od czego zacząć jutro” (+ opcjonalny projekt i commity dnia). */
export type Closing = {
  /** Dzień `RRRR-MM-DD` w strefie lokalnej serwera. */
  date: string;
  text: string;
  projectId: string | null;
  /** Suma commitów dnia z gita w chwili zamknięcia; `null`, gdy git niedostępny. */
  commits: number | null;
};

/** Commity jednego dnia: suma i podział na projekty (malejąco, tylko projekty z commitami). */
export type CommitDay = {
  date: string;
  total: number;
  projects: { projectId: string; name: string; count: number }[];
};

/** Historia commitów z gita (tylko odczyt), dzień po dniu, także dni bez commitów. */
export type CommitHistory = {
  from: string;
  to: string;
  /** `false`, gdy żadne repozytorium nie jest dostępne (wtedy `days` jest puste). */
  available: boolean;
  total: number;
  days: CommitDay[];
};

/** Liczba otwartych (niesegregowanych) wpisów `Inbox/inbox.md`. */
export type InboxSummary = { open: number };

export type Cockpit = {
  /** Dzień `RRRR-MM-DD` w strefie lokalnej serwera. */
  date: string;
  topics: Topic[];
  queue: QueueGroup[];
  events: DayEvent[];
  nextMeeting: NextMeeting | null;
  /** `null`: żadne repozytorium nie jest dostępne (albo git zawiódł, wtedy jest też ostrzeżenie). */
  git: GitSummary | null;
  /** `null`, gdy plik inboxu nie dał się odczytać (jest wtedy ostrzeżenie). */
  inbox: InboxSummary | null;
  /** `anchor`: najnowsze zamknięcie sprzed dziś („Zaczep z wczoraj”); `today`: dzisiejsze, jeśli jest. */
  closing: { anchor: Closing | null; today: Closing | null };
  warnings: string[];
};
