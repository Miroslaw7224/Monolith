import i18n, { currentLang, type Lang } from "@/src/i18n";
import type { Note } from "./useNotesData";

export type FrontmatterSplit = { frontmatter: string[] | null; body: string };

/** Oddziela blok `--- ... ---` na początku treści (domknięty) od reszty. */
export function splitFrontmatter(content: string): FrontmatterSplit {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { frontmatter: null, body: content };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end === -1) return { frontmatter: null, body: content };
  return { frontmatter: lines.slice(1, end), body: lines.slice(end + 1).join("\n") };
}

/** Odwrotność `splitFrontmatter`: skleja blok `---` z treścią z edytora (który widzi tylko treść). */
export function joinFrontmatter(frontmatter: string[] | null, body: string): string {
  return frontmatter ? `---\n${frontmatter.join("\n")}\n---\n${body}` : body;
}

const TAG_KEY = /^(tagi|tags)\s*:\s*(.*)$/i;

/** Tagi z linii frontmattera `tagi: [a, b]` / `tags: a, b` (bez `#` i cudzysłowów). */
export function extractTags(frontmatter: string[] | null): string[] {
  if (!frontmatter) return [];
  for (const line of frontmatter) {
    const match = TAG_KEY.exec(line.trim());
    if (!match) continue;
    return match[2]
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((t) =>
        t
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/^#/, "")
          .trim()
      )
      .filter(Boolean);
  }
  return [];
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type PopularTag = { tag: string; count: number };

/** Najczęstsze tagi z frontmatterów notatek (każdy tag liczony raz na notatkę). */
export function collectPopularTags(notes: Note[], limit = 5): PopularTag[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const tag of new Set(extractTags(splitFrontmatter(n.content).frontmatter))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export type NoteTile = {
  id: "notes" | "today" | "decisions" | "inbox";
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Cztery kafle statystyk (makieta 05). „Decyzje w devlogach” czeka na agregację devlogów
 * (etap 2), więc na razie ma pustą wartość. `inboxOpen === null` = brak danych o Inboxie.
 */
export function computeNoteTiles(
  notes: Note[],
  now: Date,
  inboxOpen: number | null,
  lang: Lang = currentLang()
): NoteTile[] {
  const lng = { lng: lang };
  const dates = notes
    .map((n) => new Date(n.created_at ?? ""))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  const todays = dates.filter((d) => sameDay(d, now));

  let todayMeta: string;
  if (notes.length === 0) todayMeta = i18n.t("notes:notesTileTodayMetaNoNotes", lng);
  else if (todays.length > 0)
    todayMeta = i18n.t("notes:notesTileTodayMetaLastTime", {
      ...lng,
      time: `${pad(todays[0].getHours())}:${pad(todays[0].getMinutes())}`,
    });
  else if (dates.length > 0)
    todayMeta = i18n.t("notes:notesTileTodayMetaLastDate", {
      ...lng,
      date: `${pad(dates[0].getDate())}.${pad(dates[0].getMonth() + 1)}`,
    });
  else todayMeta = i18n.t("notes:notesTileTodayMetaNoDate", lng);

  return [
    {
      id: "notes",
      label: i18n.t("notes:notesTileNotesLabel", lng),
      value: String(notes.length),
      meta: i18n.t("notes:notesTileNotesMeta", lng),
      accent: true,
    },
    {
      id: "today",
      label: i18n.t("notes:notesTileTodayLabel", lng),
      value: String(todays.length),
      meta: todayMeta,
    },
    {
      id: "decisions",
      label: i18n.t("notes:notesTileDecisionsLabel", lng),
      value: "—",
      meta: i18n.t("notes:notesTileDecisionsMeta", lng),
    },
    {
      id: "inbox",
      label: i18n.t("notes:notesTileInboxLabel", lng),
      value: inboxOpen === null ? "—" : String(inboxOpen),
      meta:
        inboxOpen === null
          ? i18n.t("notes:notesTileInboxMetaNoData", lng)
          : i18n.t("notes:notesTileInboxMetaOpen", lng),
    },
  ];
}
