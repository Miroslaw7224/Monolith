import type {
  ContextPack,
  ContextPackRole,
  GitSnapshotResult,
  ProjectWithContent,
  RepoUnavailableReason,
} from "@/contexts/bc_projects/models";

export const PACK_BUDGET_TOKENS = 4000;
/** Szacunek bez tokenizera: 4 znaki na token. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const REPO_REASON_TEXT: Record<RepoUnavailableReason, string> = {
  "unsupported-path": "ścieżka spoza WSL",
  "outside-home": "ścieżka poza katalogiem domowym",
  missing: "katalog nie istnieje",
  "not-a-repo": "to nie jest repozytorium git",
  "git-error": "git zwrócił błąd",
};

/** Ostrzeżenie dla projektów etatu (`owner: work`); pierwsze na liście `warnings` paczki. Dotyczy człowieka, nie trafia do markdownu. */
export const OWNER_WORK_WARNING = "Dane z firmy: sprawdź, gdzie wklejasz";

export type PackRules = { source: "ai-context.md" | "CLAUDE.md" | "index.md"; text: string };

export type ContextPackInput = {
  project: ProjectWithContent;
  /** Wynik `effectiveLastWorked(...)`; `undefined`, gdy brak. */
  lastWorked: string | undefined;
  rules: PackRules | null;
  git: GitSnapshotResult;
  /** Ostrzeżenia zebrane przez `buildContextPack`; kompozytor dopisuje własne. */
  warnings: string[];
  /** Rola paczki (zestaw sekcji); brak = `full`. */
  role?: ContextPackRole;
};

const FRESHNESS_LABEL = { fresh: "świeży", stale: "nieświeży", unknown: "brak danych" } as const;
const DIFF_LINES_MAX = 40;
const RULES_MIN_CHARS = 800;

type Knobs = {
  diffLines: number;
  logCount: number;
  diff: boolean;
  devlog: number;
  rulesMax: number;
};

export type SectionId = "rules" | "state" | "git" | "tasks" | "bugs" | "devlog";

type RoleProfile = {
  /** Sekcje po nagłówku, w kolejności paczki. */
  order: readonly SectionId[];
  /** Które kolumny tablicy trafiają do sekcji „Zadania”. */
  tasks: { blockers: boolean; now: boolean };
  /** Czy sekcja „Kod” zawiera `diff --stat`. */
  diff: boolean;
  /** Kroki redukcji do budżetu nie ruszają `diff --stat`. */
  protectDiff: boolean;
  /** Limit znaków zasad od początku (`Infinity` = bez limitu); wybór roli, nie cięcie do budżetu. */
  rulesMax: number;
};

/** Profile ról paczki; `full` odtwarza paczkę sprzed wprowadzenia ról (kolejność i zawartość bez zmian). */
export const ROLE_PROFILES: Record<ContextPackRole, RoleProfile> = {
  full: {
    order: ["rules", "state", "git", "tasks", "bugs", "devlog"],
    tasks: { blockers: true, now: true },
    diff: true,
    protectDiff: false,
    rulesMax: Infinity,
  },
  review: {
    order: ["rules", "state", "git", "tasks"],
    tasks: { blockers: false, now: true },
    diff: true,
    protectDiff: true,
    rulesMax: Infinity,
  },
  implementation: {
    order: ["rules", "state", "tasks", "git", "bugs"],
    tasks: { blockers: true, now: true },
    diff: false,
    protectDiff: false,
    rulesMax: Infinity,
  },
  debug: {
    order: ["bugs", "state", "git", "devlog", "rules"],
    tasks: { blockers: true, now: true },
    diff: true,
    protectDiff: false,
    rulesMax: 1200,
  },
};

const lineCount = (text: string) => (text === "" ? 0 : text.split("\n").length);

/** Pierwsze `n` linii; gdy jest ich więcej, dopisuje `… i N więcej linii`. */
function limitLines(text: string, n: number): string {
  const lines = text.split("\n");
  if (lines.length <= n) return text;
  return [...lines.slice(0, n), `… i ${lines.length - n} więcej linii`].join("\n");
}

/**
 * Cięcie do `max` znaków (łącznie z sufiksem `\n\n…`) po granicy akapitu `\n\n`, o ile akapit
 * kończy się w drugiej połowie limitu; inaczej twarde cięcie. Wynik nigdy nie jest dłuższy niż `max`,
 * więc krok redukcji nie może powiększyć paczki.
 */
function cutAtParagraph(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 3);
  const i = head.lastIndexOf("\n\n");
  return `${(i >= max / 2 ? head.slice(0, i) : head).trimEnd()}\n\n…`;
}

const ATX_HEADING = /^ {0,3}(#{1,6})(?=\s|$)/;
const FENCE = /^ {0,3}(```|~~~)/;

/**
 * Obniża nagłówki ATX tak, by najwyższy z nich był `###` (pod sekcją „Zasady projektu” `##`),
 * a pozostałe o tyle samo niżej (maks. `######`). Nagłówki w blokach kodu (``` i ~~~) nie są
 * ruszane; niedomknięty blok kodu trwa do końca tekstu. Tekst bez nagłówków albo z nagłówkami
 * od `###` wzwyż wraca bez zmian.
 */
export function demoteHeadings(text: string): string {
  const lines = text.split("\n");
  const heading: (number | null)[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const f = FENCE.exec(line);
    if (fence !== null) {
      if (f && f[1] === fence) fence = null;
      heading.push(null);
    } else if (f) {
      fence = f[1];
      heading.push(null);
    } else {
      const h = ATX_HEADING.exec(line);
      heading.push(h ? h[1].length : null);
    }
  }
  const levels = heading.filter((l): l is number => l !== null);
  if (levels.length === 0) return text;
  const shift = Math.max(0, 3 - Math.min(...levels));
  if (shift === 0) return text;
  return lines
    .map((line, i) => {
      const level = heading[i];
      if (level === null) return line;
      return (
        "#".repeat(Math.min(6, level + shift)) +
        line.slice(level + (line.length - line.trimStart().length))
      );
    })
    .join("\n");
}

const block = (text: string) => `\`\`\`\n${text}\n\`\`\``;

function renderPack(input: ContextPackInput, k: Knobs, profile: RoleProfile): string {
  const { project, git, rules, lastWorked } = input;

  // Niepoprawna data (świeżość `unknown`) nie jest wypisywana.
  const worked =
    lastWorked && project.freshness !== "unknown"
      ? `${lastWorked} (${FRESHNESS_LABEL[project.freshness]})`
      : FRESHNESS_LABEL.unknown;
  const head = `# Kontekst projektu: ${project.name}\n\nStatus: ${project.status} · priorytet: ${project.priority} · ostatnia praca: ${worked}`;

  const open = (items: { text: string; done: boolean }[]) =>
    items.filter((t) => t.done === false).map((t) => `- ${t.text}`);

  const render: Record<SectionId, () => string | null> = {
    rules: () => {
      if (!rules) return null;
      const text = k.rulesMax === Infinity ? rules.text : cutAtParagraph(rules.text, k.rulesMax);
      return `## Zasady projektu (źródło: ${rules.source})\n\n${text}`;
    },
    state: () => {
      if (project.state) {
        const s = project.state;
        const lines = [
          `Branch: ${s.branch || "—"} · Środowisko: ${s.env || "—"}`,
          `Bloker: ${s.blocker || "brak"}`,
          `Następny krok: ${s.nextStep || "—"}`,
        ];
        if (s.milestone) {
          lines.push(
            `Kamień milowy: ${s.milestone}${s.milestoneDue ? ` · do ${s.milestoneDue}` : ""}`
          );
        }
        return `## Save State\n\n${lines.join("\n")}`;
      }
      if (project.whereIStopped) {
        return `## Gdzie skończyłem (brak state.md)\n\n${project.whereIStopped}`;
      }
      return null;
    },
    git: () => {
      if (git.ok === false) {
        return `## Kod (git)\n\nRepozytorium niedostępne (${REPO_REASON_TEXT[git.reason]}).`;
      }
      const { status, log, diffStat } = git.snapshot;
      const parts = [`Status:\n${block(status)}`];
      const logText = log.split("\n").slice(0, k.logCount).join("\n");
      if (logText !== "") parts.push(`Ostatnie commity:\n${block(logText)}`);
      if (k.diff && diffStat !== "") {
        parts.push(`Zmiany (diff --stat):\n${block(limitLines(diffStat, k.diffLines))}`);
      }
      return `## Kod (git)\n\n${parts.join("\n\n")}`;
    },
    tasks: () => {
      const blockers = profile.tasks.blockers ? open(project.board.blockers) : [];
      const now = profile.tasks.now ? open(project.board.now) : [];
      if (blockers.length === 0 && now.length === 0) return null;
      let tasks = "## Zadania";
      if (blockers.length > 0) tasks += `\n\n### Blokery\n${blockers.join("\n")}`;
      if (now.length > 0) tasks += `\n\n### Teraz\n${now.join("\n")}`;
      return tasks;
    },
    bugs: () => {
      const bugs = project.bugs
        .filter((b) => b.section !== "Zamknięte")
        .map(
          (b) =>
            `- ${b.id}: ${b.title}${b.priority ? ` [${b.priority}]` : ""}${b.status ? ` (${b.status})` : ""}`
        );
      return bugs.length > 0 ? `## Bugi (otwarte)\n\n${bugs.join("\n")}` : null;
    },
    devlog: () => {
      const entries = project.devlog.slice(0, k.devlog);
      if (entries.length === 0) return null;
      const lines = entries.map(
        (e) => `- ${e.date ?? "—"}: ${e.title}${e.why ? ` — ${e.why}` : ""}`
      );
      return `## Devlog (ostatnie ${entries.length})\n\n${lines.join("\n")}`;
    },
  };

  const sections = profile.order.map((id) => render[id]()).filter((s): s is string => s !== null);
  return [head, ...sections].join("\n\n");
}

/**
 * Składa paczkę kontekstu w budżecie tokenów. Gdy pełna paczka go przekracza, wykonuje kroki
 * redukcji po kolei (git → devlog → zasady) aż się zmieści; Save State, „Gdzie skończyłem”,
 * Zadania i Bugi nigdy nie są skracane. Zestaw i kolejność sekcji wynikają z roli (`ROLE_PROFILES`).
 */
export function composeContextPack(
  rawInput: ContextPackInput,
  budgetTokens: number = PACK_BUDGET_TOKENS
): ContextPack {
  const profile = ROLE_PROFILES[rawInput.role ?? "full"];
  // Nagłówki zasad schodzą pod sekcję „Zasady” raz, na wejściu: budżet i cięcie liczą się już po tym.
  const input: ContextPackInput = rawInput.rules
    ? { ...rawInput, rules: { ...rawInput.rules, text: demoteHeadings(rawInput.rules.text) } }
    : rawInput;
  // Role bez `diff --stat` albo z chronionym nie mają kroków redukcji dla diffu, a role bez Devlogu kroków devlogu.
  const stat =
    input.git.ok && profile.diff && !profile.protectDiff
      ? lineCount(input.git.snapshot.diffStat)
      : 0;
  const logLines = input.git.ok ? lineCount(input.git.snapshot.log) : 0;
  const devlogLength = profile.order.includes("devlog") ? input.project.devlog.length : 0;
  const rulesLength = input.rules?.text.length ?? 0;

  let k: Knobs = {
    diffLines: DIFF_LINES_MAX,
    logCount: 5,
    diff: profile.diff,
    devlog: 3,
    rulesMax: profile.rulesMax,
  };
  let markdown = renderPack(input, k, profile);
  let truncated = false;
  const over = () => estimateTokens(markdown) > budgetTokens;
  // `truncated` tylko wtedy, gdy krok faktycznie coś skrócił (limit zasad z roli bywa już ciaśniejszy niż krok).
  const step = (next: Knobs) => {
    k = next;
    const rendered = renderPack(input, k, profile);
    if (rendered !== markdown) {
      truncated = true;
      markdown = rendered;
    }
  };

  if (over() && stat > 10 && k.diffLines > 10) step({ ...k, diffLines: 10 });
  if (over() && logLines > 3) step({ ...k, logCount: 3 });
  if (over() && stat > 0 && k.diff) step({ ...k, diff: false });
  if (over() && devlogLength > 2) step({ ...k, devlog: 2 });
  if (over() && devlogLength > 1) step({ ...k, devlog: 1 });
  while (over() && rulesLength > RULES_MIN_CHARS && k.rulesMax > RULES_MIN_CHARS) {
    step({
      ...k,
      rulesMax: Math.max(RULES_MIN_CHARS, Math.floor(Math.min(rulesLength, k.rulesMax) / 2)),
    });
  }

  const approxTokens = estimateTokens(markdown);
  const warnings = [...input.warnings];
  if (approxTokens > budgetTokens) warnings.push(`Paczka ponad budżet (~${approxTokens} tokenów)`);
  return { markdown, approxTokens, truncated, warnings };
}
