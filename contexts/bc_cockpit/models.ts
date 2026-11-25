/** Maksymalna liczba aktywnych tematów (limit skupienia, spec asystenta §6.2). */
export const MAX_PINNED = 3;

export type Owner = "personal" | "work";
/** Rodzaj projektu (etykieta z `index.md` albo z `owner`), do koloru w Kokpicie; zob. spec rodzajów projektów. */
export type ProjectKind = "etat" | "wlasny" | "biblioteka";
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
  kind: ProjectKind;
  companyData: boolean;
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

/** Energia zadania: `deep` (skupienie) albo `quick` (szybkie); `null`, gdy brak znacznika. */
export type Energy = "deep" | "quick";

/** Skąd pochodzi pozycja kolejki (do domknięcia): zadanie ogólne po id albo zadanie „Teraz” projektu po tekście i numerze wystąpienia (przy identycznych tekstach). */
export type QueueSource =
  | { type: "task"; taskId: string }
  | { type: "project"; projectId: string; text: string; occurrence: number };

/** `overdue`: `due` < dziś, `today`: `due` = dziś, `upcoming`: `due` > dziś (termin ostateczny; zadanie jest do zrobienia już teraz), `now`: zadanie `[now::]` projektu, `undated`: otwarte zadanie ogólne bez terminu. */
export type QueueKind = "overdue" | "today" | "upcoming" | "now" | "undated";
/** Projekt zadania ogólnego (`[project:: …]`) znany w rejestrze: rodzaj do koloru i znacznika (spec zadań ogólnych, P4). */
export type QueueItemProject = {
  id: string;
  name: string;
  kind: ProjectKind;
  companyData: boolean;
};

export type QueueItem = {
  kind: QueueKind;
  title: string;
  due: string | null;
  /** Nazwa projektu; `null` dla zadań ogólnych. */
  projectName: string | null;
  /** Priorytet projektu z rejestru („high”…); `null`, gdy brak. */
  priority: string | null;
  /** Z tagu `#deep` / `#quick` albo `[energy:: …]` w tekście zadania. */
  energy: Energy | null;
  /** Zadanie ogólne z priorytetem 1 („Pilne”, do zrobienia od ręki); brak pola = nie pilne. */
  urgent?: boolean;
  /** Tylko zadania ogólne ze znanym projektem; grupowanie kolejki się nie zmienia. */
  project?: QueueItemProject;
  source: QueueSource;
};
/** Grupa kolejki: projekt albo „Ogólne” (`projectId: null`). */
export type QueueGroup = {
  projectId: string | null;
  name: string;
  owner: Owner;
  /** Tylko grupy projektowe; grupa ogólna (`projectId: null`) nie ma rodzaju (brak koloru). */
  kind?: ProjectKind;
  companyData?: boolean;
  items: QueueItem[];
};

export type DayEvent = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  type: "work" | "meeting" | "visit";
  color: string;
  /** Adres spotkania online (http/https) albo `null`. */
  link: string | null;
  /** Notatka przed spotkaniem (wiele linii) albo `null`. */
  brief: string | null;
};

/** Najbliższe jeszcze nie zakończone wydarzenie typu `meeting`: z dziś albo, gdy nie ma, z najbliższych 60 dni. */
export type NextMeeting = {
  /** Dzień spotkania `RRRR-MM-DD` (dziś albo jeden z najbliższych dni). */
  date: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  /** Adres spotkania online (http/https) albo `null`. */
  link: string | null;
};

/** Wizyta (typ `visit`) z jutrzejszego dnia: przypomnienie w Kokpicie z wyprzedzeniem jednego dnia. */
export type TomorrowVisit = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
};

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
  /** Zmergowane PR-y dnia (z tematów commitów, wszystkie projekty). */
  prs: number;
  projects: { projectId: string; name: string; count: number }[];
};

/** Historia commitów z gita (tylko odczyt), dzień po dniu, także dni bez commitów. */
export type CommitHistory = {
  from: string;
  to: string;
  /** `false`, gdy żadne repozytorium nie jest dostępne (wtedy `days` jest puste). */
  available: boolean;
  total: number;
  totalPrs: number;
  days: CommitDay[];
};

/** PR (otwarty albo zmergowany) z wiszącą prośbą o review do użytkownika (tylko odczyt z GitHuba). */
export type ReviewRequest = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  author: string | null;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** Zmergowany PR nadal czeka na review (zniknie z listy dopiero po review użytkownika). */
  state: "open" | "merged";
  /** `requested`: wisząca prośba o review; `updated`: zrecenzowałem, a potem ktoś inny dołożył commit lub komentarz. */
  reason: "requested" | "updated";
};

/**
 * Prośby o review; `available: false`, gdy GitHub jest niedostępny (brak `gh`, sieci, logowania).
 * `total` to liczba wszystkich próśb, a `items` może być krótsze (limit listy).
 */
export type ReviewRequests = {
  available: boolean;
  /** false, gdy nie udało się sprawdzić PR-ów po review (prośby mimo to są pewne). */
  updatesAvailable: boolean;
  total: number;
  items: ReviewRequest[];
};

/** Własny, otwarty PR użytkownika (tylko odczyt z GitHuba). */
export type OpenPr = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** PR w trybie draft. */
  draft: boolean;
};

/**
 * Otwarte PR-y użytkownika; `available: false`, gdy GitHub jest niedostępny (brak `gh`, sieci, logowania).
 * `total` to liczba wszystkich PR-ów, a `items` może być krótsze (limit listy).
 */
export type OpenPrs = { available: boolean; total: number; items: OpenPr[] };

/** Własne review użytkownika na PR-ze (tylko odczyt z GitHuba). */
export type MyReview = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  state: "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED";
  /** Data ISO złożenia review. */
  submittedAt: string;
};

/** Review jednego dnia lokalnego: zatwierdzone i komentarze (każde review osobno). */
export type ReviewDay = { date: string; approved: number; comments: number };

/**
 * Historia review dzień po dniu. `prs` to liczba różnych PR-ów zrecenzowanych w okresie
 * (także z żądaniem zmian, które nie ma osobnego słupka). `available: false`, gdy GitHub
 * jest niedostępny (wtedy `days` jest puste).
 */
export type ReviewHistory = {
  from: string;
  to: string;
  available: boolean;
  approved: number;
  comments: number;
  prs: number;
  days: ReviewDay[];
};

/** Proponowane okno pracy w wolnej części dnia, przypisane do zadania z kolejki (bez zapisu). */
export type DeepWindow = {
  startMinutes: number;
  endMinutes: number;
  energy: Energy;
  title: string;
  /** Nazwa projektu zadania; `null` dla zadania ogólnego. */
  projectName: string | null;
};

/** Liczba otwartych (niesegregowanych) wpisów `Inbox/inbox.md`. */
export type InboxSummary = { open: number };

export type Cockpit = {
  /** Dzień `RRRR-MM-DD` w strefie lokalnej serwera. */
  date: string;
  topics: Topic[];
  /** Przypięte id z `Cockpit/pinned.yaml` (max 3), także projektów, które się nie wczytały jako tematy. */
  pinnedIds: string[];
  queue: QueueGroup[];
  events: DayEvent[];
  nextMeeting: NextMeeting | null;
  /** Wizyty z jutra, od najwcześniejszej; puste, gdy brak albo kalendarz zawiódł (jest wtedy ostrzeżenie). */
  tomorrowVisits: TomorrowVisit[];
  /** `null`: żadne repozytorium nie jest dostępne (albo git zawiódł, wtedy jest też ostrzeżenie). */
  git: GitSummary | null;
  /** `null`, gdy plik inboxu nie dał się odczytać (jest wtedy ostrzeżenie). */
  inbox: InboxSummary | null;
  /** Do 3 proponowanych okien Deep Work / Quick Win w wolnych godzinach dnia. */
  windows: DeepWindow[];
  /** `anchor`: najnowsze zamknięcie sprzed dziś („Zaczep z wczoraj”); `today`: dzisiejsze, jeśli jest. */
  closing: { anchor: Closing | null; today: Closing | null };
  /** Focus bieżącego tygodnia ISO z `Cockpit/weeks.yaml`; `null`, gdy go nie zapisano. */
  weekFocus: WeekFocus | null;
  warnings: string[];
};

/** Focus tygodnia: jedno zdanie z `Cockpit/weeks.yaml`; `weekStart` to poniedziałek tygodnia ISO (`RRRR-MM-DD`). */
export type WeekFocus = { weekStart: string; text: string };

/** Projekt w przeglądzie tygodnia; dla danych firmy (`work: true`) `subjects` i `doneTasks` są puste. */
export type WeekReviewProject = {
  projectId: string;
  name: string;
  work: boolean;
  commits: number;
  prs: number;
  subjects: string[];
  doneTasks: string[];
};

/** Zamknięcie dnia w przeglądzie; `text: null` dla projektu z danymi firmy. */
export type WeekReviewClosing = { date: string; text: string | null; projectId: string | null };

/** Zestawienie ostatnich 7 dni (`from`–`to`) i gotowy prompt dla agenta (nic nie jest wysyłane). */
export type WeekReview = {
  from: string;
  to: string;
  /** Poniedziałek tygodnia, w którym jest `to`. */
  weekStart: string;
  git: { available: boolean; commits: number; prs: number };
  projects: WeekReviewProject[];
  closings: WeekReviewClosing[];
  reviews: { available: boolean; approved: number; comments: number; prs: number };
  meetings: { count: number; minutes: number };
  /** Jest projekt albo zamknięcie dnia z danymi firmy (do ostrzeżenia przy kopiowaniu). */
  containsWork: boolean;
  prompt: string;
};
