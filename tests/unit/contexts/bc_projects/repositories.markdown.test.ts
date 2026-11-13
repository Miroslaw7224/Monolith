// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectState } from "@/contexts/bc_projects/models";
import {
  parseBugs,
  parseChecklist,
  parseDevlog,
  parseSections,
  parseState,
  prependDevlogEntry,
  serializeState,
  setFrontmatterType,
} from "@/contexts/bc_projects/repositories/markdown";
import { DomainError } from "@/lib/errors";

describe("bc_projects markdown parsers", () => {
  it("sekcje w kolejności pliku", () => {
    const md =
      "# T\n\n## Blokery\n_Brak aktywnych blokerów_\n\n## Next\n- [ ] A\n\n## Backlog\n- [x] B\n";
    expect(parseSections(md).map((s) => s.heading)).toEqual(["Blokery", "Next", "Backlog"]);
  });

  it("tekst przed pierwszym ## pominięty", () => {
    expect(parseSections("# T\nwstęp\n## A\nx\n")).toEqual([{ heading: "A", body: "x" }]);
  });

  it("### nie tnie", () => {
    const sections = parseSections("## Aktywne\n### GP-001 — Błąd\n- **Status:** otwarty\n");
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Aktywne");
    expect(sections[0].body).toContain("### GP-001");
  });

  it("checkboxy", () => {
    expect(parseChecklist("- [ ] **A** — opis\n- [x] B\n- [X] C\n  - [ ] D")).toEqual([
      { text: "**A** — opis", done: false },
      { text: "B", done: true },
      { text: "C", done: true },
      { text: "D", done: false },
    ]);
  });

  it("linie bez checkboxa pominięte", () => {
    expect(parseChecklist("_Brak aktywnych blokerów_\n- zwykła")).toEqual([]);
  });

  it("Gdzie skończyłem do następnego ##", () => {
    const md = "## Gdzie skończyłem\nPracowałem nad X.\n\n## Historia sesji\n- 2026-05-19";
    const section = parseSections(md).find((s) => s.heading === "Gdzie skończyłem");
    expect(section?.body).toBe("Pracowałem nad X.");
  });

  it("bugi z dwóch sekcji", () => {
    const md =
      "## Aktywne\n### GP-001 — Zły eksport\n- **Priorytet:** medium\n- **Status:** otwarty\n\n## Zamknięte\n### EA-001 — Stary błąd\n- **Status:** naprawiony\n";
    expect(parseBugs(md)).toEqual([
      {
        id: "GP-001",
        title: "Zły eksport",
        section: "Aktywne",
        priority: "medium",
        status: "otwarty",
      },
      {
        id: "EA-001",
        title: "Stary błąd",
        section: "Zamknięte",
        status: "naprawiony",
      },
    ]);
  });

  it("bugi: samo zdanie", () => {
    expect(parseBugs("Brak znanych bugów.")).toEqual([]);
  });

  it("bugi: tylko ## Aktywne + ostrzeżenia", () => {
    const md = "## Aktywne\n### A-1 — x\n### A-2 — y\n## Ostrzeżenia z builda\n- warning 1\n";
    const bugs = parseBugs(md);
    expect(bugs).toHaveLength(2);
    expect(bugs.every((b) => b.section === "Aktywne")).toBe(true);
  });

  it("### przed jakimkolwiek ##", () => {
    expect(parseBugs("### X-1 — z\n")).toEqual([{ id: "X-1", title: "z", section: "" }]);
  });

  it("myślnik - zamiast —", () => {
    const bugs = parseBugs("## Aktywne\n### X-2 - tytuł\n");
    expect(bugs[0]?.id).toBe("X-2");
    expect(bugs[0]?.title).toBe("tytuł");
  });

  it("CRLF", () => {
    const md = "## Next\r\n- [ ] A\r\n- [x] B\r\n";
    const sections = parseSections(md);
    expect(sections).toEqual([expect.objectContaining({ heading: "Next" })]);
    expect(parseChecklist(sections[0].body)).toEqual([
      { text: "A", done: false },
      { text: "B", done: true },
    ]);
  });
});

describe("bc_projects markdown: state.md", () => {
  const FULL =
    "---\nbranch: main\nenv: local\nblocker: X\nnext_step: Y\nlinks:\n  - https://a\nmilestone: M\nmilestone_due: 2026-12-01\nupdated: 2026-11-13T09:15\n---\n\nnotatka\n";

  it("pełny frontmatter", () => {
    expect(parseState(FULL, "p/state.md")).toEqual({
      branch: "main",
      env: "local",
      blocker: "X",
      nextStep: "Y",
      links: ["https://a"],
      milestone: "M",
      milestoneDue: "2026-12-01",
      updated: "2026-11-13T09:15",
      notes: "notatka",
    });
  });

  it("links nie-tablica i brak pól", () => {
    expect(parseState("---\nlinks: foo\n---\n", "p/state.md")).toEqual({
      branch: "",
      env: "",
      blocker: "",
      nextStep: "",
      links: [],
      milestone: "",
      milestoneDue: undefined,
      updated: undefined,
      notes: "",
    });
  });

  it("elementy links niebędące tekstem są pomijane", () => {
    const state = parseState('---\nlinks: [1, "https://b", null]\n---\n', "p/state.md");
    expect(state.links).toEqual(["https://b"]);
  });

  it("zepsuty YAML rzuca błąd z nazwą pliku", () => {
    expect(() => parseState("---\nbranch: [\n---\n", "p/state.md")).toThrow(
      /p\/state\.md: zepsuty frontmatter/
    );
  });

  it("brak frontmattera: cały tekst jako notes", () => {
    const state = parseState("luźny tekst", "p/state.md");
    expect(state.notes).toBe("luźny tekst");
    expect(state.branch).toBe("");
    expect(state.links).toEqual([]);
  });

  it("pusty plik", () => {
    const state = parseState("", "p/state.md");
    expect(state.notes).toBe("");
    expect(state.links).toEqual([]);
  });

  it("round-trip serializeState → parseState", () => {
    const s: ProjectState = {
      branch: "feat/x",
      env: "Node 20",
      blocker: "czeka na review",
      nextStep: "napisać test",
      links: ["https://a.example", "https://b.example/x?y=1"],
      milestone: "Etap 1-2",
      milestoneDue: "2026-12-01",
      updated: "2026-11-13T09:15",
      notes: "n",
    };
    expect(parseState(serializeState(s), "x")).toEqual(s);
  });

  it("serializeState pomija puste milestone_due i updated", () => {
    const out = serializeState({
      branch: "b",
      env: "",
      blocker: "",
      nextStep: "",
      links: [],
      milestone: "",
      notes: "",
    });
    expect(out).not.toContain("milestone_due");
    expect(out).not.toContain("updated");
    expect(out).toContain("links: []");
  });
});

describe("bc_projects markdown: devlog.md", () => {
  const ENTRY = { date: "2026-11-13", title: "T", why: "W" };

  it("dwa wpisy w kolejności pliku, wstęp pominięty, separator — i -", () => {
    const md =
      "# Devlog\n\nwstęp\n\n## 2026-11-13 — Drugi\n\nPowód 2\n\n## 2026-11-12 - Pierwszy\n\nPowód 1\n";
    expect(parseDevlog(md)).toEqual([
      { date: "2026-11-13", title: "Drugi", why: "Powód 2" },
      { date: "2026-11-12", title: "Pierwszy", why: "Powód 1" },
    ]);
  });

  it("nagłówek bez daty", () => {
    expect(parseDevlog("## Notatka bez daty\n\ntekst")).toEqual([
      { date: null, title: "Notatka bez daty", why: "tekst" },
    ]);
  });

  it("en dash jako separator", () => {
    const [entry] = parseDevlog("## 2026-11-11 – T\n\nx");
    expect(entry.date).toBe("2026-11-11");
    expect(entry.title).toBe("T");
  });

  it("### nie jest granicą wpisu", () => {
    const entries = parseDevlog("## 2026-11-11 — T\n\n### pod\n\nb\n\nc");
    expect(entries).toHaveLength(1);
    expect(entries[0].why).toBe("### pod\n\nb\n\nc");
  });

  it("pusty tekst", () => {
    expect(parseDevlog("")).toEqual([]);
  });

  it("prepend: brak pliku", () => {
    expect(prependDevlogEntry(null, ENTRY)).toBe("# Devlog\n\n## 2026-11-13 — T\n\nW\n");
  });

  it("prepend: wpis przed starymi, reszta bez zmian", () => {
    expect(prependDevlogEntry("# Devlog\n\n## 2026-11-12 — Stary\n\nS\n", ENTRY)).toBe(
      "# Devlog\n\n## 2026-11-13 — T\n\nW\n\n## 2026-11-12 — Stary\n\nS\n"
    );
  });

  it("prepend: plik bez ## dostaje wpis na końcu", () => {
    expect(prependDevlogEntry("# Devlog\n\nwstęp\n", ENTRY)).toBe(
      "# Devlog\n\nwstęp\n\n## 2026-11-13 — T\n\nW\n"
    );
  });

  it("prepend: pusty plik jak brak pliku", () => {
    expect(prependDevlogEntry("", ENTRY)).toBe(prependDevlogEntry(null, ENTRY));
  });

  it("prepend: puste why", () => {
    expect(prependDevlogEntry(null, { date: "2026-11-13", title: "T", why: "" })).toBe(
      "# Devlog\n\n## 2026-11-13 — T\n"
    );
  });

  it("round-trip prepend → parse", () => {
    const base = "# Devlog\n\n## 2026-11-12 — Stary\n\nS\n";
    expect(parseDevlog(prependDevlogEntry(base, ENTRY))[0]).toEqual(ENTRY);
  });
});

describe("bc_projects markdown: setFrontmatterType", () => {
  it("zamienia istniejącą linię type", () => {
    expect(
      setFrontmatterType("---\nname: A\ntype: etat\nstatus: active\n---\n\nTreść\n", "wlasny")
    ).toBe("---\nname: A\ntype: wlasny\nstatus: active\n---\n\nTreść\n");
  });

  it("dopisuje type przed zamykającym ---, gdy klucza nie ma", () => {
    expect(setFrontmatterType("---\nname: A\nstatus: active\n---\n\nTreść\n", "biblioteka")).toBe(
      "---\nname: A\nstatus: active\ntype: biblioteka\n---\n\nTreść\n"
    );
  });

  it("komentarze, cudzysłowy i listy w innych liniach zostają", () => {
    expect(
      setFrontmatterType(
        '---\n# komentarz\nname: "A"\ntype: "etat"\ntags: [a, b]\n---\nx',
        "wlasny"
      )
    ).toBe('---\n# komentarz\nname: "A"\ntype: wlasny\ntags: [a, b]\n---\nx');
  });

  it("wcięty klucz type nie jest ruszany; type dopisane na końcu bloku", () => {
    expect(setFrontmatterType("---\nname: A\n  type: nested\n---\nx", "etat")).toBe(
      "---\nname: A\n  type: nested\ntype: etat\n---\nx"
    );
  });

  it("zamykający --- bez końcowego newline", () => {
    expect(setFrontmatterType("---\nname: A\n---", "etat")).toBe("---\nname: A\ntype: etat\n---");
  });

  it("brak frontmattera: DomainError 422", () => {
    let error: unknown;
    try {
      setFrontmatterType("Treść bez frontmattera", "etat");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(422);
  });

  it("pusty blok frontmattera: DomainError 422", () => {
    expect(() => setFrontmatterType("---\n---\ntekst", "etat")).toThrow(DomainError);
  });
});
