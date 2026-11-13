// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";

const mockListDocuments = vi.hoisted(() => vi.fn());
const mockDeleteDocument = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/services", () => ({
  listDocuments: mockListDocuments,
  deleteDocument: mockDeleteDocument,
}));

import { GET } from "@/app/api/documents/route";
import { DELETE } from "@/app/api/documents/[id]/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/documents", () => {
  it("returns documents with exactly id, name, content, type, created_at", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "d1",
        name: "a.txt",
        content: "x",
        type: "text/plain",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body[0]).sort()).toEqual(["content", "created_at", "id", "name", "type"]);
  });
});

describe("DELETE /api/documents/[id]", () => {
  const call = (id: string) =>
    DELETE(new NextRequest("http://localhost/api/documents/" + id, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });

  it("returns { success: true } and passes the id", async () => {
    mockDeleteDocument.mockResolvedValue(undefined);
    const res = await call("d1");
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteDocument).toHaveBeenCalledWith("d1");
  });

  it("maps NotFoundError to 404", async () => {
    mockDeleteDocument.mockRejectedValue(new NotFoundError("Document not found"));
    expect((await call("nope")).status).toBe(404);
  });
});
