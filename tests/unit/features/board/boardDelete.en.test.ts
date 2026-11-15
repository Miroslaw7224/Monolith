import { describe, expect, it } from "vitest";
import type { BoardDto as Board } from "@/contexts/bc_board/schemas";
import { deleteCopy, deletePlan } from "@/src/features/board/boardDelete";

const twoTilesOneEdge: Board = {
  frames: [],
  tiles: [
    { id: "t1", title: "A", note: "", x: 0, y: 0, w: 40, h: 40, frame: null },
    { id: "t2", title: "B", note: "", x: 100, y: 0, w: 40, h: 40, frame: null },
  ],
  edges: [{ id: "e1", source: "t1", target: "t2" }],
};

describe("deleteCopy (PL/EN)", () => {
  it("describes a multi-tile delete in English and Polish", () => {
    const plan = deletePlan(["t1", "t2"], twoTilesOneEdge);
    const en = deleteCopy(plan, "en");
    expect(en.title).toBe("Delete the selection?");
    expect(en.lines).toContain("Tiles: 2, frames: 0.");
    expect(en.lines).toContain("Arrows removed with the tiles: 1.");

    const pl = deleteCopy(plan, "pl");
    expect(pl.title).toBe("Usunąć zaznaczone?");
    expect(pl.lines).toContain("Kafelki: 2, ramki: 0.");
    expect(pl.lines).toContain("Razem z kafelkami znikną strzałki: 1.");
  });
});
describe("deleteCopy: cudzysłowy i pojedynczy kafelek", () => {
  it("używa typograficznych cudzysłowów w obu językach", () => {
    const plan = deletePlan(["t1"], twoTilesOneEdge);
    const pl = deleteCopy(plan, "pl");
    expect(pl.title).toBe("Usunąć kafelek?");
    expect(pl.lines).toContain("„A” zniknie z tablicy.");
    expect(pl.lines).toContain("Razem z nim znikną strzałki: 1.");

    const en = deleteCopy(plan, "en");
    expect(en.title).toBe("Delete the tile?");
    expect(en.lines).toContain("“A” will leave the board.");
    expect(en.lines).toContain("Arrows removed with it: 1.");
  });
});
