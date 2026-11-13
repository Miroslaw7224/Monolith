// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import { VaultConfigError } from "@/lib/nexus/vault-path";
import type { Project, ProjectWithContent } from "@/contexts/bc_projects/models";

const mockListProjects = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());
const mockSaveState = vi.hoisted(() => vi.fn());
const mockAddDevlogEntry = vi.hoisted(() => vi.fn());
const mockSetProjectType = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: mockListProjects,
  getProject: mockGetProject,
  saveState: mockSaveState,
  addDevlogEntry: mockAddDevlogEntry,
  setProjectType: mockSetProjectType,
}));

import { GET as listGET } from "@/app/api/projects/route";
import { GET as detailGET, PATCH as detailPATCH } from "@/app/api/projects/[id]/route";
import { PUT as statePUT } from "@/app/api/projects/[id]/state/route";
import { POST as devlogPOST } from "@/app/api/projects/[id]/devlog/route";

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

function jsonRequest(method: string, url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const A = { params: Promise.resolve({ id: "a" }) };
const STATE_BODY = {
  branch: "main",
  env: "local",
  blocker: "",
  nextStep: "krok",
  links: ["https://a"],
  milestone: "M",
  milestoneDue: "",
  version: null,
};

describe("bc_projects router: zapisy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveState.mockResolvedValue(detailProject);
    mockAddDevlogEntry.mockResolvedValue(detailProject);
    mockSetProjectType.mockResolvedValue(detailProject);
  });

  it("PUT state: 200, serwis dostaje sparsowane dane, bez folder w odpowiedzi", async () => {
    const res = await statePUT(
      jsonRequest("PUT", "http://localhost/api/projects/a/state", STATE_BODY),
      A
    );
    expect(res.status).toBe(200);
    expect(mockSaveState).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ branch: "main", links: ["https://a"], version: null })
    );
    const body = await res.json();
    expect(body.id).toBe("a");
    expect("folder" in body).toBe(false);
  });

  it("PUT state: zła wersja → 400, serwis niewołany", async () => {
    const res = await statePUT(
      jsonRequest("PUT", "http://localhost/api/projects/a/state", { ...STATE_BODY, version: "x" }),
      A
    );
    expect(res.status).toBe(400);
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  it("PUT state: zły JSON → 400", async () => {
    const res = await statePUT(jsonRequest("PUT", "http://localhost/api/projects/a/state", "{"), A);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("PUT state: ConflictError → 409", async () => {
    mockSaveState.mockRejectedValue(new ConflictError("Plik zmienił się w międzyczasie"));
    const res = await statePUT(
      jsonRequest("PUT", "http://localhost/api/projects/a/state", STATE_BODY),
      A
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Plik zmienił się w międzyczasie" });
  });

  it("PUT state: NotFoundError → 404", async () => {
    mockSaveState.mockRejectedValue(new NotFoundError("brak"));
    const res = await statePUT(
      jsonRequest("PUT", "http://localhost/api/projects/a/state", STATE_BODY),
      A
    );
    expect(res.status).toBe(404);
  });

  it("POST devlog: 201 i wywołanie serwisu", async () => {
    const res = await devlogPOST(
      jsonRequest("POST", "http://localhost/api/projects/a/devlog", { title: "T", why: "W" }),
      A
    );
    expect(res.status).toBe(201);
    expect(mockAddDevlogEntry).toHaveBeenCalledWith("a", { title: "T", why: "W" });
  });

  it("POST devlog: pusty tytuł → 400", async () => {
    const res = await devlogPOST(
      jsonRequest("POST", "http://localhost/api/projects/a/devlog", { title: "", why: "W" }),
      A
    );
    expect(res.status).toBe(400);
    expect(mockAddDevlogEntry).not.toHaveBeenCalled();
  });

  it("PATCH type: 200", async () => {
    const res = await detailPATCH(
      jsonRequest("PATCH", "http://localhost/api/projects/a", { type: "wlasny" }),
      A
    );
    expect(res.status).toBe(200);
    expect(mockSetProjectType).toHaveBeenCalledWith("a", "wlasny");
  });

  it("PATCH type: nieznana wartość → 400", async () => {
    const res = await detailPATCH(
      jsonRequest("PATCH", "http://localhost/api/projects/a", { type: "firma" }),
      A
    );
    expect(res.status).toBe(400);
    expect(mockSetProjectType).not.toHaveBeenCalled();
  });

  it("PATCH type: DomainError 422", async () => {
    mockSetProjectType.mockRejectedValue(new DomainError("index.md nie ma frontmattera", 422));
    const res = await detailPATCH(
      jsonRequest("PATCH", "http://localhost/api/projects/a", { type: "etat" }),
      A
    );
    expect(res.status).toBe(422);
  });
});
