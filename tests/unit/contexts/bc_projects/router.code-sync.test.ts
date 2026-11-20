// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError } from "@/lib/errors";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";

const mockListCodeSync = vi.hoisted(() => vi.fn());
const mockMarkCodeSynced = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({
  listCodeSync: mockListCodeSync,
  markCodeSynced: mockMarkCodeSynced,
}));

import { GET as mapGET, dynamic as mapDynamic } from "@/app/api/projects/code-sync/route";
import { PUT as markPUT } from "@/app/api/projects/[id]/code-sync/route";

const HEAD = "f".repeat(40);
const detail: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
  whereIStopped: null,
  purpose: null,
  freshness: "fresh",
  tasks: [],
  board: { blockers: [], now: [], next: [], icebox: [], version: null },
  bugs: [],
  state: null,
  stateVersion: null,
  devlog: [],
  codeSync: { status: "current", head: HEAD },
};

const ctx = { params: Promise.resolve({ id: "a" }) };
const put = (body: unknown) =>
  new NextRequest("http://localhost/api/projects/a/code-sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/code-sync", () => {
  it("trasa jest dynamiczna (bez tego build produkcyjny zamraża mapę stanów)", () => {
    expect(mapDynamic).toBe("force-dynamic");
  });

  it("mapa stanów po id", async () => {
    mockListCodeSync.mockReturnValue({ a: { status: "no-baseline" } });
    const res = await mapGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ codeSync: { a: { status: "no-baseline" } } });
  });
});

describe("PUT /api/projects/[id]/code-sync", () => {
  it("commit z ciała: małe litery, odpowiedź to szczegóły projektu z codeSync", async () => {
    mockMarkCodeSynced.mockResolvedValue(detail);
    const res = await markPUT(put({ commit: "ABC1234" }), ctx);
    expect(res.status).toBe(200);
    expect(mockMarkCodeSynced).toHaveBeenCalledWith("a", "abc1234");
    expect((await res.json()).codeSync).toEqual({ status: "current", head: HEAD });
  });

  it("puste ciało `{}`: commit undefined (serwer bierze HEAD)", async () => {
    mockMarkCodeSynced.mockResolvedValue(detail);
    const res = await markPUT(put({}), ctx);
    expect(res.status).toBe(200);
    expect(mockMarkCodeSynced).toHaveBeenCalledWith("a", undefined);
  });

  it.each(["xyz", "--help", "abc12", "HEAD"])(
    "zły commit %j: 400 bez wołania serwisu",
    async (c) => {
      const res = await markPUT(put({ commit: c }), ctx);
      expect(res.status).toBe(400);
      expect(mockMarkCodeSynced).not.toHaveBeenCalled();
    }
  );

  it("błąd domenowy 422 i konflikt 409 mapują się na statusy", async () => {
    mockMarkCodeSynced.mockRejectedValueOnce(new DomainError("nie przodek", 422));
    expect((await markPUT(put({ commit: "abc1234" }), ctx)).status).toBe(422);
    mockMarkCodeSynced.mockRejectedValueOnce(new ConflictError("zmiana"));
    expect((await markPUT(put({ commit: "abc1234" }), ctx)).status).toBe(409);
  });
});
