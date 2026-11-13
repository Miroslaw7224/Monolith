// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";

const mockListNotes = vi.hoisted(() => vi.fn());
const mockCreateNote = vi.hoisted(() => vi.fn());
const mockUpdateNote = vi.hoisted(() => vi.fn());
const mockDeleteNote = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_notes/services", () => ({
  listNotes: mockListNotes,
  createNote: mockCreateNote,
  updateNote: mockUpdateNote,
  deleteNote: mockDeleteNote,
}));

import { GET, POST } from "@/app/api/notes/route";
import { DELETE, PUT } from "@/app/api/notes/[id]/route";

function makeRequest(options?: { method?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = {};
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/notes", {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeNote = {
  id: "note-1",
  title: "Moja notatka",
  content: "<p>Treść</p>",
  created_at: new Date().toISOString(),
};

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notes array with id, title, content, created_at", async () => {
    mockListNotes.mockResolvedValue([fakeNote]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ id: "note-1", title: "Moja notatka" });
    expect(mockListNotes).toHaveBeenCalledWith();
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates note with empty title/content when fields are omitted", async () => {
    mockCreateNote.mockResolvedValue(fakeNote);
    const res = await POST(makeRequest({ method: "POST", body: {} }));
    expect(res.status).toBe(200);
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.objectContaining({ title: "", content: "" })
    );
  });

  it("creates note with provided title and content", async () => {
    mockCreateNote.mockResolvedValue(fakeNote);
    const res = await POST(
      makeRequest({ method: "POST", body: { title: "Nowa notatka", content: "<p>Treść</p>" } })
    );
    expect(res.status).toBe(200);
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nowa notatka", content: "<p>Treść</p>" })
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "content-type": "application/json" },
      body: "not-valid-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Invalid JSON" });
  });
});

describe("POST /api/notes (kształt odpowiedzi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zwraca dokładnie klucze id, title, content", async () => {
    mockCreateNote.mockResolvedValue({ id: "n1", title: "T", content: "C" });
    const res = await POST(makeRequest({ method: "POST", body: { title: "T", content: "C" } }));
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["content", "id", "title"]);
  });
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const putRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/notes/n1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PUT /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("przekazuje id, title i content do serwisu", async () => {
    mockUpdateNote.mockResolvedValue(undefined);
    const res = await PUT(putRequest({ title: "T", content: "C" }), ctx("n1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpdateNote).toHaveBeenCalledWith("n1", { title: "T", content: "C" });
  });

  it("mapuje NotFoundError na 404", async () => {
    mockUpdateNote.mockRejectedValue(new NotFoundError("Note not found"));
    const res = await PUT(putRequest({ title: "T", content: "C" }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("woła serwis z id i zwraca success", async () => {
    mockDeleteNote.mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/notes/n1", { method: "DELETE" });
    const res = await DELETE(req, ctx("n1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteNote).toHaveBeenCalledWith("n1");
  });
});
