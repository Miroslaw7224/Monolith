import { describe, expect, it } from "vitest";
import type {
  BoardFrameDto as BoardFrame,
  BoardTileDto as BoardTile,
} from "@/contexts/bc_board/schemas";
import {
  boxChanged,
  frameAt,
  movedChildren,
  withMembership,
} from "@/src/features/board/boardLayout";

const frameA: BoardFrame = { id: "a", title: "A", x: 0, y: 0, w: 100, h: 100 };
const frameB: BoardFrame = { id: "b", title: "B", x: 50, y: 50, w: 100, h: 100 };

describe("frameAt", () => {
  it("returns the later frame when centers hit both", () => {
    expect(frameAt({ x: 60, y: 60, w: 20, h: 20 }, [frameA, frameB])).toBe("b");
  });

  it("includes the frame edge", () => {
    expect(frameAt({ x: 90, y: 0, w: 20, h: 40 }, [frameA, frameB])).toBe("a");
  });

  it("returns null outside every frame", () => {
    expect(frameAt({ x: 200, y: 200, w: 10, h: 10 }, [frameA])).toBeNull();
  });
});

describe("boxChanged", () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };

  it("ignores a move under half a pixel", () => {
    expect(boxChanged(box, { ...box, x: 0.4 })).toBe(false);
  });

  it("accepts a move of half a pixel", () => {
    expect(boxChanged(box, { ...box, x: 0.5 })).toBe(true);
  });
});

describe("movedChildren and withMembership", () => {
  const tile: BoardTile = {
    id: "t",
    title: "T",
    note: "",
    x: 10,
    y: 10,
    w: 20,
    h: 20,
    frame: "a",
  };

  it("shifts only tiles of the frame", () => {
    const other = { ...tile, id: "o", frame: null };
    expect(movedChildren([tile, other], "a", 5, 7)).toEqual([{ ...tile, x: 15, y: 17 }]);
  });

  it("assigns the frame that contains the center", () => {
    const loose = { ...tile, frame: null, x: 70, y: 70 };
    expect(withMembership([loose], [frameA, frameB])[0].frame).toBe("b");
  });
});
