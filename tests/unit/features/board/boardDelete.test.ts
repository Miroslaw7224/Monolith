import { describe, expect, it } from "vitest";
import type { BoardDto as Board } from "@/contexts/bc_board/schemas";
import { applyDelete, deleteCopy, deletePlan } from "@/src/features/board/boardDelete";

const board: Board = {
  frames: [
    { id: "f1", title: "Rdzeń", x: 0, y: 0, w: 400, h: 300 },
    { id: "f2", title: "Bok", x: 300, y: 0, w: 200, h: 200 },
  ],
  tiles: [
    { id: "t1", title: "Płatności", note: "", x: 320, y: 20, w: 20, h: 20, frame: "f1" },
    { id: "t2", title: "Luz", note: "", x: 500, y: 500, w: 40, h: 40, frame: "f1" },
  ],
  edges: [
    { id: "e1", source: "t1", target: "t2" },
    { id: "e2", source: "t2", target: "t1" },
  ],
};

describe("deletePlan", () => {
  it("drops arrows that touch a deleted tile and keeps the other tile", () => {
    const plan = deletePlan(["t1"], board);
    expect(plan.edgeIds).toEqual(["e1", "e2"]);
    expect(plan.tiles.map((tile) => tile.id)).toEqual(["t1"]);
    expect(applyDelete(board, ["t1"]).tiles.map((tile) => tile.id)).toEqual(["t2"]);
    expect(applyDelete(board, ["t1"]).edges).toEqual([]);
  });

  it("keeps tiles when a frame is deleted and lands them by center", () => {
    const plan = deletePlan(["f1"], board);
    expect(plan.frames.map((frame) => frame.id)).toEqual(["f1"]);
    expect(plan.landing).toEqual([
      { tileId: "t1", frame: "f2", frameTitle: "Bok" },
      { tileId: "t2", frame: null, frameTitle: null },
    ]);
    const next = applyDelete(board, ["f1"]);
    expect(next.frames.map((frame) => frame.id)).toEqual(["f2"]);
    expect(next.tiles.find((tile) => tile.id === "t1")?.frame).toBe("f2");
    expect(next.tiles.find((tile) => tile.id === "t2")?.frame).toBeNull();
  });
});

describe("deleteCopy", () => {
  it("names the tile and the arrows that go with it", () => {
    const copy = deleteCopy(deletePlan(["t1"], board), "pl");
    expect(copy.title).toBe("Usunąć kafelek?");
    expect(copy.lines.join(" ")).toContain("Płatności");
    expect(copy.lines.join(" ")).toContain("strzałki: 2");
  });

  it("names the frame a tile lands in", () => {
    const copy = deleteCopy(deletePlan(["f1"], board), "pl");
    expect(copy.lines.join(" ")).toContain("Bok");
    expect(copy.lines.join(" ")).not.toContain("f2");
  });
});
