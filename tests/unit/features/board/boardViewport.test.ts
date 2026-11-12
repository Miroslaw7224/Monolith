import { afterEach, describe, expect, it, vi } from "vitest";
import { readViewport, storeViewport } from "@/src/features/board/boardViewport";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("boardViewport", () => {
  it("returns null when nothing is stored", () => {
    expect(readViewport()).toBeNull();
  });

  it("round-trips the viewport under a single key", () => {
    storeViewport({ x: 10, y: 20, zoom: 0.8 });
    expect(readViewport()).toEqual({ x: 10, y: 20, zoom: 0.8 });
    expect(localStorage.getItem("board-viewport")).not.toBeNull();
  });

  it("returns null for corrupted or non-numeric data", () => {
    localStorage.setItem("board-viewport", "{nie json");
    expect(readViewport()).toBeNull();
    localStorage.setItem("board-viewport", JSON.stringify({ x: "a", y: 1, zoom: 1 }));
    expect(readViewport()).toBeNull();
  });

  it("returns null instead of throwing when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readViewport()).toBeNull();
  });

  it("does not throw when localStorage rejects the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => storeViewport({ x: 1, y: 2, zoom: 1 })).not.toThrow();
  });
});
