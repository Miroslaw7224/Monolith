// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError } from "@/lib/errors";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";

const mockArchiveDone = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({ archiveDone: mockArchiveDone }));

import { POST as archivePOST } from "@/app/api/projects/[id]/tasks/archive/route";

const HASH = "a".repeat(64);
const project: ProjectWithContent = {
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
};

const post = (body: unknown) =>
  archivePOST(
    new NextRequest("http://localhost/api/projects/a/tasks/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "a" }) }
  );

describe("bc_projects router: POST tasks/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArchiveDone.mockResolvedValue({ project, archived: 4 });
  });

  it("200: ProjectDetailDto plus archived, serwis dostaje wersję jako obiekt i próg", async () => {
    const res = await post({ version: `7:${HASH}`, olderThanDays: 5 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("a");
    expect(body.archived).toBe(4);
    expect("folder" in body).toBe(false);
    expect(mockArchiveDone).toHaveBeenCalledWith("a", { size: 7, hash: HASH }, 5);
  });

  it("version null jest przekazane jako null", async () => {
    await post({ version: null, olderThanDays: 7 });
    expect(mockArchiveDone).toHaveBeenCalledWith("a", null, 7);
  });

  it.each([[0], [31]])("olderThanDays %i: 400 bez wywołania serwisu", async (olderThanDays) => {
    const res = await post({ version: null, olderThanDays });
    expect(res.status).toBe(400);
    expect(mockArchiveDone).not.toHaveBeenCalled();
  });

  it("ConflictError → 409, DomainError → jego status", async () => {
    mockArchiveDone.mockRejectedValueOnce(new ConflictError("zmiana"));
    expect((await post({ version: null, olderThanDays: 7 })).status).toBe(409);
    mockArchiveDone.mockRejectedValueOnce(
      new DomainError("changelog.md ma nieznany nagłówek", 422)
    );
    expect((await post({ version: null, olderThanDays: 7 })).status).toBe(422);
  });
});
