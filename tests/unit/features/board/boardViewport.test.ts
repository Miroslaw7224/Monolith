import { afterEach, describe, expect, it } from "vitest";
import { readViewport, storeViewport } from "@/src/features/board/boardViewport";

afterEach(() => localStorage.clear());

describe("boardViewport", () => {
  it("returns null when nothing is stored", () => {
    expect(readViewport()).toBeNull();
  });

  it("round-trips the viewport under a single key", () => {
    storeViewport({ x: 10, y: 20, zoom: 0.8 });
    expect(readViewport()).toEqual({ x: 10, y: 20, zoom: 0.8 });
    expect(localStorage.getItem("board-viewport")).not.toBeNull();
  });
});
