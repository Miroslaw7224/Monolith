import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseBoard } from "@/src/features/board/boardSchema";

const tile = {
  id: "t1",
  title: "  Kafelek  ",
  note: "",
  x: 0,
  y: 0,
  w: 160,
  h: 72,
  frame: null,
};

describe("parseBoard", () => {
  it("trims a tile title and accepts an empty note", () => {
    const board = parseBoard({ tiles: [tile], frames: [], edges: [] });
    expect(board.tiles[0].title).toBe("Kafelek");
  });

  it("rejects an unknown frame, a small tile, and a bad arrow", () => {
    expect(() =>
      parseBoard({ tiles: [{ ...tile, frame: "missing" }], frames: [], edges: [] })
    ).toThrow(DomainError);
    expect(() => parseBoard({ tiles: [{ ...tile, w: 159 }], frames: [], edges: [] })).toThrow(
      /too small|160/
    );
    const emptyIdBoard = () => parseBoard({ tiles: [{ ...tile, id: "" }], frames: [], edges: [] });
    expect(emptyIdBoard).toThrow(DomainError);
    try {
      emptyIdBoard();
    } catch (e) {
      expect((e as DomainError).message).not.toMatch(/too small/);
    }
    expect(() =>
      parseBoard({
        tiles: [tile],
        frames: [],
        edges: [{ id: "e", source: "t1", target: "t1" }],
      })
    ).toThrow(/two different tiles/);
  });

  it("rejects a duplicate id", () => {
    expect(() =>
      parseBoard({
        tiles: [tile],
        frames: [],
        edges: [{ id: "t1", source: "t1", target: "t1" }],
      })
    ).toThrow(/Duplicate id/);
  });

  it("rejects a blank frame title", () => {
    const blankFrameTitle = () =>
      parseBoard({
        tiles: [],
        frames: [{ id: "f", title: "   ", x: 0, y: 0, w: 200, h: 120 }],
        edges: [],
      });
    expect(blankFrameTitle).toThrow(DomainError);
    try {
      blankFrameTitle();
    } catch (e) {
      expect((e as DomainError).message).not.toMatch(/too small/);
    }
  });
});
