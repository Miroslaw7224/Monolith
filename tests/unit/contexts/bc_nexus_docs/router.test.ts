// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockListDocs = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_nexus_docs/services", () => ({
  listDocs: mockListDocs,
  getDoc: mockGetDoc,
}));

import { GET as listGET } from "@/app/api/nexus-docs/route";
import { GET as docGET } from "@/app/api/nexus-docs/[...path]/route";

beforeEach(() => {
  mockListDocs.mockReset();
  mockGetDoc.mockReset();
});

const req = new Request("http://localhost/api/nexus-docs");
const ctx = (path: unknown) => ({ params: Promise.resolve({ path }) }) as never;

describe("GET /api/nexus-docs", () => {
  it("zwraca podsumowania jako DTO", async () => {
    mockListDocs.mockReturnValue([
      { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: ["x"] },
    ]);
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: ["x"] },
    ]);
  });

  it("błąd domeny mapuje na jego status", async () => {
    mockListDocs.mockImplementation(() => {
      throw new DomainError("boom", 400);
    });
    expect((await listGET()).status).toBe(400);
  });
});

describe("GET /api/nexus-docs/[...path]", () => {
  it("przekazuje segmenty do serwisu i zwraca dokument", async () => {
    mockGetDoc.mockReturnValue({
      path: "Knowledge/ai/a.md",
      area: "Knowledge",
      group: "ai",
      title: "A",
      tags: [],
      frontmatter: [{ key: "title", value: "A" }],
      body: "treść",
    });
    const res = await docGET(req, ctx(["Knowledge", "ai", "a.md"]));
    expect(res.status).toBe(200);
    expect(mockGetDoc).toHaveBeenCalledWith(["Knowledge", "ai", "a.md"]);
    const body = await res.json();
    expect(body.body).toBe("treść");
    expect(body.frontmatter).toEqual([{ key: "title", value: "A" }]);
  });

  it("brak dokumentu daje 404", async () => {
    mockGetDoc.mockImplementation(() => {
      throw new NotFoundError("nie ma");
    });
    expect((await docGET(req, ctx(["Knowledge", "x.md"]))).status).toBe(404);
  });

  it("413 z serwisu przechodzi bez zmian", async () => {
    mockGetDoc.mockImplementation(() => {
      throw new DomainError("za duży", 413);
    });
    expect((await docGET(req, ctx(["Knowledge", "x.md"]))).status).toBe(413);
  });

  it("niepoprawny parametr (nie tablica, pusta tablica) daje 400 bez wołania serwisu", async () => {
    expect((await docGET(req, ctx("Knowledge/a.md"))).status).toBe(400);
    expect((await docGET(req, ctx([]))).status).toBe(400);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});
