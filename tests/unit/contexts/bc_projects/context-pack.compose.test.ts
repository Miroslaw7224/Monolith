// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";
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
    { id: "BUG-2", title: "Drugi", section: "Aktywne" },
    { id: "BUG-3", title: "ZAMKNIETY", section: "Zamknięte" },
  ],
  state: {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "Zrobić Z",
    links: [],
    milestone: "M1",
    milestoneDue: "2026-12-01",
    notes: "",
  },
  stateVersion: null,
  devlog: [
    { date: "2026-11-13", title: "Trzeci", why: "powód trzeci" },
    { date: "2026-11-12", title: "Drugi", why: "powód drugi" },
    { date: null, title: "Pierwszy", why: "" },
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
    warnings: ["wejściowe"],
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

describe("composeContextPack", () => {
  it("pełna paczka: sekcje w ustalonej kolejności, bez skracania", () => {
    const pack = composeContextPack(makeInput(), BIG);
    const md = pack.markdown;
    const order = [
      "# Kontekst projektu: Alpha",
      "## Zasady projektu (źródło: CLAUDE.md)",
      "## Save State",
      "## Kod (git)",
      "## Zadania",
      "## Bugi (otwarte)",
      "## Devlog (ostatnie 3)",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(md).toContain("Status: active · priorytet: high · ostatnia praca: 2026-11-10 (świeży)");
    expect(md).toContain("Branch: main · Środowisko: local");
    expect(md).toContain("Bloker: brak");
    expect(md).toContain("Następny krok: Zrobić Z");
    expect(md).toContain("Kamień milowy: M1 · do 2026-12-01");

    const tasks = sectionOf(md, "## Zadania");
    expect(tasks).toContain("### Blokery\n- B1");
    expect(tasks).toContain("### Teraz\n- N1");
    expect(tasks).not.toContain("ZADANIE-GOTOWE");
    expect(tasks).not.toContain("NASTEPNE-X");

    const bugs = sectionOf(md, "## Bugi (otwarte)");
    expect(bugs).toContain("- BUG-1: Pierwszy [P1] (open)");
    expect(bugs).toContain("- BUG-2: Drugi");
    expect(md).not.toContain("ZAMKNIETY");

    const devlog = sectionOf(md, "## Devlog (ostatnie 3)");
    expect(devlog).toContain("- 2026-11-13: Trzeci — powód trzeci");
    expect(devlog).toContain("- —: Pierwszy");

    expect(pack.truncated).toBe(false);
    expect(pack.approxTokens).toBe(Math.ceil(md.length / 4));
    expect(estimateTokens(md)).toBe(pack.approxTokens);
    expect(pack.warnings).toEqual(["wejściowe"]);
  });

  it("repozytorium niedostępne: adnotacja zamiast bloków git, reszta działa", () => {
    const pack = composeContextPack(
      makeInput({ git: { ok: false, reason: "unsupported-path" } }),
      BIG
    );
    const code = sectionOf(pack.markdown, "## Kod (git)");
    expect(code).toBe("## Kod (git)\n\nRepozytorium niedostępne (ścieżka spoza WSL).");
    expect(code).not.toContain("```");
    expect(pack.markdown).toContain("## Save State");
  });

  it("bez zasad i bez state.md: fallback „Gdzie skończyłem”", () => {
    const withWhere = composeContextPack(
      makeInput({ rules: null, project: { ...project, state: null, whereIStopped: "tu" } }),
      BIG
    );
    expect(withWhere.markdown).not.toContain("## Zasady");
    expect(withWhere.markdown).not.toContain("## Save State");
    expect(withWhere.markdown).toContain("## Gdzie skończyłem (brak state.md)\n\ntu");

    const none = composeContextPack(
      makeInput({ project: { ...project, state: null, whereIStopped: null } }),
      BIG
    );
    expect(none.markdown).not.toContain("## Save State");
    expect(none.markdown).not.toContain("## Gdzie skończyłem");
  });

  it("nagłówek: etykiety świeżości i brak daty", () => {
    const stale = composeContextPack(
      makeInput({ lastWorked: "2026-01-01", project: { ...project, freshness: "stale" } }),
      BIG
    );
    expect(stale.markdown).toContain("ostatnia praca: 2026-01-01 (nieświeży)");
    const unknown = composeContextPack(
      makeInput({ lastWorked: undefined, project: { ...project, freshness: "unknown" } }),
      BIG
    );
    expect(unknown.markdown).toContain("ostatnia praca: brak danych\n");
    expect(unknown.markdown).not.toContain("brak danych (");
  });

  it("limit 40 linii diff --stat nie jest krokiem redukcji", () => {
    const pack = composeContextPack(
      makeInput({
        git: { ok: true, snapshot: { status: "## main", log: "a c", diffStat: diffStat(100) } },
      }),
      BIG
    );
    expect(pack.markdown).toContain("file040.ts");
    expect(pack.markdown).not.toContain("file041.ts");
    expect(pack.markdown).toContain("… i 60 więcej linii");
    expect(pack.truncated).toBe(false);
  });

  it("budżet o 1 token za mały: pierwszy krok to diff --stat do 10 linii", () => {
    const full = composeContextPack(makeInput(), BIG);
    const r = composeContextPack(makeInput(), full.approxTokens - 1);
    expect(r.truncated).toBe(true);
    expect(r.approxTokens).toBeLessThan(full.approxTokens);
    expect(r.markdown).toContain("file010.ts");
    expect(r.markdown).not.toContain("file011.ts");
    expect(r.markdown).toContain("… i 20 więcej linii");
    // kolejne kroki nie ruszone
    expect(r.markdown).toContain("eeeeeee c1");
    expect(r.markdown).toContain("## Devlog (ostatnie 3)");
    expect(r.warnings).toEqual(["wejściowe"]);
  });

  it("budżet 0: wszystkie kroki, chronione sekcje bez zmian, ostrzeżenie", () => {
    const full = composeContextPack(makeInput(), BIG);
    const r = composeContextPack(makeInput(), 0);
    expect(r.truncated).toBe(true);
    expect(r.markdown).not.toContain("Zmiany (diff --stat)");
    expect(r.markdown).toContain("ccccccc c3");
    expect(r.markdown).not.toContain("ddddddd c2");
    expect(r.markdown).toContain("## Devlog (ostatnie 1)");
    const rules = sectionOf(r.markdown, "## Zasady projektu (źródło: CLAUDE.md)");
    const rulesBody = rules.slice(rules.indexOf("\n\n") + 2);
    expect(rulesBody.endsWith("…")).toBe(true);
    expect(rulesBody.length).toBeLessThanOrEqual(805);
    expect(r.warnings).toContain("wejściowe");
    expect(r.warnings.some((w) => w.startsWith("Paczka ponad budżet"))).toBe(true);
    for (const h of ["## Save State", "## Zadania", "## Bugi (otwarte)"]) {
      expect(sectionOf(r.markdown, h)).toBe(sectionOf(full.markdown, h));
    }
  });

  it("monotoniczność: mniejszy budżet nigdy nie daje większej paczki", () => {
    const full = composeContextPack(makeInput(), BIG);
    let previous = full.approxTokens;
    for (let budget = full.approxTokens; budget >= 0; budget -= 50) {
      const r = composeContextPack(makeInput(), budget);
      expect(r.approxTokens).toBeLessThanOrEqual(previous);
      previous = r.approxTokens;
      for (const h of ["## Save State", "## Zadania", "## Bugi (otwarte)"]) {
        expect(sectionOf(r.markdown, h)).toBe(sectionOf(full.markdown, h));
      }
    }
  });

  it("domyślny budżet to 4000 tokenów", () => {
    const small = composeContextPack(makeInput());
    expect(small.approxTokens).toBeLessThanOrEqual(4000);
  });
  it("niepoprawna data pracy przy świeżości unknown: samo „brak danych”", () => {
    const pack = composeContextPack(
      makeInput({ lastWorked: "nie-data", project: { ...project, freshness: "unknown" } }),
      BIG
    );
    expect(pack.markdown).toContain("ostatnia praca: brak danych\n");
    expect(pack.markdown).not.toContain("nie-data");
  });

  describe("kroki redukcji z osobna", () => {
    const gitWith = (log: string, stat: string) => ({
      ok: true as const,
      snapshot: { status: "## main", log, diffStat: stat },
    });
    const LOG5 = ["aaaaaaa c5", "bbbbbbb c4", "ccccccc c3", "ddddddd c2", "eeeeeee c1"].join("\n");

    it("krok 2: log z 5 do 3 commitów (diff --stat pusty)", () => {
      const input = makeInput({ git: gitWith(LOG5, ""), rules: null });
      const full = composeContextPack(input, BIG);
      const r = composeContextPack(input, full.approxTokens - 1);
      expect(r.truncated).toBe(true);
      expect(r.markdown).toContain("ccccccc c3");
      expect(r.markdown).not.toContain("ddddddd c2");
      expect(r.markdown).toContain("## Devlog (ostatnie 3)");
    });

    it("krok 3: usunięcie diff --stat (8 linii, log 3 commity)", () => {
      const log3 = LOG5.split("\n").slice(0, 3).join("\n");
      const input = makeInput({ git: gitWith(log3, diffStat(8)), rules: null });
      const full = composeContextPack(input, BIG);
      const r = composeContextPack(input, full.approxTokens - 1);
      expect(r.truncated).toBe(true);
      expect(r.markdown).not.toContain("Zmiany (diff --stat)");
      expect(r.markdown).toContain("ccccccc c3");
      expect(r.markdown).toContain("## Devlog (ostatnie 3)");
    });

    it("kroki 4 i 5: devlog z 3 do 2, potem do 1 wpisu", () => {
      const input = makeInput({ git: { ok: false, reason: "missing" }, rules: null });
      const full = composeContextPack(input, BIG);
      const two = composeContextPack(input, full.approxTokens - 1);
      expect(two.markdown).toContain("## Devlog (ostatnie 2)");
      expect(two.markdown).not.toContain("- —: Pierwszy");
      const one = composeContextPack(input, two.approxTokens - 1);
      expect(one.markdown).toContain("## Devlog (ostatnie 1)");
      expect(one.markdown).toContain("- 2026-11-13: Trzeci");
      expect(one.markdown).not.toContain("- 2026-11-12: Drugi");
    });
  });

  describe("cięcie zasad (krok 6)", () => {
    const rulesOf = (md: string) => {
      const sec = sectionOf(md, "## Zasady projektu (źródło: CLAUDE.md)");
      return sec.slice(sec.indexOf("\n\n") + 2);
    };

    it("wczesny akapit nie obcina zasad poniżej połowy limitu", () => {
      const text = `${"a".repeat(20)}\n\n${"b".repeat(2980)}`;
      const r = composeContextPack(makeInput({ rules: { source: "CLAUDE.md", text } }), 0);
      const body = rulesOf(r.markdown);
      expect(body.length).toBeGreaterThan(400);
      expect(body.length).toBeLessThanOrEqual(800);
      expect(body.endsWith("…")).toBe(true);
    });

    it("tekst 801 znaków bez akapitów: cięcie nie powiększa paczki", () => {
      const input = makeInput({
        git: { ok: false, reason: "missing" },
        project: { ...project, devlog: [] },
        rules: { source: "CLAUDE.md", text: "z".repeat(801) },
      });
      const full = composeContextPack(input, BIG);
      const r = composeContextPack(input, full.approxTokens - 1);
      expect(r.truncated).toBe(true);
      expect(r.approxTokens).toBeLessThanOrEqual(full.approxTokens);
      expect(rulesOf(r.markdown).length).toBeLessThanOrEqual(800);
    });
  });
});
