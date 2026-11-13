import type {
  ContextPack,
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

export type PackRules = { source: "ai-context.md" | "CLAUDE.md" | "index.md"; text: string };

export type ContextPackInput = {
  project: ProjectWithContent;
  /** Wynik `effectiveLastWorked(...)`; `undefined`, gdy brak. */
  lastWorked: string | undefined;
  rules: PackRules | null;
  git: GitSnapshotResult;
  /** Ostrzeżenia zebrane przez `buildContextPack`; kompozytor dopisuje własne. */
  warnings: string[];
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

const block = (text: string) => `\`\`\`\n${text}\n\`\`\``;

function renderPack(input: ContextPackInput, k: Knobs): string {
  const { project, git, rules, lastWorked } = input;
  const sections: string[] = [];

  // Niepoprawna data (świeżość `unknown`) nie jest wypisywana.
  const worked =
    lastWorked && project.freshness !== "unknown"
      ? `${lastWorked} (${FRESHNESS_LABEL[project.freshness]})`
      : FRESHNESS_LABEL.unknown;
  sections.push(
    `# Kontekst projektu: ${project.name}\n\nStatus: ${project.status} · priorytet: ${project.priority} · ostatnia praca: ${worked}`
  );

  if (rules) {
    const text = k.rulesMax === Infinity ? rules.text : cutAtParagraph(rules.text, k.rulesMax);
    sections.push(`## Zasady projektu (źródło: ${rules.source})\n\n${text}`);
  }

  if (project.state) {
    const s = project.state;
    const lines = [
      `Branch: ${s.branch || "—"} · Środowisko: ${s.env || "—"}`,
      `Bloker: ${s.blocker || "brak"}`,
      `Następny krok: ${s.nextStep || "—"}`,
    ];
    if (s.milestone) {
      lines.push(`Kamień milowy: ${s.milestone}${s.milestoneDue ? ` · do ${s.milestoneDue}` : ""}`);
    }
    sections.push(`## Save State\n\n${lines.join("\n")}`);
  } else if (project.whereIStopped) {
    sections.push(`## Gdzie skończyłem (brak state.md)\n\n${project.whereIStopped}`);
  }

  if (git.ok === false) {
    sections.push(`## Kod (git)\n\nRepozytorium niedostępne (${REPO_REASON_TEXT[git.reason]}).`);
  } else {
    const { status, log, diffStat } = git.snapshot;
    const parts = [`Status:\n${block(status)}`];
    const logText = log.split("\n").slice(0, k.logCount).join("\n");
    if (logText !== "") parts.push(`Ostatnie commity:\n${block(logText)}`);
    if (k.diff && diffStat !== "") {
      parts.push(`Zmiany (diff --stat):\n${block(limitLines(diffStat, k.diffLines))}`);
    }
    sections.push(`## Kod (git)\n\n${parts.join("\n\n")}`);
  }

  const open = (items: { text: string; done: boolean }[]) =>
    items.filter((t) => t.done === false).map((t) => `- ${t.text}`);
  const blockers = open(project.board.blockers);
  const now = open(project.board.now);
  if (blockers.length > 0 || now.length > 0) {
    let tasks = "## Zadania";
    if (blockers.length > 0) tasks += `\n\n### Blokery\n${blockers.join("\n")}`;
    if (now.length > 0) tasks += `\n\n### Teraz\n${now.join("\n")}`;
    sections.push(tasks);
  }

  const bugs = project.bugs
    .filter((b) => b.section !== "Zamknięte")
    .map(
      (b) =>
        `- ${b.id}: ${b.title}${b.priority ? ` [${b.priority}]` : ""}${b.status ? ` (${b.status})` : ""}`
    );
  if (bugs.length > 0) sections.push(`## Bugi (otwarte)\n\n${bugs.join("\n")}`);

  const entries = project.devlog.slice(0, k.devlog);
  if (entries.length > 0) {
    const lines = entries.map((e) => `- ${e.date ?? "—"}: ${e.title}${e.why ? ` — ${e.why}` : ""}`);
    sections.push(`## Devlog (ostatnie ${entries.length})\n\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Składa paczkę kontekstu w budżecie tokenów. Gdy pełna paczka go przekracza, wykonuje kroki
 * redukcji po kolei (git → devlog → zasady) aż się zmieści; Save State, „Gdzie skończyłem”,
 * Zadania i Bugi nigdy nie są skracane.
 */
export function composeContextPack(
  input: ContextPackInput,
  budgetTokens: number = PACK_BUDGET_TOKENS
): ContextPack {
  const stat = input.git.ok ? lineCount(input.git.snapshot.diffStat) : 0;
  const logLines = input.git.ok ? lineCount(input.git.snapshot.log) : 0;
  const devlogLength = input.project.devlog.length;
  const rulesLength = input.rules?.text.length ?? 0;

  let k: Knobs = {
    diffLines: DIFF_LINES_MAX,
    logCount: 5,
    diff: true,
    devlog: 3,
    rulesMax: Infinity,
  };
  let markdown = renderPack(input, k);
  let truncated = false;
  const over = () => estimateTokens(markdown) > budgetTokens;
  const step = (next: Knobs) => {
    k = next;
    truncated = true;
    markdown = renderPack(input, k);
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
