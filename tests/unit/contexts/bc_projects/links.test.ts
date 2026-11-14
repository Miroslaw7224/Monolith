// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { readRegistry } from "@/contexts/bc_projects/repositories";
import { ProjectPatchInputSchema } from "@/contexts/bc_projects/schemas";
import { setProjectLinks } from "@/contexts/bc_projects/services";
import { PATCH as detailPATCH } from "@/app/api/projects/[id]/route";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();
const TODAY = new Date(2026, 10, 14);

const REGISTRY = `projects:
  - id: alpha
    name: Alpha
    status: active
    priority: high
    folder: Projects/alpha/
    local_path: ~/projects/alpha
    github: https://github.com/user/alpha

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

function patch(body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest("http://localhost/api/projects/alpha", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: "alpha" }) },
  ];
}

describe("bc_projects: linki Repo / Dev / Docs", () => {
  it("dopisuje deploy i docs, github zostaje, reszta rejestru bez zmian", async () => {
    seed();
    const project = await setProjectLinks(
      "alpha",
      { deploy: "localhost:5000", docs: "docs/specs/v2.md" },
      TODAY
    );
    expect(project.github).toBe("https://github.com/user/alpha");
    expect(project.deploy).toBe("localhost:5000");
    expect(project.docs).toBe("docs/specs/v2.md");
    const text = vault.read("Projects/_registry.yaml");
    expect(text).toContain("# komentarz przy becie");
    expect(text).toContain("id: beta");
    expect(readRegistry().entries.find((e) => e.id === "beta")?.deploy).toBeUndefined();
  });

  it("pusty napis usuwa link", async () => {
    seed();
    const project = await setProjectLinks("alpha", { github: "" }, TODAY);
    expect(project.github).toBeUndefined();
    expect(vault.read("Projects/_registry.yaml")).not.toContain("github:");
  });

  it("schemat: github tylko http(s), docs jedna linia, pusty obiekt odrzucony", () => {
    const ok = (links: unknown) => ProjectPatchInputSchema.safeParse({ links }).success;
    expect(
      ok({ github: "https://github.com/u/r", docs: "docs/v2.md", deploy: "localhost:5000" })
    ).toBe(true);
    expect(ok({ github: "javascript:alert(1)" })).toBe(false);
    expect(ok({ docs: "a\nb" })).toBe(false);
    expect(ok({})).toBe(false);
  });

  it("PATCH {links} zwraca szczegóły z nowymi linkami; zły github to 400", async () => {
    seed();
    const res = await detailPATCH(...patch({ links: { docs: "docs/v2.md" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).docs).toBe("docs/v2.md");
    const bad = await detailPATCH(...patch({ links: { github: "ftp://x" } }));
    expect(bad.status).toBe(400);
  });
});
