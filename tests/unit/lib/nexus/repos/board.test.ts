// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getBoard, saveBoard } from "@/lib/nexus/repos/board";
import { useTempVault } from "./helpers";

const vault = useTempVault();
const BOARD = { tiles: [{ id: "t1" }], frames: [], edges: [] };

describe("board repository", () => {
  it("returns null when Board/board.json does not exist", async () => {
    expect(await getBoard("u")).toBeNull();
  });

  it("saves and reads back exactly tiles, frames and edges", async () => {
    await saveBoard("u", BOARD);
    expect(await getBoard("u")).toEqual(BOARD);
    const stored = JSON.parse(vault.read("Board/board.json")!);
    expect(stored).toMatchObject(BOARD);
    expect(stored.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it("overwrites on the next save", async () => {
    await saveBoard("u", BOARD);
    await saveBoard("u", { tiles: [], frames: [{ id: "f1" }], edges: [] });
    expect(await getBoard("u")).toEqual({ tiles: [], frames: [{ id: "f1" }], edges: [] });
  });

  it("fails loudly on a corrupt file, and a save repairs it", async () => {
    vault.write("Board/board.json", "{");
    await expect(getBoard("u")).rejects.toThrow(/Board\/board\.json/);
    await saveBoard("u", BOARD);
    expect(await getBoard("u")).toEqual(BOARD);
  });
});
