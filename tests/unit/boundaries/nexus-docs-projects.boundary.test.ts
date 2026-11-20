// @vitest-environment node
/**
 * Granica `bc_nexus_docs` → `bc_projects` (ASERCJE-3) bez żadnych atrap: widoczność dokumentów liczona
 * z prawdziwego rejestru w tymczasowym vaulcie (`listProjects` / `isWorkProject`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getDoc, listDocs } from "@/contexts/bc_nexus_docs/services";
import { NotFoundError } from "@/lib/errors";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();

const registry = (alfaPath: string, betaPath: string): string =>
  [
    "projects:",
    "  - id: alfa",
    "    name: Alfa",
    "    status: active",
    "    priority: high",
    "    folder: Projects/alfa/",
    "    owner: personal",
    `    local_path: '${alfaPath}'`,
    "  - id: beta",
    "    name: Beta",
    "    status: active",
    "    priority: medium",
    "    folder: Projects/beta/",
    "    owner: work",
    `    local_path: '${betaPath}'`,
    "",
  ].join("\n");

beforeEach(() => {
  vault.write("Projects/_registry.yaml", registry("/tmp/alfa", "/tmp/beta"));
  vault.write("Projects/alfa/notatka.md", "# Notatka Alfa\n");
  vault.write("Projects/beta/notatka.md", "# Notatka Beta\n");
  vault.write("Knowledge/ogolna.md", "# Ogólna\n");
});

describe("granica nexus_docs ↔ projects", () => {
  it("lista pomija dokumenty projektu etatowego", () => {
    expect(
      listDocs()
        .map((d) => d.path)
        .sort()
    ).toEqual(["Knowledge/ogolna.md", "Projects/alfa/notatka.md"]);
  });

  it("dokument projektu etatowego daje 404 jak dokument nieistniejący", () => {
    expect(getDoc(["Projects", "alfa", "notatka.md"])).toMatchObject({
      path: "Projects/alfa/notatka.md",
      title: "Notatka Alfa",
    });
    for (const segments of [
      ["Projects", "beta", "notatka.md"],
      ["Projects", "alfa", "brak.md"],
    ]) {
      expect(() => getDoc(segments)).toThrow(NotFoundError);
      expect(() => getDoc(segments)).toThrow("Nie znaleziono dokumentu");
    }
  });
});
