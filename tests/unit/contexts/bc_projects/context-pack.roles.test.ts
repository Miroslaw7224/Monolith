// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ContextPackRole, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  estimateTokens,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const BIG = 1_000_000;

const project: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
  whereIStopped: null,
  purpose: null,
  freshness: "fresh",
  tasks: [],
  board: {
    blockers: [{ text: "B1", done: false }],
    now: [
      { text: "N1", done: false },
      { text: "ZADANIE-GOTOWE", done: true },
    ],
    next: [{ text: "NASTEPNE-X", done: false }],
    icebox: [],
    version: null,
  },
  bugs: [
    { id: "BUG-1", title: "Pierwszy", section: "Aktywne", priority: "P1", status: "open" },
    { id: "BUG-3", title: "ZAMKNIETY", section: "Zamknięte" },
  ],
  state: {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "Zrobić Z",
    links: [],
    milestone: "",
    notes: "",
  },
  stateVersion: null,
  devlog: [
    { date: "2026-11-13", title: "Trzeci", why: "powód trzeci" },
    { date: "2026-11-12", title: "Drugi", why: "" },
  ],
};

const pad = (n: number) => String(n).padStart(3, "0");
const diffStat = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ` src/some/long/path/file${pad(i + 1)}.ts | 10 ++++++++++`
  ).join("\n");
const paragraphs = Array.from({ length: 30 }, (_, i) => `Akapit ${i + 1}: ${"x".repeat(90)}`).join(
  "\n\n"
);

function makeInput(over: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    project,
    lastWorked: "2026-11-10",
    rules: { source: "CLAUDE.md", text: paragraphs },
    git: {
      ok: true,
      snapshot: {
        status: "## main\n M a.txt",
        log: ["aaaaaaa c5", "bbbbbbb c4", "ccccccc c3", "ddddddd c2", "eeeeeee c1"].join("\n"),
        diffStat: diffStat(30),
      },
    },
    warnings: [],
    ...over,
  };
}

/** Sekcja od `heading` do następnego `\n\n## ` (albo do końca). */
function sectionOf(md: string, heading: string): string {
  const start = md.indexOf(heading);
  if (start < 0) return "";
  const next = md.indexOf("\n\n## ", start + heading.length);
  return next < 0 ? md.slice(start) : md.slice(start, next);
}

const HEADINGS = [
  "## Zasady projektu",
  "## Save State",
  "## Kod (git)",
  "## Zadania",
  "## Bugi (otwarte)",
  "## Devlog",
];

/** Nagłówki sekcji obecne w paczce, w kolejności w markdownie (`## main` w bloku kodu nie jest sekcją). */
const present = (md: string) =>
  HEADINGS.filter((h) => md.includes(`\n\n${h}`)).sort(
    (a, b) => md.indexOf(`\n\n${a}`) - md.indexOf(`\n\n${b}`)
  );

const pack = (role: ContextPackRole, budget = BIG) =>
  composeContextPack(makeInput({ role }), budget);

describe("composeContextPack: role", () => {
  it("brak roli = full", () => {
    expect(composeContextPack(makeInput(), BIG)).toEqual(pack("full"));
    expect(present(pack("full").markdown)).toEqual(HEADINGS);
  });

  it("review: Zasady, Save State, Kod, Zadania; tylko Teraz; diff --stat; bez Bugów i Devlogu", () => {
    const md = pack("review").markdown;
    expect(present(md)).toEqual([
      "## Zasady projektu",
      "## Save State",
      "## Kod (git)",
      "## Zadania",
    ]);
    const tasks = sectionOf(md, "## Zadania");
    expect(tasks).toContain("### Teraz\n- N1");
    expect(tasks).not.toContain("Blokery");
    expect(sectionOf(md, "## Kod (git)")).toContain("Zmiany (diff --stat)");
  });

  it("implementation: Zasady, Save State, Zadania, Kod, Bugi; Blokery i Teraz; Kod bez diff --stat; bez Devlogu", () => {
    const md = pack("implementation").markdown;
    expect(present(md)).toEqual([
      "## Zasady projektu",
      "## Save State",
      "## Zadania",
      "## Kod (git)",
      "## Bugi (otwarte)",
    ]);
    const tasks = sectionOf(md, "## Zadania");
    expect(tasks).toContain("### Blokery\n- B1");
    expect(tasks).toContain("### Teraz\n- N1");
    const code = sectionOf(md, "## Kod (git)");
    expect(code).toContain("Ostatnie commity");
    expect(code).not.toContain("diff --stat");
  });

  it("debug: Bugi, Save State, Kod, Devlog, Zasady; zasady do 1200 znaków bez flagi truncated; bez Zadań", () => {
    const result = pack("debug");
    const md = result.markdown;
    expect(present(md)).toEqual([
      "## Bugi (otwarte)",
      "## Save State",
      "## Kod (git)",
      "## Devlog",
      "## Zasady projektu",
    ]);
    expect(result.truncated).toBe(false);
    expect(sectionOf(md, "## Kod (git)")).toContain("Zmiany (diff --stat)");
    const rules = sectionOf(md, "## Zasady projektu");
    const body = rules.slice(rules.indexOf("\n\n") + 2);
    expect(body.length).toBeLessThanOrEqual(1200);
    expect(body.endsWith("…")).toBe(true);
  });

  it("nagłówek jest zawsze pierwszy", () => {
    for (const role of ["full", "review", "implementation", "debug"] as const) {
      expect(pack(role).markdown.startsWith("# Kontekst projektu: Alpha\n\nStatus:")).toBe(true);
    }
  });

  it("review chroni diff --stat przy cięciu do budżetu, full go przycina", () => {
    const LAST = "file030.ts";
    const size = (role: ContextPackRole) => estimateTokens(pack(role).markdown);

    const review = pack("review", size("review") - 100);
    expect(review.truncated).toBe(true);
    expect(review.markdown).toContain(LAST);
    expect(review.approxTokens).toBeLessThanOrEqual(size("review") - 100);

    const full = pack("full", size("full") - 100);
    expect(full.truncated).toBe(true);
    expect(full.markdown).not.toContain(LAST);
  });

  it("debug: krok redukcji, który nic nie zmienia w markdownie, nie ustawia truncated", () => {
    // Zasady już po cięciu roli (1200 znaków po granicy akapitu) mają ~700 znaków: dalsze cięcie
    // do 800 daje ten sam tekst. Brak devlogu, logu i diffu: żaden inny krok nic nie zmieni.
    const rules = `${"a".repeat(700)}\n\n${"b".repeat(1500)}`;
    const input = makeInput({
      project: { ...project, devlog: [] },
      rules: { source: "CLAUDE.md", text: rules },
      git: { ok: true, snapshot: { status: "## main", log: "", diffStat: "" } },
      role: "debug",
    });
    const full = composeContextPack(input, BIG);
    expect(full.truncated).toBe(false);
    expect(full.markdown).toContain("a".repeat(700));
    expect(full.markdown).not.toContain("b".repeat(50));

    const tight = composeContextPack(input, estimateTokens(full.markdown) - 1);
    expect(tight.markdown).toBe(full.markdown);
    expect(tight.truncated).toBe(false);
    expect(tight.warnings.some((w) => w.startsWith("Paczka ponad budżet"))).toBe(true);
  });

  it("implementation nie ma kroków diff: przy małym budżecie tnie log i zasady, nie diff", () => {
    const size = estimateTokens(pack("implementation").markdown);
    const result = pack("implementation", size - 100);
    expect(result.truncated).toBe(true);
    expect(result.markdown).not.toContain("diff --stat");
    expect(result.approxTokens).toBeLessThanOrEqual(size - 100);
  });
});
