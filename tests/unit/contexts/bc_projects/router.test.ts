// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { VaultConfigError } from "@/lib/nexus/vault-path";
import type { Project, ProjectWithContent } from "@/contexts/bc_projects/models";

const mockListProjects = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: mockListProjects,
  getProject: mockGetProject,
}));

import { GET as listGET } from "@/app/api/projects/route";
import { GET as detailGET } from "@/app/api/projects/[id]/route";

const summaryProject: Project = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
  lastWorked: "2026-11-05",
  whereIStopped: "tu",
  freshness: "fresh",
};

const detailProject: ProjectWithContent = {
  ...summaryProject,
  tasks: [],
  bugs: [],
  state: null,
  stateVersion: null,
  devlog: [],
};

describe("bc_projects router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista", async () => {
    mockListProjects.mockReturnValue({
      projects: [summaryProject],
      warnings: ["w"],
    });
    const res = await listGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings).toEqual(["w"]);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].id).toBe("a");
    expect("folder" in body.projects[0]).toBe(false);
  });

  it("szczegóły", async () => {
    mockGetProject.mockReturnValue(detailProject);
    const res = await detailGET(new NextRequest("http://localhost/api/projects/a"), {
      params: Promise.resolve({ id: "a" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("a");
    expect("folder" in body).toBe(false);
    expect(mockGetProject).toHaveBeenCalledWith("a");
  });

  it("nieznany", async () => {
    mockGetProject.mockImplementation(() => {
      throw new NotFoundError("x");
    });
    const res = await detailGET(new NextRequest("http://localhost/api/projects/zzz"), {
      params: Promise.resolve({ id: "zzz" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "x" });
  });

  it("konfiguracja vaulta", async () => {
    mockListProjects.mockImplementation(() => {
      throw new VaultConfigError("Brak NEXUS_VAULT_PATH");
    });
    const res = await listGET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("NEXUS_VAULT_PATH");
  });
});
