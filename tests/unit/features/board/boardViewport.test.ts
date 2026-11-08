import { afterEach, describe, expect, it } from "vitest";
import { readViewport, storeViewport } from "@/src/features/board/boardViewport";

afterEach(() => localStorage.clear());

describe("boardViewport", () => {
  it("returns null when nothing is stored", () => {
    expect(readViewport("u1")).toBeNull();
  });

  it("round-trips the viewport for that user only", () => {
    storeViewport("u1", { x: 10, y: 20, zoom: 0.8 });
    expect(readViewport("u1")).toEqual({ x: 10, y: 20, zoom: 0.8 });
    expect(readViewport("u2")).toBeNull();
  });
});
