// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ArchivedBlock, ProjectState } from "@/contexts/bc_projects/models";
import {
  mergeChangelog,
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

  it("zagnieżdżony klucz type nie jest ruszany; type dopisane na końcu bloku", () => {
    expect(setFrontmatterType("---\nname: A\nmeta:\n  type: nested\n---\nx", "etat")).toBe(
      "---\nname: A\nmeta:\n  type: nested\ntype: etat\n---\nx"
    );
  });

  it("nietypowy frontmatter (type: z wartością w następnej linii): 422 zamiast niepoprawnego YAML", () => {
    let error: unknown;
    try {
      setFrontmatterType("---\nname: A\ntype:\n  etat\n---\nx", "wlasny");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(422);
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

describe("bc_projects markdown: odporność state.md i devlog.md (review agy)", () => {
  it("parseState zachowuje wcięcie pierwszej linii notes", () => {
    const state = parseState("---\nbranch: a\n---\n\n    kod\n    dalej\n", "p/state.md");
    expect(state.notes).toBe("    kod\n    dalej");
  });

  it("notes z wcięciem przechodzi round-trip", () => {
    const s: ProjectState = {
      branch: "a",
      env: "",
      blocker: "",
      nextStep: "",
      links: [],
      milestone: "",
      notes: "    kod",
    };
    expect(parseState(serializeState(s), "x").notes).toBe("    kod");
  });

  it("wartości, które YAML 1.1 i 1.2 czytają inaczej, przechodzą round-trip", () => {
    const s: ProjectState = {
      branch: "0o10",
      env: "1e3",
      blocker: "true",
      nextStep: "null",
      links: ["https://a.example/#frag"],
      milestone: ": x # y",
      milestoneDue: "2026-12-01",
      updated: "2026-11-13T09:15",
      notes: "",
    };
    expect(parseState(serializeState(s), "x")).toEqual(s);
  });

  it.each([["- x"], ["#"], ["a: b"], ['"cytat"'], ["yes"], ["~"], ["12"], ["2026-12-01"]])(
    "wartość %j w polu tekstowym przechodzi round-trip",
    (value) => {
      const s: ProjectState = {
        branch: value,
        env: value,
        blocker: value,
        nextStep: value,
        links: [],
        milestone: value,
        notes: "",
      };
      expect(parseState(serializeState(s), "x")).toEqual(s);
    }
  );

  it("ręcznie wpisana lista/mapa w polu tekstowym nie daje „[object Object]”", () => {
    const state = parseState("---\nblocker: [a, b]\nenv: {a: 1}\n---\n", "p/state.md");
    expect(state.blocker).toBe('["a","b"]');
    expect(state.env).toBe('{"a":1}');
  });

  it("prependDevlogEntry: pusty nagłówek „## ” nie jest granicą wpisu (spójnie z parseDevlog)", () => {
    const base = "# Devlog\n\n## \n\nśmieć\n\n## 2026-11-12 — Stary\n\nS\n";
    const entry = { date: "2026-11-13", title: "T", why: "W" };
    const out = prependDevlogEntry(base, entry);
    expect(out).toBe(
      "# Devlog\n\n## \n\nśmieć\n\n## 2026-11-13 — T\n\nW\n\n## 2026-11-12 — Stary\n\nS\n"
    );
    expect(parseDevlog(out)[0]).toEqual(entry);
  });
});

describe("mergeChangelog", () => {
  const block = (date: string | null, text: string, ...extra: string[]): ArchivedBlock => ({
    date,
    lines: [`- [x] ${text}${date === null ? "" : ` — ${date}`}`, ...extra],
  });
  const HEAD = "# Changelog — Demo\n\n";

  it("nowy plik: nagłówek z nazwą projektu i miesiąc", () => {
    expect(mergeChangelog(null, [block("2026-11-13", "A")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`
    );
  });

  it("istniejący miesiąc: malejąco po dacie, przy równej dacie nowe za istniejącymi", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`;
    expect(mergeChangelog(existing, [block("2026-11-12", "C")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] C — 2026-11-12\n- [x] D — 2026-11-10\n`
    );
    expect(mergeChangelog(existing, [block("2026-11-14", "E")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] E — 2026-11-14\n- [x] D — 2026-11-10\n`
    );
    expect(mergeChangelog(existing, [block("2026-11-20", "F")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] F — 2026-11-20\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`
    );
  });

  it("kilka bloków naraz trafia na właściwe miejsca", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`;
    expect(
      mergeChangelog(existing, [block("2026-11-12", "C"), block("2026-11-13", "G")], "Demo")
    ).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] G — 2026-11-13\n- [x] C — 2026-11-12\n- [x] D — 2026-11-10\n`
    );
  });

  it("nowy, nowszy miesiąc ląduje na górze", () => {
    const existing = `${HEAD}## 2026-10\n\n- [x] X — 2026-10-29\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "N")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] N — 2026-11-14\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("nowy, starszy miesiąc ląduje pod istniejącymi", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`;
    expect(mergeChangelog(existing, [block("2026-10-29", "X")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("## Bez daty zawsze na dole: nowy miesiąc idzie nad nią, bez daty dopisuje na końcu", () => {
    const existing = `${HEAD}## Bez daty\n\n- [x] Old\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "N")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] N — 2026-11-14\n\n## Bez daty\n\n- [x] Old\n`
    );
    expect(mergeChangelog(existing, [block(null, "New")], "Demo")).toBe(
      `${HEAD}## Bez daty\n\n- [x] Old\n- [x] New\n`
    );
    expect(
      mergeChangelog(`${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`, [block(null, "Z")], "Demo")
    ).toBe(`${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n\n## Bez daty\n\n- [x] Z\n`);
  });

  it("bez deduplikacji: identyczne linie w jednej archiwizacji i już obecne trafiają wszystkie", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`;
    expect(
      mergeChangelog(existing, [block("2026-11-13", "A"), block("2026-11-13", "A")], "Demo")
    ).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n- [x] A — 2026-11-13\n- [x] A — 2026-11-13\n`
    );
  });

  it("blok z wciętymi liniami dopisuje się w całości, istniejący blok nie jest rozcinany", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n  - sub B\n- [x] D — 2026-11-10\n`;
    expect(mergeChangelog(existing, [block("2026-11-12", "C", "  - sub C")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n  - sub B\n- [x] C — 2026-11-12\n  - sub C\n- [x] D — 2026-11-10\n`
    );
  });

  it("data istniejącego bloku: końcowa data ukończenia ma pierwszeństwo przed wcześniejszą w treści", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] A wspomina — 2026-01-05 coś — 2026-11-14\n- [x] D — 2026-11-10\n`;
    expect(mergeChangelog(existing, [block("2026-11-12", "C")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] A wspomina — 2026-01-05 coś — 2026-11-14\n- [x] C — 2026-11-12\n- [x] D — 2026-11-10\n`
    );
  });

  it("proza poza nagłówkami i w sekcjach zostaje bajt w bajt", () => {
    const existing = `${HEAD}Notatka ręczna.\n\n## 2026-11\n\n- [x] A — 2026-11-13\n\nProza w sekcji.\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "B")], "Demo")).toBe(
      `${HEAD}Notatka ręczna.\n\n## 2026-11\n\n- [x] B — 2026-11-14\n- [x] A — 2026-11-13\n\nProza w sekcji.\n`
    );
  });

  it("pusta sekcja z prozą (bez zadań): blok po ostatniej niepustej linii", () => {
    const existing = `${HEAD}## 2026-11\n\nProza.\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "B")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\nProza.\n\n- [x] B — 2026-11-14\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("nieznany nagłówek ##: DomainError 422 z nazwą pliku", () => {
    const run = () =>
      mergeChangelog(`${HEAD}## Foo\n\n- [x] a\n`, [block("2026-11-14", "B")], "Demo");
    expect(run).toThrow(DomainError);
    expect(run).toThrow(/changelog\.md ma nieznany nagłówek „Foo”/);
    try {
      run();
    } catch (err) {
      expect((err as DomainError).statusCode).toBe(422);
    }
  });

  it("powtórzony nagłówek: DomainError 422", () => {
    const dup = `${HEAD}## 2026-11\n\n- [x] a — 2026-11-01\n\n## 2026-11\n\n- [x] b — 2026-11-02\n`;
    expect(() => mergeChangelog(dup, [block("2026-11-14", "B")], "Demo")).toThrow(
      /changelog\.md ma powtórzony nagłówek „2026-11”/
    );
  });
});

describe("parseBugs: pola wpisu", () => {
  const FULL = [
    "# Bugs — X",
    "",
    "## Aktywne",
    "",
    "### GP-001 — Porty",
    "- **Priorytet:** medium",
    "- **Plik:** `start_v2.bat`",
    "- **Otwarto:** 2026-11-10",
    "- **Opis:** Launchery wypisują 5000,",
    "  a backend działa na 5001.",
    "- **Naprawa:** Poprawić echo.",
    "- **Status:** otwarty",
    "",
    "## Zamknięte",
    "",
    "### EA-001 — Supabase usypia",
    "- **Priorytet:** high",
    "- **Rozwiązanie (2026-05-19):** Vercel Cron.",
    "- **Status:** zamknięty",
    "",
  ].join("\n");

  it("czyta wszystkie pola, ciąg dalszy dokleja spacją", () => {
    expect(parseBugs(FULL)).toEqual([
      {
        id: "GP-001",
        title: "Porty",
        section: "Aktywne",
        priority: "medium",
        file: "`start_v2.bat`",
        opened: "2026-11-10",
        description: "Launchery wypisują 5000, a backend działa na 5001.",
        fix: "Poprawić echo.",
        status: "otwarty",
      },
      {
        id: "EA-001",
        title: "Supabase usypia",
        section: "Zamknięte",
        priority: "high",
        resolution: "Vercel Cron.",
        closedOn: "2026-05-19",
        status: "zamknięty",
      },
    ]);
  });

  it("sam nagłówek: bez żadnych pól opcjonalnych", () => {
    expect(parseBugs("## Aktywne\n### A-1 — x\n")).toEqual([
      { id: "A-1", title: "x", section: "Aktywne" },
    ]);
  });

  it("zła data Otwarto jest ignorowana (format i nieistniejący dzień)", () => {
    const md = [
      "## Aktywne",
      "### A-1 — x",
      "- **Otwarto:** wczoraj",
      "### A-2 — y",
      "- **Otwarto:** 2026-02-30",
      "",
    ].join("\n");
    const bugs = parseBugs(md);
    expect(bugs).toHaveLength(2);
    expect(bugs.every((b) => b.opened === undefined)).toBe(true);
  });

  it("Rozwiązanie z nieprawidłową datą w nawiasie: tekst jest, closedOn nie", () => {
    const md = "## Zamknięte\n### A-1 — x\n- **Rozwiązanie (kiedyś):** zrobione\n";
    expect(parseBugs(md)).toEqual([
      { id: "A-1", title: "x", section: "Zamknięte", resolution: "zrobione" },
    ]);
  });

  it("puste pole nie ustawia wartości", () => {
    expect(parseBugs("## Aktywne\n### A-1 — x\n- **Plik:**\n")).toEqual([
      { id: "A-1", title: "x", section: "Aktywne" },
    ]);
  });

  it("pusta linia kończy ciąg dalszy pola", () => {
    const md = "## Aktywne\n### A-1 — x\n- **Opis:** a\n\n  b\n";
    expect(parseBugs(md)[0].description).toBe("a");
  });

  it("### pod obcą sekcją nie jest bugiem i nie oddaje pól poprzedniemu bugowi", () => {
    const md = [
      "## Aktywne",
      "### A-1 — x",
      "## Ostrzeżenia z builda",
      "### W-1 — to nie bug",
      "- **Status:** otwarty",
      "",
    ].join("\n");
    expect(parseBugs(md)).toEqual([{ id: "A-1", title: "x", section: "Aktywne" }]);
  });

  it("pierwsza wartość pola wygrywa", () => {
    const md = "## Aktywne\n### A-1 — x\n- **Priorytet:** high\n- **Priorytet:** low\n";
    expect(parseBugs(md)[0].priority).toBe("high");
  });
});
