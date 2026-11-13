// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetBoard = vi.hoisted(() => vi.fn());
const mockSaveBoard = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_board/services", () => ({
  getBoard: mockGetBoard,
  saveBoard: mockSaveBoard,
}));

import { GET, PUT } from "@/app/api/board/route";

const tile = { id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null };

function makeRequest(method: string, body?: unknown, rawBody?: string): NextRequest {
  const hasBody = body !== undefined || rawBody !== undefined;
  return new NextRequest("http://localhost/api/board", {
    method,
    headers: hasBody ? { "content-type": "application/json" } : {},
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveBoard.mockImplementation(async (board: unknown) => board);
});

describe("GET /api/board", () => {
  it("returns an empty board when nothing is stored", async () => {
    mockGetBoard.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tiles: [], frames: [], edges: [] });
    expect(mockGetBoard).toHaveBeenCalledWith();
  });

  it("returns the stored board with trimmed titles", async () => {
    mockGetBoard.mockResolvedValue({
      tiles: [{ ...tile, title: "  A  " }],
      frames: [],
      edges: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).tiles[0].title).toBe("A");
  });

  it("returns 400 for a corrupt stored board", async () => {
    mockGetBoard.mockResolvedValue({ tiles: [{ ...tile, w: 10 }], frames: [], edges: [] });
    const res = await GET();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Tile or frame is too small" });
  });

  it("maps a service failure to 500", async () => {
    mockGetBoard.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe("PUT /api/board", () => {
  it("returns 400 for a tile that is too small and does not save", async () => {
    const res = await PUT(
      makeRequest("PUT", { tiles: [{ ...tile, w: 10, h: 10 }], frames: [], edges: [] })
    );
    expect(res.status).toBe(400);
    expect(mockSaveBoard).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown frame and does not save", async () => {
    const res = await PUT(
      makeRequest("PUT", { tiles: [{ ...tile, frame: "nope" }], frames: [], edges: [] })
    );
    expect(res.status).toBe(400);
    expect(mockSaveBoard).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await PUT(makeRequest("PUT", undefined, "{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
    expect(mockSaveBoard).not.toHaveBeenCalled();
  });

  it("maps a service failure to 500", async () => {
    mockSaveBoard.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PUT(makeRequest("PUT", { tiles: [tile], frames: [], edges: [] }));
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it("saves the normalized board and returns it", async () => {
    const res = await PUT(
      makeRequest("PUT", { tiles: [{ ...tile, title: "  A  " }], frames: [], edges: [] })
    );
    expect(res.status).toBe(200);
    expect(mockSaveBoard).toHaveBeenCalledWith({
      tiles: [{ ...tile, title: "A" }],
      frames: [],
      edges: [],
    });
    expect(await res.json()).toEqual({ tiles: [{ ...tile, title: "A" }], frames: [], edges: [] });
  });
});
