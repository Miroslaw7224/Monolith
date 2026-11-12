// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseBugs,
  parseChecklist,
  parseSections,
} from "@/contexts/bc_projects/repositories/markdown";

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
