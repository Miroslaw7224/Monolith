// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getBoard, saveBoard } from "@/contexts/bc_board/services";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const FILE = "Board/board.json";

const board = {
  tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
  frames: [],
  edges: [],
};

describe("bc_board services", () => {
  it("returns null when the vault has no board", async () => {
    await expect(getBoard()).resolves.toBeNull();
  });

  it("returns the stored document untouched", async () => {
    const stored = {
      tiles: [{ id: "x", title: "", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
      frames: [],
      edges: [],
    };
    vault.write(FILE, JSON.stringify(stored));

    await expect(getBoard()).resolves.toEqual(stored);
  });

  it("zapisuje tablicę w pliku i zwraca ją", async () => {
    await expect(saveBoard(board)).resolves.toBe(board);

    const { updatedAt, ...saved } = JSON.parse(vault.read(FILE)!);
    expect(saved).toEqual(board);
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
  });

  it("odczyt po zapisie zwraca zapisaną tablicę", async () => {
    await saveBoard(board);

    await expect(getBoard()).resolves.toEqual(board);
  });

  it("nie zwraca tablicy, gdy zapis się nie udaje", async () => {
    // Katalog w miejscu pliku: prawdziwy błąd zapisu.
    vault.write(`${FILE}/x`, "");

    await expect(saveBoard(board)).rejects.toThrow();
  });
});
