import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetBoard = vi.hoisted(() => vi.fn());
const mockSaveBoard = vi.hoisted(() => vi.fn());

vi.mock("@/services/boardService", () => ({
  getBoard: mockGetBoard,
  saveBoard: mockSaveBoard,
}));

import { GET, PUT } from "@/app/api/board/route";

function makeRequest(method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {};
  if (body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/board", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the board for a signed-in user", async () => {
    mockGetBoard.mockResolvedValue({ tiles: [], frames: [], edges: [] });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tiles: [], frames: [], edges: [] });
    expect(mockGetBoard).toHaveBeenCalledWith();
  });

  it("returns 400 for a tile that is too small and does not save", async () => {
    const res = await PUT(
      makeRequest("PUT", {
        tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 10, h: 10, frame: null }],
        frames: [],
        edges: [],
      })
    );
    expect(res.status).toBe(400);
    expect(mockSaveBoard).not.toHaveBeenCalled();
  });
});
