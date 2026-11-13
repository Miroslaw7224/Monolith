// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";

const mockGetResources = vi.hoisted(() => vi.fn());
const mockAddResource = vi.hoisted(() => vi.fn());
const mockUpdateResource = vi.hoisted(() => vi.fn());
const mockDeleteResource = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/services", () => ({
  getResources: mockGetResources,
  addResource: mockAddResource,
  updateResource: mockUpdateResource,
  deleteResource: mockDeleteResource,
}));

import { GET, POST } from "@/app/api/resources/route";
import { DELETE, PUT } from "@/app/api/resources/[resourceId]/route";

const fakeResource = {
  id: "r1",
  description: "opis",
  url: "https://a.com",
  title: "A",
  tags: ["x"],
  isFavorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const ctx = (id: string) => ({ params: Promise.resolve({ resourceId: id }) });

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/resources", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/resources", () => {
  it("returns the list from the service", async () => {
    mockGetResources.mockResolvedValue([fakeResource]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fakeResource]);
  });
});

describe("POST /api/resources", () => {
  it("returns 201, trims description and passes tags", async () => {
    mockAddResource.mockResolvedValue(fakeResource);
    const res = await POST(
      req("POST", { description: "  opis  ", url: "https://a.com", tags: ["x"] })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(fakeResource);
    expect(mockAddResource).toHaveBeenCalledWith({
      description: "opis",
      url: "https://a.com",
      tags: ["x"],
    });
  });

  it("defaults tags to []", async () => {
    mockAddResource.mockResolvedValue(fakeResource);
    await POST(req("POST", { description: "opis", url: "https://a.com" }));
    expect(mockAddResource).toHaveBeenCalledWith({
      description: "opis",
      url: "https://a.com",
      tags: [],
    });
  });

  it.each([
    ["invalid url", { description: "opis", url: "nie-url" }],
    ["empty description", { description: "", url: "https://a.com" }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await POST(req("POST", body));
    expect(res.status).toBe(400);
    expect(mockAddResource).not.toHaveBeenCalled();
  });
});

describe("PUT /api/resources/[resourceId]", () => {
  it("passes only given, trimmed fields and returns the updated resource", async () => {
    mockUpdateResource.mockResolvedValue(undefined);
    mockGetResources.mockResolvedValue([fakeResource]);
    const res = await PUT(req("PUT", { title: " T ", isFavorite: true }), ctx("r1"));
    expect(mockUpdateResource).toHaveBeenCalledWith("r1", { title: "T", isFavorite: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fakeResource);
  });

  it("falls back to { success: true } when the resource is not in the list", async () => {
    mockUpdateResource.mockResolvedValue(undefined);
    mockGetResources.mockResolvedValue([]);
    const res = await PUT(req("PUT", { isFavorite: false }), ctx("r1"));
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 400 for an empty body", async () => {
    const res = await PUT(req("PUT", {}), ctx("r1"));
    expect(res.status).toBe(400);
    expect(mockUpdateResource).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to 404", async () => {
    mockUpdateResource.mockRejectedValue(new NotFoundError("Resource not found"));
    const res = await PUT(req("PUT", { title: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/resources/[resourceId]", () => {
  it("returns 204 without a body", async () => {
    mockDeleteResource.mockResolvedValue(undefined);
    const res = await DELETE(req("DELETE"), ctx("r1"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockDeleteResource).toHaveBeenCalledWith("r1");
  });

  it("maps NotFoundError to 404", async () => {
    mockDeleteResource.mockRejectedValue(new NotFoundError("Resource not found"));
    const res = await DELETE(req("DELETE"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
