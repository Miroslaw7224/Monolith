// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockList = vi.hoisted(() => vi.fn());
const mockAdd = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_inbox/services", () => ({
  listItems: mockList,
  addItem: mockAdd,
  resolve: mockResolve,
  remove: mockRemove,
}));

import { createItem, deleteItem, listInbox, resolveItem } from "@/contexts/bc_inbox/router";

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const item = { id: "1", text: "a", type: "myśl", at: "2026-11-13T09:00" };

beforeEach(() => vi.resetAllMocks());

describe("GET /api/inbox", () => {
  it("200 z listą i licznikiem", async () => {
    mockList.mockReturnValue([item]);
    const res = await listInbox();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [item], open: 1 });
  });

  it("wyjątek to 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockList.mockImplementation(() => {
      throw new Error("boom");
    });
    expect((await listInbox()).status).toBe(500);
  });
});

describe("POST /api/inbox", () => {
  it("201 i zwraca wpis, tekst przycięty", async () => {
    mockAdd.mockResolvedValue(item);
    const res = await createItem(post({ text: "  a " }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(item);
    expect(mockAdd).toHaveBeenCalledWith("a");
  });

  it.each([
    ["pusty tekst", { text: " " }],
    ["brak tekstu", {}],
    ["zły JSON", "{x"],
  ])("400 dla: %s", async (_n, body) => {
    expect((await createItem(post(body))).status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("DomainError z serwisu to 400", async () => {
    mockAdd.mockRejectedValue(new DomainError("Maksymalnie 500 znaków"));
    expect((await createItem(post({ text: "x" }))).status).toBe(400);
  });
});

describe("PATCH /api/inbox/[id]", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const patch = () => new NextRequest("http://localhost/api/inbox/1", { method: "PATCH" });

  it("200 po oznaczeniu jako posegregowane", async () => {
    mockResolve.mockResolvedValue(undefined);
    const res = await resolveItem(patch(), ctx("1"));
    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("1");
  });

  it("404 dla nieznanego id", async () => {
    mockResolve.mockRejectedValue(new NotFoundError("Nie ma wpisu"));
    expect((await resolveItem(patch(), ctx("x"))).status).toBe(404);
  });
});

describe("DELETE /api/inbox/[id]", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const del = () => new NextRequest("http://localhost/api/inbox/1", { method: "DELETE" });

  it("200 po usunięciu wpisu", async () => {
    mockRemove.mockResolvedValue(undefined);
    const res = await deleteItem(del(), ctx("1"));
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith("1");
  });

  it("404 dla nieznanego id", async () => {
    mockRemove.mockRejectedValue(new NotFoundError("Nie ma wpisu"));
    expect((await deleteItem(del(), ctx("x"))).status).toBe(404);
  });
});
