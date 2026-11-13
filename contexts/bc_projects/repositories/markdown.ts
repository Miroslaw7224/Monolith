import type { BugEntry, ChecklistItem, ProjectState } from "@/contexts/bc_projects/models";
import { formatFrontmatter, parseFrontmatter } from "@/lib/nexus/frontmatter";

const SECTION_RE = /^## (.+?)\s*$/;
const CHECKBOX_RE = /^\s*[-*] \[( |x|X)\] (.*)$/;
const BUG_HEADING_RE = /^### (\S+)\s+[—–-]\s+(.+?)\s*$/;
const PRIORITY_RE = /^\s*- \*\*Priorytet:\*\*\s*(.+?)\s*$/;
const STATUS_RE = /^\s*- \*\*Status:\*\*\s*(.+?)\s*$/;

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

function textOf(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalText(value: unknown): string | undefined {
  const t = textOf(value);
  return t === "" ? undefined : t;
}

/** `state.md`: frontmatter YAML + treść (notes). Brak frontmattera: cały tekst trafia do `notes`. */
export function parseState(text: string, rel: string): ProjectState {
  let meta: Record<string, unknown> = {};
  let notes = text.trim();

  if (text.startsWith("---")) {
    const parsed = parseFrontmatter(text);
    if (parsed === null) {
      throw new Error(`${rel}: zepsuty frontmatter`);
    }
    meta = parsed.meta;
    notes = parsed.body.trim();
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

export function serializeState(state: ProjectState): string {
  return formatFrontmatter(
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
}
