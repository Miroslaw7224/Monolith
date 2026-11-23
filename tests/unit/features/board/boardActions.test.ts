import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, type BoardDto as Board } from "@/contexts/bc_board/schemas";
import {
  addFrame,
  addTile,
  connectTiles,
  placeFrame,
  placeTile,
  reconnectEdge,
  removeEdge,
} from "@/src/features/board/boardActions";

describe("board actions", () => {
  it("adds a 240×120 tile around the center and opens no frame when the board is empty", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 100, y: 80 }, "Nowy kafelek");
    expect(board.tiles).toEqual([
      {
        id: tileId,
        title: "Nowy kafelek",
        note: "",
        x: 100 - 120,
        y: 80 - 60,
        w: 240,
        h: 120,
        frame: null,
      },
    ]);
  });

  it("puts a new frame under tiles whose centers it covers", () => {
    const first = addTile(EMPTY_BOARD, { x: 100, y: 80 }, "A").board;
    const next = addFrame(first, { x: 100, y: 80 }, "  Grupa  ");
    expect(next.frames).toEqual([
      { id: next.frames[0].id, title: "Grupa", x: 100 - 260, y: 80 - 90, w: 520, h: 180 },
    ]);
    expect(next.tiles[0].frame).toBe(next.frames[0].id);
  });

  it("does not write a tile nudge under half a pixel", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A");
    const tile = board.tiles[0];
    expect(placeTile(board, tileId, { ...tile, x: tile.x + 0.4 })).toBeNull();
  });

  it("moves a frame's tiles and recomputes membership", () => {
    let board: Board = addFrame(EMPTY_BOARD, { x: 260, y: 90 }, "Ramka");
    const frame = board.frames[0];
    const added = addTile(board, { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }, "W");
    board = added.board;
    const moved = placeFrame(board, frame.id, { ...frame, x: frame.x + 40, y: frame.y });
    expect(moved).not.toBeNull();
    expect(moved!.tiles).toEqual([
      { ...board.tiles[0], x: board.tiles[0].x + 40, frame: frame.id },
    ]);
  });

  it("refuses an arrow that does not join two different tiles", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A");
    expect(connectTiles(board, tileId, tileId)).toBeNull();
    expect(connectTiles(board, tileId, "missing")).toBeNull();
  });

  it("reconnects and removes an arrow", () => {
    let board = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A").board;
    const a = board.tiles[0].id;
    board = addTile(board, { x: 400, y: 0 }, "B").board;
    const b = board.tiles[1].id;
    board = addTile(board, { x: 800, y: 0 }, "C").board;
    const c = board.tiles[2].id;
    board = connectTiles(board, a, b)!;
    const edgeId = board.edges[0].id;
    const moved = reconnectEdge(board, edgeId, a, c);
    expect(moved!.edges[0]).toMatchObject({ id: edgeId, source: a, target: c });
    expect(removeEdge(moved!, edgeId).edges).toEqual([]);
  });
});
