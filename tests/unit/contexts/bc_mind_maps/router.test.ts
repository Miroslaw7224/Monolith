// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError } from "@/lib/errors";

const svc = vi.hoisted(() => ({
  getMindMaps: vi.fn(),
  createMindMap: vi.fn(),
  getMindMap: vi.fn(),
  saveMindMap: vi.fn(),
  deleteMindMap: vi.fn(),
}));

vi.mock("@/contexts/bc_mind_maps/services", () => svc);

import { GET as LIST, POST as CREATE } from "@/app/api/mind-maps/route";
import { GET, PATCH, DELETE } from "@/app/api/mind-maps/[id]/route";

const node = { id: "root", label: "Mapa", note: "", collapsed: false, children: [] };
const map = { id: "m1", title: "Mapa", rootNode: node, colWidths: {}, updatedAt: "2026-11-12" };
const ctx = (id = "m1") => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mind-maps", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/mind-maps", () => {
  it("returns the list", async () => {
    svc.getMindMaps.mockResolvedValue([map]);
    const res = await LIST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([map]);
  });

  it("maps a service error to its status", async () => {
    svc.getMindMaps.mockRejectedValue(new DomainError("boom", 500));
    expect((await LIST()).status).toBe(500);
  });
});

describe("POST /api/mind-maps", () => {
  it("creates with an empty title for {}", async () => {
    svc.createMindMap.mockResolvedValue(map);
    const res = await CREATE(req("POST", {}));
    expect(res.status).toBe(201);
    expect(svc.createMindMap).toHaveBeenCalledWith("");
    expect(await res.json()).toEqual(map);
  });

  it("rejects a non-string title with 400", async () => {
    const res = await CREATE(req("POST", { title: 1 }));
    expect(res.status).toBe(400);
    expect(svc.createMindMap).not.toHaveBeenCalled();
  });
});

describe("GET /api/mind-maps/[id]", () => {
  it("returns the map", async () => {
    svc.getMindMap.mockResolvedValue(map);
    const res = await GET(req("GET"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(map);
    expect(svc.getMindMap).toHaveBeenCalledWith("m1");
  });

  it("returns 404 when the service says so", async () => {
    svc.getMindMap.mockRejectedValue(new DomainError("Mind map not found", 404));
    expect((await GET(req("GET"), ctx("zz"))).status).toBe(404);
  });
});

describe("PATCH /api/mind-maps/[id]", () => {
  it("saves the given fields", async () => {
    svc.saveMindMap.mockResolvedValue(undefined);
    const res = await PATCH(
      req("PATCH", { title: "N", rootNode: node, colWidths: { "1": 200 } }),
      ctx()
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(svc.saveMindMap).toHaveBeenCalledWith("m1", {
      title: "N",
      rootNode: node,
      colWidths: { "1": 200 },
    });
  });

  it("rejects a bad rootNode with 400", async () => {
    const res = await PATCH(req("PATCH", { rootNode: { id: "x" } }), ctx());
    expect(res.status).toBe(400);
    expect(svc.saveMindMap).not.toHaveBeenCalled();
  });

  it("returns 409 on a conflict", async () => {
    svc.saveMindMap.mockRejectedValue(new ConflictError("changed"));
    expect((await PATCH(req("PATCH", { title: "N" }), ctx())).status).toBe(409);
  });
});

describe("DELETE /api/mind-maps/[id]", () => {
  it("deletes and returns success", async () => {
    svc.deleteMindMap.mockResolvedValue(undefined);
    const res = await DELETE(req("DELETE"), ctx());
    expect(await res.json()).toEqual({ success: true });
    expect(svc.deleteMindMap).toHaveBeenCalledWith("m1");
  });

  it("maps a service error to its status", async () => {
    svc.deleteMindMap.mockRejectedValue(new DomainError("Mind map not found", 404));
    expect((await DELETE(req("DELETE"), ctx())).status).toBe(404);
  });
});
