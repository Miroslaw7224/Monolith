// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PROJECT_PRIORITIES, PROJECT_STATUS_CHANGES } from "@/contexts/bc_projects/models";
import { readProjectIndex, readRegistry } from "@/contexts/bc_projects/repositories";
import {
  NewProjectInputSchema,
  PACK_BUDGET_TOKENS,
  ProjectPrioritySchema,
  ProjectStatusSchema,
} from "@/contexts/bc_projects/schemas";
import {
  createProject,
  setProjectStatus,
  slugifyProjectName,
} from "@/contexts/bc_projects/services";
import { PACK_BUDGET_TOKENS as SERVICE_BUDGET } from "@/contexts/bc_projects/services/context-pack";
import { PATCH as detailPATCH } from "@/app/api/projects/[id]/route";
import { POST as listPOST } from "@/app/api/projects/route";
import { ConflictError, DomainError } from "@/lib/errors";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();
const TODAY = new Date(2026, 10, 14);

const REGISTRY = `# NEXUS Project Registry

projects:
  - id: alpha
    name: Alpha
    status: active
    priority: high
    folder: Projects/alpha/
    local_path: ~/projects/alpha
    deploy: https://example.com/alpha-bardzo-dlugi-adres-który-nie-może-zostać-zawinięty-w-zapisie-yaml/app

  # komentarz przy becie
  - id: beta
    name: Beta
    status: active
    priority: low
    folder: Projects/beta/
    local_path: ~/projects/beta
`;

function seed() {
  vault.write("Projects/_registry.yaml", REGISTRY);
  vault.write("Projects/alpha/index.md", "---\nname: Alpha\nstatus: active\n---\n\nTreść\n");
}

function json(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/projects", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("bc_projects: status paused", () => {
  it("setProjectStatus zmienia tylko jedną linię rejestru", async () => {
    seed();
    const project = await setProjectStatus("alpha", "paused", TODAY);
    expect(project.status).toBe("paused");
    expect(vault.read("Projects/_registry.yaml")).toBe(
      REGISTRY.replace("status: active\n    priority: high", "status: paused\n    priority: high")
    );
  });

  it("wznowienie wraca na active, druga pozycja nietknięta", async () => {
    seed();
    await setProjectStatus("alpha", "paused", TODAY);
    await setProjectStatus("alpha", "active", TODAY);
    expect(vault.read("Projects/_registry.yaml")).toBe(REGISTRY);
  });

  it("nieznany projekt: 404", async () => {
    seed();
    await expect(setProjectStatus("nie-ma", "paused", TODAY)).rejects.toThrow(/Nie ma projektu/);
  });

  it("PATCH status: 200 i nowy status w odpowiedzi", async () => {
    seed();
    const res = await detailPATCH(json("PATCH", { status: "paused" }), {
      params: Promise.resolve({ id: "beta" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("paused");
  });

  it("PATCH: nieznany status → 400", async () => {
    seed();
    const res = await detailPATCH(json("PATCH", { status: "done" }), {
      params: Promise.resolve({ id: "beta" }),
    });
    expect(res.status).toBe(400);
  });

  it("listy w schemas zgodne z models", () => {
    expect([...ProjectStatusSchema.options]).toEqual([...PROJECT_STATUS_CHANGES]);
    expect([...ProjectPrioritySchema.options]).toEqual([...PROJECT_PRIORITIES]);
  });

  it("budżet paczki w schemas zgodny z serwisem", () => {
    expect(PACK_BUDGET_TOKENS).toBe(SERVICE_BUDGET);
  });
});

describe("bc_projects: slugifyProjectName", () => {
  it.each([
    ["Gen Podsum AI", "gen-podsum-ai"],
    ["Zażółć gęślą jaźń", "zazolc-gesla-jazn"],
    ["  --Mój  projekt!!  ", "moj-projekt"],
    ["A".repeat(60), "a".repeat(40)],
  ])("%s → %s", (name, slug) => {
    expect(slugifyProjectName(name)).toBe(slug);
  });

  it.each(["", "!!!", "___"])("%j → null", (name) => {
    expect(slugifyProjectName(name)).toBeNull();
  });
});

describe("bc_projects: createProject", () => {
  const INPUT = {
    name: "Mój: nowy #projekt",
    priority: "medium" as const,
    type: "wlasny" as const,
    localPath: "~/projects/moj",
    github: "https://github.com/x/moj",
  };

  it("dopisuje wpis do rejestru i zakłada pliki", async () => {
    seed();
    const project = await createProject(INPUT, TODAY);
    expect(project.id).toBe("moj-nowy-projekt");
    expect(project.status).toBe("active");

    const registry = vault.read("Projects/_registry.yaml") ?? "";
    expect(registry.startsWith(REGISTRY)).toBe(true);
    expect(registry).toContain("# komentarz przy becie");
    const entry = readRegistry().entries.find((e) => e.id === "moj-nowy-projekt");
    expect(entry).toMatchObject({
      name: "Mój: nowy #projekt",
      status: "active",
      priority: "medium",
      folder: "Projects/moj-nowy-projekt/",
      localPath: "~/projects/moj",
      github: "https://github.com/x/moj",
      owner: "personal",
    });

    const index = readProjectIndex(entry!);
    expect(index).toMatchObject({ type: "wlasny", lastWorked: "2026-11-14" });
    expect(vault.read("Projects/moj-nowy-projekt/tasks.md")).toContain(
      "# Tasks — Mój: nowy #projekt"
    );
    expect(vault.read("Projects/moj-nowy-projekt/bugs.md")).toContain("# Bugs");
  });

  it("projekt bez opcjonalnych pól", async () => {
    seed();
    const project = await createProject({ name: "Goły", priority: "low", localPath: "" }, TODAY);
    expect(project.type).toBeUndefined();
    expect(project.github).toBeUndefined();
  });

  it("zajęte id: ConflictError, rejestr bez zmian", async () => {
    seed();
    await expect(
      createProject({ name: "Alpha", priority: "low", localPath: "" }, TODAY)
    ).rejects.toThrow(ConflictError);
    expect(vault.read("Projects/_registry.yaml")).toBe(REGISTRY);
  });

  it("nazwa bez liter i cyfr: 422", async () => {
    seed();
    await expect(
      createProject({ name: "!!!", priority: "low", localPath: "" }, TODAY)
    ).rejects.toThrow(DomainError);
  });

  it("POST /api/projects: 201", async () => {
    seed();
    const res = await listPOST(
      json("POST", { name: "Nowy", priority: "high", localPath: "~/projects/nowy" })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("nowy");
  });

  it("POST: pusta nazwa i zły priorytet → 400", async () => {
    seed();
    expect(
      (await listPOST(json("POST", { name: "", priority: "high", localPath: "" }))).status
    ).toBe(400);
    expect(
      (await listPOST(json("POST", { name: "X", priority: "wysoki", localPath: "" }))).status
    ).toBe(400);
  });

  it("schemat: github tylko http(s)", () => {
    const bad = NewProjectInputSchema.safeParse({ ...INPUT, github: "javascript:alert(1)" });
    expect(bad.success).toBe(false);
  });
});
