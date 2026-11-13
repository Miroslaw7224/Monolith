// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockGetUserTags = vi.hoisted(() => vi.fn());
const mockCreateUserTag = vi.hoisted(() => vi.fn());
const mockUpdateUserTag = vi.hoisted(() => vi.fn());
const mockDeleteUserTag = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tags/services", () => ({
  getUserTags: mockGetUserTags,
  createUserTag: mockCreateUserTag,
  updateUserTag: mockUpdateUserTag,
  deleteUserTag: mockDeleteUserTag,
}));

import { GET, POST } from "@/app/api/tags/route";
import { DELETE, PUT } from "@/app/api/tags/[id]/route";

const json = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/tags", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  for (const m of [mockGetUserTags, mockCreateUserTag, mockUpdateUserTag, mockDeleteUserTag]) {
    m.mockReset();
  }
});

describe("GET /api/tags", () => {
  it("zwraca listę jako DTO", async () => {
    mockGetUserTags.mockResolvedValue([{ id: "t1", tag: "work", title: "Work", color: "#f00" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "t1", tag: "work", title: "Work", color: "#f00" }]);
  });
});

describe("POST /api/tags", () => {
  it("przycina pola i zwraca utworzony tag", async () => {
    mockCreateUserTag.mockResolvedValue({ id: "t1", tag: "work", title: "Work" });
    const res = await POST(json("POST", { tag: " work ", title: " Work ", color: "  " }));
    expect(res.status).toBe(200);
    expect(mockCreateUserTag).toHaveBeenCalledWith({
      tag: "work",
      title: "Work",
      color: undefined,
    });
    expect(await res.json()).toEqual({ id: "t1", tag: "work", title: "Work" });
  });

  it("odrzuca pusty tag (400) bez wołania serwisu", async () => {
    const res = await POST(json("POST", { tag: "  " }));
    expect(res.status).toBe(400);
    expect(mockCreateUserTag).not.toHaveBeenCalled();
  });

  it("mapuje DomainError na 400", async () => {
    mockCreateUserTag.mockRejectedValue(new DomainError("tag required"));
    const res = await POST(json("POST", { tag: "x" }));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/tags/[id]", () => {
  it("color: pusty string → null, nieznany typ → null, brak → undefined", async () => {
    mockUpdateUserTag.mockResolvedValue(undefined);
    await PUT(json("PUT", { color: " " }), ctx("t1"));
    expect(mockUpdateUserTag).toHaveBeenLastCalledWith("t1", {
      tag: undefined,
      title: undefined,
      color: null,
    });
    await PUT(json("PUT", { color: 5 }), ctx("t1"));
    expect(mockUpdateUserTag).toHaveBeenLastCalledWith("t1", {
      tag: undefined,
      title: undefined,
      color: null,
    });
    await PUT(json("PUT", { title: " Nowy " }), ctx("t1"));
    expect(mockUpdateUserTag).toHaveBeenLastCalledWith("t1", {
      tag: undefined,
      title: "Nowy",
      color: undefined,
    });
  });

  it("mapuje NotFoundError na 404", async () => {
    mockUpdateUserTag.mockRejectedValue(new NotFoundError("Tag not found"));
    const res = await PUT(json("PUT", { title: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/tags/[id]", () => {
  it("usuwa i zwraca success", async () => {
    mockDeleteUserTag.mockResolvedValue(undefined);
    const res = await DELETE(json("DELETE", {}), ctx("t1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteUserTag).toHaveBeenCalledWith("t1");
  });
});
