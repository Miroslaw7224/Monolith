import type {
  BugEntry,
  ChecklistItem,
  DevlogEntry,
  ProjectState,
  ProjectType,
} from "@/contexts/bc_projects/models";
import { DomainError } from "@/lib/errors";
import { formatFrontmatter, parseFrontmatter } from "@/lib/nexus/frontmatter";

const SECTION_RE = /^## (.+?)\s*$/;
const CHECKBOX_RE = /^\s*[-*] \[( |x|X)\] (.*)$/;
const BUG_HEADING_RE = /^### (\S+)\s+[—–-]\s+(.+?)\s*$/;
const PRIORITY_RE = /^\s*- \*\*Priorytet:\*\*\s*(.+?)\s*$/;
const STATUS_RE = /^\s*- \*\*Status:\*\*\s*(.+?)\s*$/;
const DEVLOG_HEADING_RE = /^(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+)$/;
/** Ta sama reguła nagłówka co w `parseSections`, żeby prepend i parse zawsze zgadzały się co do granic wpisów. */
const FIRST_SECTION_RE = new RegExp(SECTION_RE.source, "m");
const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const TYPE_LINE = /^type:[ \t]*.*$/m;

export function parseSections(markdown: string): { heading: string; body: string }[] {
  const lines = markdown.split(/\r?\n/);
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const match = SECTION_RE.exec(line);
    if (match) {
      if (current) {
        sections.push({
          heading: current.heading,
          body: current.bodyLines.join("\n").trim(),
        });
      }
      current = { heading: match[1].trim(), bodyLines: [] };
      continue;
    }
    if (current) {
      current.bodyLines.push(line);
    }
  }

  if (current) {
    sections.push({
      heading: current.heading,
      body: current.bodyLines.join("\n").trim(),
    });
  }

  return sections;
}

export function parseChecklist(body: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = CHECKBOX_RE.exec(line);
    if (!match) continue;
    items.push({
      text: match[2].trimEnd(),
      done: match[1] !== " ",
    });
  }
  return items;
}

export function parseBugs(markdown: string): BugEntry[] {
  const bugs: BugEntry[] = [];
  let section = "";
  let current: BugEntry | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      current = null;
      continue;
    }

    const bugMatch = BUG_HEADING_RE.exec(line);
    if (bugMatch) {
      current = {
        id: bugMatch[1],
        title: bugMatch[2].trim(),
        section,
      };
      bugs.push(current);
      continue;
    }

    if (!current) continue;

    if (current.priority === undefined) {
      const priorityMatch = PRIORITY_RE.exec(line);
      if (priorityMatch) {
        current.priority = priorityMatch[1].trim();
        continue;
      }
    }

    if (current.status === undefined) {
      const statusMatch = STATUS_RE.exec(line);
      if (statusMatch) {
        current.status = statusMatch[1].trim();
      }
    }
  }

  return bugs;
}

/** Tekst z YAML; lista lub mapa wpisana ręcznie w polu tekstowym trafia jako JSON (nie „a,b” ani „[object Object]”). */
function textOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  return (typeof value === "object" ? JSON.stringify(value) : String(value)).trim();
}

/** Usuwa wiodące puste linie i końcowe białe znaki, zachowując wcięcie pierwszej linii (jak `formatFrontmatter`). */
function trimNotes(text: string): string {
  return text.replace(/^\n+/, "").replace(/\s+$/, "");
}

function optionalText(value: unknown): string | undefined {
  const t = textOf(value);
  return t === "" ? undefined : t;
}

/** `state.md`: frontmatter YAML + treść (notes). Brak frontmattera: cały tekst trafia do `notes`. */
export function parseState(text: string, rel: string): ProjectState {
  let meta: Record<string, unknown> = {};
  let notes = trimNotes(text);

  if (text.startsWith("---")) {
    const parsed = parseFrontmatter(text);
    if (parsed === null) {
      throw new Error(`${rel}: zepsuty frontmatter`);
    }
    meta = parsed.meta;
    notes = trimNotes(parsed.body);
  }

  const links = Array.isArray(meta.links)
    ? meta.links
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    : [];

  return {
    branch: textOf(meta.branch),
    env: textOf(meta.env),
    blocker: textOf(meta.blocker),
    nextStep: textOf(meta.next_step),
    links,
    milestone: textOf(meta.milestone),
    milestoneDue: optionalText(meta.milestone_due),
    updated: optionalText(meta.updated),
    notes,
  };
}

function sameStateFields(a: ProjectState, b: ProjectState): boolean {
  return (
    a.branch.trim() === b.branch.trim() &&
    a.env.trim() === b.env.trim() &&
    a.blocker.trim() === b.blocker.trim() &&
    a.nextStep.trim() === b.nextStep.trim() &&
    a.milestone.trim() === b.milestone.trim() &&
    (a.milestoneDue || undefined) === (b.milestoneDue || undefined) &&
    (a.updated || undefined) === (b.updated || undefined) &&
    a.links.length === b.links.length &&
    a.links.every((link, i) => link === b.links[i])
  );
}

/** Awaryjna serializacja: każdy tekst w cudzysłowie JSON (poprawny YAML), bez zgadywania stylu. */
function serializeStateQuoted(state: ProjectState): string {
  const q = (value: string) => JSON.stringify(value);
  const lines = [
    `branch: ${q(state.branch)}`,
    `env: ${q(state.env)}`,
    `blocker: ${q(state.blocker)}`,
    `next_step: ${q(state.nextStep)}`,
    state.links.length === 0
      ? "links: []"
      : ["links:", ...state.links.map((link) => `  - ${q(link)}`)].join("\n"),
    `milestone: ${q(state.milestone)}`,
    ...(state.milestoneDue ? [`milestone_due: ${q(state.milestoneDue)}`] : []),
    ...(state.updated ? [`updated: ${q(state.updated)}`] : []),
  ];
  return `---\n${lines.join("\n")}\n---\n\n${trimNotes(state.notes)}\n`;
}

/**
 * `formatFrontmatter` serializuje w YAML 1.1, a `parseFrontmatter` czyta w YAML 1.2; kilka wartości
 * (np. `0o10`, `1e3`) wraca więc jako liczba. Gdy round-trip zmieniłby tekst, zapisujemy wersję z cudzysłowami.
 */
export function serializeState(state: ProjectState): string {
  const out = formatFrontmatter(
    {
      branch: state.branch,
      env: state.env,
      blocker: state.blocker,
      next_step: state.nextStep,
      links: state.links,
      milestone: state.milestone,
      milestone_due: state.milestoneDue || undefined,
      updated: state.updated || undefined,
    },
    state.notes
  );
  return sameStateFields(parseState(out, "state.md"), state) ? out : serializeStateQuoted(state);
}

/** `devlog.md`: wpis = nagłówek `## YYYY-MM-DD — tytuł` + treść do następnego `## `. */
export function parseDevlog(text: string): DevlogEntry[] {
  return parseSections(text).map(({ heading, body }) => {
    const match = DEVLOG_HEADING_RE.exec(heading);
    return match
      ? { date: match[1], title: match[2].trim(), why: body }
      : { date: null, title: heading, why: body };
  });
}

/** Dopisuje wpis na górze (przed pierwszym `## `); reszta pliku bez zmian. */
export function prependDevlogEntry(
  text: string | null,
  entry: { date: string; title: string; why: string }
): string {
  const heading = `## ${entry.date} — ${entry.title}`;
  const block = entry.why === "" ? `${heading}\n` : `${heading}\n\n${entry.why}\n`;

  if (text === null || text.trim() === "") return `# Devlog\n\n${block}`;

  const first = FIRST_SECTION_RE.exec(text);
  if (first) {
    return text.slice(0, first.index) + block + "\n" + text.slice(first.index);
  }
  return text.replace(/\s+$/, "") + "\n\n" + block;
}

/** Zmienia tylko linię `type:` w frontmatterze (klucz w kolumnie 0); treść i pozostałe pola bez zmian. */
export function setFrontmatterType(text: string, type: ProjectType): string {
  const m = FRONTMATTER_BLOCK.exec(text);
  if (!m) {
    throw new DomainError("index.md nie ma frontmattera: nie ustawiono type", 422);
  }
  const block = m[1];
  const next = TYPE_LINE.test(block)
    ? block.replace(TYPE_LINE, `type: ${type}`)
    : `${block}\ntype: ${type}`;
  const result = "---\n" + next + text.slice(4 + block.length);
  // Nietypowy zapis (np. wartość `type:` w następnej linii) mógłby dać niepoprawny YAML: wtedy nic nie zapisujemy.
  const check = parseFrontmatter(result);
  if (check === null || check.meta.type !== type) {
    throw new DomainError("index.md ma nietypowy frontmatter: nie ustawiono type", 422);
  }
  return result;
}
