// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyTaskOp,
  readBoardText,
  type TaskFileContext,
} from "@/contexts/bc_projects/repositories/tasks-file";
import { ConflictError } from "@/lib/errors";

const CTX: TaskFileContext = { projectName: "Demo", today: "2026-11-13" };
const PIERWSZE = "**Pierwsze** zadanie z `kodem`";

const SAMPLE = `# Tasks — Demo
> [[demo/demo|Demo]] | [[demo/index|Info]]

## Blokery

_Brak aktywnych blokerów_

## Next

- [ ] **Pierwsze** zadanie z \`kodem\`
  - [ ] podpunkt A
  - notatka B
- [ ] Drugie [now::]
- [ ] Trzecie

Ręczna notatka pod listą.

## Backlog

- [x] Zrobione — 2026-05-19
- [ ] Powtórka
- [ ] Powtórka
`;

describe("tasks-file: readBoardText", () => {
  it("dzieli SAMPLE na kolumny, pomijając podpunkty i prozę", () => {
    expect(readBoardText(SAMPLE)).toEqual({
      blockers: [],
      now: [{ text: "Drugie", done: false }],
      next: [
        { text: "**Pierwsze** zadanie z `kodem`", done: false },
        { text: "Trzecie", done: false },
      ],
      icebox: [
        { text: "Zrobione", done: true, doneDate: "2026-05-19" },
        { text: "Powtórka", done: false },
        { text: "Powtórka", done: false },
      ],
    });
  });

  it("brak pliku daje cztery puste kolumny", () => {
    expect(readBoardText(null)).toEqual({ blockers: [], now: [], next: [], icebox: [] });
  });

  it("znacznik przy ukończonym jest ignorowany (kolumna next, data zdjęta)", () => {
    const board = readBoardText("## Next\n\n- [x] Gotowe [now::] — 2026-11-01\n");
    expect(board.next).toEqual([{ text: "Gotowe", done: true, doneDate: "2026-11-01" }]);
    expect(board.now).toEqual([]);
  });

  it("data przy nieukończonym zostaje w tekście", () => {
    expect(readBoardText("## Backlog\n\n- [ ] Coś — 2026-05-19\n").icebox).toEqual([
      { text: "Coś — 2026-05-19", done: false },
    ]);
  });

  it("gwiazdka i wcięte checkboxy nie są zadaniami tablicy", () => {
    expect(readBoardText("## Next\n\n* [ ] gwiazdka\n  - [ ] wcięte\n").next).toEqual([]);
  });

  it("[x] i [X] to ukończone", () => {
    expect(readBoardText("## Blokery\n\n- [x] A\n- [X] B\n").blockers).toEqual([
      { text: "A", done: true },
      { text: "B", done: true },
    ]);
  });

  it("sekcje spoza trzech znanych są ignorowane", () => {
    expect(readBoardText("## Notatki\n\n- [ ] x\n")).toEqual({
      blockers: [],
      now: [],
      next: [],
      icebox: [],
    });
  });
});

describe("tasks-file: toggle, edit, remove", () => {
  it("toggle: nieukończone → ukończone z datą z kontekstu", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "toggle", column: "next", index: 1, text: "Trzecie" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [ ] Trzecie", "- [x] Trzecie — 2026-11-13"));
  });

  it("toggle: ukończone → nieukończone, data znika, linia wraca za ostatnie otwarte", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "toggle", column: "icebox", index: 0, text: "Zrobione" },
      CTX
    );
    expect(out).toBe(`${SAMPLE.replace("- [x] Zrobione — 2026-05-19\n", "")}- [ ] Zrobione\n`);
  });

  it("toggle zadania z Teraz zdejmuje znacznik i przenosi je za ostatnie otwarte Następne", () => {
    const out = applyTaskOp(SAMPLE, { op: "toggle", column: "now", index: 0, text: "Drugie" }, CTX);
    expect(out).toBe(
      SAMPLE.replace("- [ ] Drugie [now::]\n", "").replace(
        "- [ ] Trzecie\n",
        "- [ ] Trzecie\n- [x] Drugie — 2026-11-13\n"
      )
    );
    const board = readBoardText(out);
    expect(board.now).toEqual([]);
    expect(board.next[2]).toEqual({ text: "Drugie", done: true, doneDate: "2026-11-13" });
  });

  it("toggle: [X] wielką literą", () => {
    const out = applyTaskOp(
      "## Next\n\n- [X] Duże\n",
      { op: "toggle", column: "next", index: 0, text: "Duże" },
      CTX
    );
    expect(out).toBe("## Next\n\n- [ ] Duże\n");
  });

  it("edit zachowuje datę ukończenia", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "edit", column: "icebox", index: 0, text: "Zrobione", newText: "Zrobione ponownie" },
      CTX
    );
    expect(out).toBe(
      SAMPLE.replace("- [x] Zrobione — 2026-05-19", "- [x] Zrobione ponownie — 2026-05-19")
    );
  });

  it("edit zachowuje znacznik Teraz", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "edit", column: "now", index: 0, text: "Drugie", newText: "Drugie v2" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [ ] Drugie [now::]", "- [ ] Drugie v2 [now::]"));
  });

  it("edit: duplikaty tekstu rozróżnia indeks (zmienia tylko ostatnią)", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "edit", column: "icebox", index: 2, text: "Powtórka", newText: "Powtórka 2" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace(/- \[ \] Powtórka\n$/, "- [ ] Powtórka 2\n"));
    expect(readBoardText(out).icebox.map((t) => t.text)).toEqual([
      "Zrobione",
      "Powtórka",
      "Powtórka 2",
    ]);
  });

  it("remove usuwa cały blok z podpunktami, proza zostaje", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "remove", column: "next", index: 0, text: PIERWSZE },
      CTX
    );
    expect(out).toBe(SAMPLE.replace(`- [ ] ${PIERWSZE}\n  - [ ] podpunkt A\n  - notatka B\n`, ""));
    expect(out).toContain("Ręczna notatka pod listą.");
  });

  it("remove: duplikaty rozróżnia indeks (usuwa pierwszą z dwóch)", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "remove", column: "icebox", index: 1, text: "Powtórka" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [ ] Powtórka\n", ""));
    expect(readBoardText(out).icebox).toHaveLength(2);
  });

  it("niezgodny tekst, indeks poza zakresem i brak pliku dają ConflictError", () => {
    expect(() =>
      applyTaskOp(SAMPLE, { op: "toggle", column: "next", index: 1, text: "Nie to" }, CTX)
    ).toThrow(ConflictError);
    expect(() =>
      applyTaskOp(SAMPLE, { op: "toggle", column: "next", index: 9, text: "Trzecie" }, CTX)
    ).toThrow(ConflictError);
    expect(() =>
      applyTaskOp(null, { op: "remove", column: "next", index: 0, text: "x" }, CTX)
    ).toThrow(ConflictError);
  });
});

const PIERWSZE_BLOCK = `- [ ] ${PIERWSZE}\n  - [ ] podpunkt A\n  - notatka B\n`;

describe("tasks-file: add", () => {
  it("next: zaraz po ostatnim zadaniu sekcji, przed prozą", () => {
    const out = applyTaskOp(SAMPLE, { op: "add", column: "next", text: "Czwarte" }, CTX);
    expect(out).toBe(SAMPLE.replace("- [ ] Trzecie\n", "- [ ] Trzecie\n- [ ] Czwarte\n"));
  });

  it("now: do sekcji Next ze znacznikiem", () => {
    const out = applyTaskOp(SAMPLE, { op: "add", column: "now", text: "Piąte" }, CTX);
    expect(out).toBe(SAMPLE.replace("- [ ] Trzecie\n", "- [ ] Trzecie\n- [ ] Piąte [now::]\n"));
  });

  it("blockers: zastępuje placeholder", () => {
    const out = applyTaskOp(SAMPLE, { op: "add", column: "blockers", text: "X" }, CTX);
    expect(out).toBe(
      SAMPLE.replace(
        "## Blokery\n\n_Brak aktywnych blokerów_\n\n## Next",
        "## Blokery\n\n- [ ] X\n\n## Next"
      )
    );
  });

  it("icebox: po ostatniej linii Backlog", () => {
    const out = applyTaskOp(SAMPLE, { op: "add", column: "icebox", text: "Z" }, CTX);
    expect(out).toBe(`${SAMPLE}- [ ] Z\n`);
  });

  it("brakująca sekcja jest dopisywana na końcu pliku", () => {
    const out = applyTaskOp(
      "# Tasks — Demo\n\n## Next\n\n- [ ] a\n",
      { op: "add", column: "icebox", text: "b" },
      CTX
    );
    expect(out).toBe("# Tasks — Demo\n\n## Next\n\n- [ ] a\n\n## Backlog\n\n- [ ] b\n");
  });

  it("brak pliku tworzy nagłówek i trzy sekcje", () => {
    const out = applyTaskOp(null, { op: "add", column: "next", text: "x" }, CTX);
    expect(out).toBe("# Tasks — Demo\n\n## Blokery\n\n## Next\n\n- [ ] x\n\n## Backlog\n");
  });

  it("pusta sekcja (przed kolejnym nagłówkiem i na końcu pliku)", () => {
    expect(
      applyTaskOp("## Blokery\n\n## Next\n", { op: "add", column: "blockers", text: "x" }, CTX)
    ).toBe("## Blokery\n\n- [ ] x\n\n## Next\n");
    expect(applyTaskOp("## Backlog\n", { op: "add", column: "icebox", text: "x" }, CTX)).toBe(
      "## Backlog\n\n- [ ] x\n"
    );
  });

  it("proza zaczynająca się od „Brak” obok innej treści nie jest placeholderem i zostaje", () => {
    const out = applyTaskOp(
      "## Next\n\nNotatka:\nBrak odpowiedzi API.\n\n## Backlog\n",
      { op: "add", column: "next", text: "a" },
      CTX
    );
    expect(out).toBe("## Next\n\nNotatka:\nBrak odpowiedzi API.\n\n- [ ] a\n\n## Backlog\n");
  });

  it("placeholder obok prozy zostaje (nie jest jedyną treścią sekcji)", () => {
    const out = applyTaskOp(
      "## Next\n\n_Brak_\n\nNotatka.\n\n## Backlog\n",
      { op: "add", column: "next", text: "a" },
      CTX
    );
    expect(out).toBe("## Next\n\n_Brak_\n\nNotatka.\n\n- [ ] a\n\n## Backlog\n");
  });

  it("proza bez pustej linii przed następnym nagłówkiem: dodaje separator", () => {
    const out = applyTaskOp(
      "## Blokery\nNotatka.\n## Next\n",
      { op: "add", column: "blockers", text: "x" },
      CTX
    );
    expect(out).toBe("## Blokery\nNotatka.\n\n- [ ] x\n\n## Next\n");
  });

  it("proza na końcu pliku bez końcowego newline: wynik kończy się newline", () => {
    const out = applyTaskOp(
      "## Backlog\n\nNotatka.",
      { op: "add", column: "icebox", text: "x" },
      CTX
    );
    expect(out).toBe("## Backlog\n\nNotatka.\n\n- [ ] x\n");
  });

  it("sekcja z prozą bez zadań: po ostatniej niepustej linii", () => {
    const out = applyTaskOp(
      "## Next\n\nNotatka.\n\n## Backlog\n",
      { op: "add", column: "next", text: "a" },
      CTX
    );
    expect(out).toBe("## Next\n\nNotatka.\n\n- [ ] a\n\n## Backlog\n");
  });
});

describe("tasks-file: move", () => {
  it("next → now: znacznik w miejscu", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "next", index: 1, text: "Trzecie", to: "now" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [ ] Trzecie", "- [ ] Trzecie [now::]"));
  });

  it("now → next: zdjęcie znacznika w miejscu", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "now", index: 0, text: "Drugie", to: "next" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [ ] Drugie [now::]", "- [ ] Drugie"));
  });

  it("next → icebox: cały blok z podpunktami na koniec Backlog", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "next", index: 0, text: PIERWSZE, to: "icebox" },
      CTX
    );
    expect(out).toBe(`${SAMPLE.replace(PIERWSZE_BLOCK, "")}${PIERWSZE_BLOCK}`);
  });

  it("icebox → blockers: zastępuje placeholder, jedna Powtórka zostaje", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "icebox", index: 1, text: "Powtórka", to: "blockers" },
      CTX
    );
    expect(out).toBe(
      SAMPLE.replace("- [ ] Powtórka\n", "").replace("_Brak aktywnych blokerów_", "- [ ] Powtórka")
    );
    expect(readBoardText(out).icebox).toHaveLength(2);
  });

  it("now → icebox: znacznik zdjęty", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "now", index: 0, text: "Drugie", to: "icebox" },
      CTX
    );
    expect(out).toBe(`${SAMPLE.replace("- [ ] Drugie [now::]\n", "")}- [ ] Drugie\n`);
  });

  it("icebox → now: na koniec Next ze znacznikiem", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "move", column: "icebox", index: 1, text: "Powtórka", to: "now" },
      CTX
    );
    expect(out).toBe(
      SAMPLE.replace("- [ ] Powtórka\n", "").replace(
        "- [ ] Trzecie\n",
        "- [ ] Trzecie\n- [ ] Powtórka [now::]\n"
      )
    );
  });

  it("ruch do tej samej kolumny jest błędem", () => {
    expect(() =>
      applyTaskOp(
        SAMPLE,
        { op: "move", column: "next", index: 1, text: "Trzecie", to: "next" },
        CTX
      )
    ).toThrow(/już w tej kolumnie/);
  });
});

const orderFile = (next: string[], backlog: string[]) =>
  `# Tasks — Demo\n\n## Next\n\n${next.join("\n")}\n\n## Backlog\n\n${backlog.join("\n")}\n`;

const ORDER = orderFile(
  ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C", "- [x] D — 2026-11-02"],
  ["- [ ] F", "- [x] E — 2026-10-01"]
);
// Kolumna next: A(0) B(1) C(2) D(3); icebox: F(0) E(1).

describe("tasks-file: otwarte przed ukończonymi", () => {
  it("toggle otwartego: za ostatnim otwartym, na górze ogona ukończonych", () => {
    const out = applyTaskOp(ORDER, { op: "toggle", column: "next", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [x] B — 2026-11-01", "- [ ] C", "- [x] A — 2026-11-13", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("toggle ukończonego (odznaczenie): wraca za ostatnie otwarte", () => {
    const out = applyTaskOp(ORDER, { op: "toggle", column: "next", index: 1, text: "B" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [ ] C", "- [ ] B", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("toggle: cały blok z wciętymi liniami przenosi się razem", () => {
    const text = orderFile(["- [ ] A", "  - sub", "- [ ] C", "- [x] B — 2026-11-01"], ["- [ ] F"]);
    const out = applyTaskOp(text, { op: "toggle", column: "next", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(["- [ ] C", "- [x] A — 2026-11-13", "  - sub", "- [x] B — 2026-11-01"], ["- [ ] F"])
    );
  });

  it("toggle zadania [now::] w Next: znika z now, ląduje za ostatnim otwartym", () => {
    const text = orderFile(["- [ ] A [now::]", "- [ ] C", "- [x] B — 2026-11-01"], ["- [ ] F"]);
    const out = applyTaskOp(text, { op: "toggle", column: "now", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(["- [ ] C", "- [x] A — 2026-11-13", "- [x] B — 2026-11-01"], ["- [ ] F"])
    );
    expect(readBoardText(out).now).toEqual([]);
  });

  it("sekcja z samymi ukończonymi: odznaczone zadanie ląduje przed pierwszym z nich", () => {
    const text = "## Next\n\n- [x] A — 2026-11-01\n- [x] B — 2026-11-02\n";
    const out = applyTaskOp(text, { op: "toggle", column: "next", index: 1, text: "B" }, CTX);
    expect(out).toBe("## Next\n\n- [ ] B\n- [x] A — 2026-11-01\n");
  });

  it("jedyne zadanie sekcji: edycja w miejscu, proza i układ bajt w bajt", () => {
    const out = applyTaskOp(
      "## Next\n\n- [ ] A\n\nProza.\n\n## Backlog\n",
      { op: "toggle", column: "next", index: 0, text: "A" },
      CTX
    );
    expect(out).toBe("## Next\n\n- [x] A — 2026-11-13\n\nProza.\n\n## Backlog\n");
  });

  it("add: za ostatnim otwartym, przed ukończonymi", () => {
    const out = applyTaskOp(ORDER, { op: "add", column: "next", text: "N" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C", "- [ ] N", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("add do sekcji z samymi ukończonymi: przed pierwszym z nich", () => {
    const out = applyTaskOp(
      "## Backlog\n\n- [x] E — 2026-10-01\n",
      { op: "add", column: "icebox", text: "N" },
      CTX
    );
    expect(out).toBe("## Backlog\n\n- [ ] N\n- [x] E — 2026-10-01\n");
  });

  it("add do sekcji bez zadań: pod nagłówkiem, placeholder znika", () => {
    const out = applyTaskOp(
      "## Blokery\n\n_Brak aktywnych blokerów_\n\n## Next\n",
      { op: "add", column: "blockers", text: "X" },
      CTX
    );
    expect(out).toBe("## Blokery\n\n- [ ] X\n\n## Next\n");
  });

  it("move otwartego do sekcji z ogonem ukończonych: za ostatnim otwartym celu", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 0, text: "A", to: "icebox" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [x] B — 2026-11-01", "- [ ] C", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [ ] A", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("move ukończonego: na górę ogona ukończonych celu (data zostaje)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 1, text: "B", to: "icebox" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [ ] C", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] B — 2026-11-01", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("move ukończonego do sekcji wymieszanej: za ostatnim otwartym (punkt po wycięciu bloku)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "icebox", index: 1, text: "E", to: "next" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        [
          "- [ ] A",
          "- [x] B — 2026-11-01",
          "- [ ] C",
          "- [x] E — 2026-10-01",
          "- [x] D — 2026-11-02",
        ],
        ["- [ ] F"]
      )
    );
  });

  it("move next → now: bez zmiany pozycji (regresja)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 2, text: "C", to: "now" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C [now::]", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });
});
