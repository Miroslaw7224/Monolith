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

  it("toggle: ukończone → nieukończone, data znika", () => {
    const out = applyTaskOp(
      SAMPLE,
      { op: "toggle", column: "icebox", index: 0, text: "Zrobione" },
      CTX
    );
    expect(out).toBe(SAMPLE.replace("- [x] Zrobione — 2026-05-19", "- [ ] Zrobione"));
  });

  it("toggle zadania z Teraz zdejmuje znacznik i przenosi je do Następne", () => {
    const out = applyTaskOp(SAMPLE, { op: "toggle", column: "now", index: 0, text: "Drugie" }, CTX);
    expect(out).toBe(SAMPLE.replace("- [ ] Drugie [now::]", "- [x] Drugie — 2026-11-13"));
    const board = readBoardText(out);
    expect(board.now).toEqual([]);
    expect(board.next[1]).toEqual({ text: "Drugie", done: true, doneDate: "2026-11-13" });
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
