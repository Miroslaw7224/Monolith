import { describe, it, expect } from "vitest";
import {
  parseChecklist,
  serializeChecklist,
  cycleStatus,
  setItemStatus,
  setItemComment,
  countItems,
  summarize,
  exportMarkdown,
  itemLevel,
  itemComment,
  resetChecklist,
  type ItemLine,
} from "@/src/features/tasks/taskChecklist";

const CG_DESC = [
  "MB — plan testu stagingu na 17.11 jest na main. Testy 8:30–11:30, werdykt GO/NO-GO o 12:00.",
  "- [ ] T-01: pobieranie PDF z generatora CV (iPhone i iPad)",
  "- [ ] T-02: CV między kontami w tej samej karcie",
  "- [!] T-04d: nazwa firmy w „Język CV” po angielsku",
  "  > Kroki: otwórz CV. Oczekiwany: EN. Rzeczywisty: PL.",
  "- [ ] T-06 C i E (zapis profilu, #1468)",
  "  - [ ] import CV 1 i „Zastosuj do formularza”",
  "  - [x] okno o niezapisanych zmianach",
  "    > Safari pokazuje okno tylko przy zamknięciu karty",
  "- [ ] R-01 (regresja)",
].join("\n");

const item = (desc: string, i = 0): ItemLine => {
  const line = parseChecklist(desc).lines[i];
  if (line.type !== "item") throw new Error("to nie punkt");
  return line;
};

describe("parseChecklist", () => {
  it("rozpoznaje trzy statusy", () => {
    expect(item("- [ ] A").status).toBe("todo");
    expect(item("- [x] A").status).toBe("pass");
    expect(item("- [!] A").status).toBe("fail");
    expect(item("- [ ] A").text).toBe("A");
    expect(itemLevel(item("- [ ] A"))).toBe(0);
  });

  it("poziom = wcięcie / 2 w dół", () => {
    expect(itemLevel(item("  - [ ] A"))).toBe(1);
    expect(itemLevel(item("   - [ ] A"))).toBe(1);
    expect(itemLevel(item("    - [ ] A"))).toBe(2);
  });

  it("komentarz pod punktem; kilka linii > to jeden komentarz", () => {
    expect(itemComment(item("- [ ] A\n  > uwaga"))).toBe("uwaga");
    expect(itemComment(item("- [ ] A\n  > uwaga1\n  > uwaga2"))).toBe("uwaga1\nuwaga2");
  });

  it("> bez punktu powyżej to zwykły tekst", () => {
    const model = parseChecklist("> cytat\n- [ ] A");
    expect(model.lines[0]).toEqual({ type: "text", raw: "> cytat" });
    expect(model.lines[1].type).toBe("item");
  });

  it("tekst między punktem a komentarzem przerywa komentarz", () => {
    const model = parseChecklist("- [ ] A\nzwykły tekst\n> to już nie komentarz");
    expect((model.lines[0] as ItemLine).commentRaw).toEqual([]);
    expect(model.lines[2]).toEqual({ type: "text", raw: "> to już nie komentarz" });
  });

  it("opis bez punktów to same linie tekstu", () => {
    const model = parseChecklist("Zwykła notatka\ndruga linia");
    expect(model.lines.every((l) => l.type === "text")).toBe(true);
    expect(countItems(model)).toEqual({ pass: 0, fail: 0, todo: 0 });
  });
});

describe("serializeChecklist (round-trip)", () => {
  it("opis „Testy Manualne CG” wraca bajt w bajt", () => {
    expect(serializeChecklist(parseChecklist(CG_DESC))).toBe(CG_DESC);
  });
  it("opis bez punktów i pusty wracają bez zmian", () => {
    expect(serializeChecklist(parseChecklist("Zwykła notatka\n\n> a"))).toBe(
      "Zwykła notatka\n\n> a"
    );
    expect(serializeChecklist(parseChecklist(""))).toBe("");
  });
});

describe("zmiany", () => {
  it("cycleStatus: todo → pass → fail → todo", () => {
    expect(cycleStatus("todo")).toBe("pass");
    expect(cycleStatus("pass")).toBe("fail");
    expect(cycleStatus("fail")).toBe("todo");
  });

  it("setItemStatus zmienia tylko znak w nawiasie", () => {
    const next = serializeChecklist(setItemStatus(parseChecklist(CG_DESC), 1, "pass"));
    expect(next).toBe(CG_DESC.replace("- [ ] T-01", "- [x] T-01"));
  });

  it("setItemStatus na linii tekstu nic nie robi", () => {
    const model = parseChecklist(CG_DESC);
    expect(setItemStatus(model, 0, "pass")).toBe(model);
  });

  it("setItemComment dodaje komentarz pod właściwym punktem z wcięciem punktu + 2", () => {
    const next = serializeChecklist(
      setItemComment(parseChecklist("- [ ] A\n- [ ] B"), 1, "uwaga\ndruga")
    );
    expect(next).toBe("- [ ] A\n- [ ] B\n  > uwaga\n  > druga");
  });

  it("setItemComment: puste usuwa komentarz, ten sam tekst zwraca ten sam model", () => {
    const model = parseChecklist("- [ ] A\n  > x");
    expect(serializeChecklist(setItemComment(model, 0, ""))).toBe("- [ ] A");
    expect(setItemComment(model, 0, "x")).toBe(model);
  });
});

describe("summarize", () => {
  it("5 PASS, 1 FAIL, 9 todo", () => {
    const desc = [...Array(5).fill("- [x] p"), "- [!] f", ...Array(9).fill("- [ ] t")].join("\n");
    expect(summarize(parseChecklist(desc))).toBe("PASS 5 · FAIL 1 · pozostało 9");
  });
});

describe("exportMarkdown", () => {
  it("nagłówek, wstęp, podsumowanie, punkty z komentarzami i wcięciami", () => {
    const desc = "Wstęp\n- [x] A\n  > ok\n- [!] B\n  - [ ] C";
    expect(exportMarkdown("Testy", desc)).toBe(
      [
        "# Testy",
        "",
        "Wstęp",
        "",
        "PASS 1 · FAIL 1 · pozostało 1",
        "",
        "- ✅ PASS A",
        "  > ok",
        "- ❌ FAIL B",
        "  - ⬜ nie sprawdzono C",
      ].join("\n")
    );
  });
  it("pusty desc daje sam tytuł", () => {
    expect(exportMarkdown("Testy", "")).toBe("# Testy");
  });
  it("opis bez punktów: tytuł i akapit, bez podsumowania", () => {
    expect(exportMarkdown("T", "Zwykła notatka")).toBe("# T\n\nZwykła notatka");
  });
});

describe("resetChecklist", () => {
  it("zeruje statusy i usuwa komentarze, reszta bajt w bajt", () => {
    expect(resetChecklist("W\n- [x] A\n  > ok\n- [!] B")).toBe("W\n- [ ] A\n- [ ] B");
  });
  it("zachowuje wcięcia podpunktów", () => {
    expect(resetChecklist("- [x] A\n  - [!] B\n    > uwaga")).toBe("- [ ] A\n  - [ ] B");
  });
  it("opis bez punktów i pusty bez zmian", () => {
    expect(resetChecklist("Zwykła notatka\n> cytat")).toBe("Zwykła notatka\n> cytat");
    expect(resetChecklist("")).toBe("");
  });
});
