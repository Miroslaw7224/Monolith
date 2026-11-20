// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockListProjects = vi.hoisted(() => vi.fn<typeof ProjectsServices.listProjects>());
vi.mock("@/contexts/bc_projects/services", async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectsServices>();
  return {
    listProjects: mockListProjects,
    hasCompanyData: actual.hasCompanyData,
  } satisfies Partial<typeof ProjectsServices>;
});

import * as services from "@/contexts/bc_arsenal/services";

type E = ReturnType<typeof ProjectsServices.listProjects>["projects"][number];
const entry = (o: Partial<E> = {}): E => ({
  id: "p",
  name: "Projekt P",
  status: "active",
  priority: "medium",
  folder: "Projects/p/",
  localPath: "~/p",
  owner: "personal",
  whereIStopped: null,
  purpose: null,
  freshness: "fresh",
  ...o,
});

const vault = setupTempVault();
const PATH = "Arsenal/Skills/tdd/skill.md";
const TODAY = new Date(2026, 10, 14);

beforeEach(() => {
  mockListProjects.mockReset();
  mockListProjects.mockReturnValue({
    projects: [
      entry({ id: "p", name: "Projekt P", localPath: "~/p", owner: "personal" }),
      entry({ id: "q", name: "Projekt Q", localPath: "~/q", owner: "personal" }),
    ],
    warnings: [],
  });
  vault.write(PATH, "---\nname: tdd\nslug: tdd\ntype: skill-doc\nsummary: s\n---\nTreść\n");
});

const meta = () => parseFrontmatter(vault.read(PATH) ?? "")?.meta;

describe("markDeployed", () => {
  it("dopisuje wpis z dzisiejszą datą i zwraca zaktualizowany skill", async () => {
    const skill = await services.markDeployed("tdd", "p", "full", TODAY);
    expect(meta()?.deployed).toEqual([{ project: "p", mode: "full", date: "2026-11-14" }]);
    expect(skill.deployed).toEqual([{ project: "p", mode: "full", date: "2026-11-14" }]);
    expect(meta()).toMatchObject({ name: "tdd", slug: "tdd", type: "skill-doc" });
  });

  it("ponowne oznaczenie tego samego projektu zastępuje wpis", async () => {
    await services.markDeployed("tdd", "p", "full", TODAY);
    await services.markDeployed("tdd", "p", "adapted", new Date(2026, 10, 15));
    expect(meta()?.deployed).toEqual([{ project: "p", mode: "adapted", date: "2026-11-15" }]);
  });

  it("zachowuje wpisy innych projektów, także spoza rejestru (ukryte w UI)", async () => {
    vault.write(
      PATH,
      "---\nname: tdd\nslug: tdd\ntype: skill-doc\ndeployed:\n  - project: zniknal\n    mode: full\n    date: 2026-11-01\n---\nTreść\n"
    );
    const skill = await services.markDeployed("tdd", "q", "full", TODAY);
    expect(meta()?.deployed).toEqual([
      { project: "zniknal", mode: "full", date: "2026-11-01" },
      { project: "q", mode: "full", date: "2026-11-14" },
    ]);
    expect(skill.deployed.map((d) => d.project)).toEqual(["q"]);
  });

  it("błędy: zły slug 400, brak skilla 404, brak projektu 404", async () => {
    await expect(services.markDeployed("../x", "p", "full", TODAY)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(services.markDeployed("nie-ma", "p", "full", TODAY)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(services.markDeployed("tdd", "nie-ma", "full", TODAY)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
