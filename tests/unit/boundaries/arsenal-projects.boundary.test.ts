// @vitest-environment node
/**
 * Granica `bc_arsenal` → `bc_projects` (ASERCJE-3) bez żadnych atrap: cele wdrożenia, `owner` i `type`
 * przychodzą z prawdziwego rejestru i `index.md` w tymczasowym vaulcie (`listProjects` / `hasCompanyData`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getDeployInstructions, listArsenal } from "@/contexts/bc_arsenal/services";
import { WORK_TARGET_NOTE } from "@/contexts/bc_arsenal/models";
import { boundaryRegistry, REGISTRY_PATH } from "../helpers/boundaryRegistry";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();

/** Trzeci projekt: własny w rejestrze, ale `type: etat` w `index.md`. */
const GAMMA = [
  "  - id: gamma",
  "    name: Gamma",
  "    status: active",
  "    priority: low",
  "    folder: Projects/gamma/",
  "    owner: personal",
  "    local_path: '/tmp/gamma'",
  "",
].join("\n");

beforeEach(() => {
  vault.write(REGISTRY_PATH, boundaryRegistry("/tmp/alfa", "/tmp/beta") + GAMMA);
  vault.write("Projects/gamma/index.md", "---\ntype: etat\n---\n# Gamma\n");
  vault.write(
    "Arsenal/Skills/lint-fix/skill.md",
    "---\ntype: skill-doc\nname: Lint fix\nslug: lint-fix\n---\nNapraw lint.\n"
  );
});

describe("granica arsenal ↔ projects", () => {
  it("instrukcja wdrożenia do projektu etatowego ma ostrzeżenie, do własnego nie", () => {
    expect(getDeployInstructions("lint-fix", "beta", "full")).toEqual({
      mode: "full",
      text: "scripts/deploy-skill.sh lint-fix '/tmp/beta'",
      note: WORK_TARGET_NOTE,
    });
    expect(getDeployInstructions("lint-fix", "alfa", "full")).toEqual({
      mode: "full",
      text: "scripts/deploy-skill.sh lint-fix '/tmp/alfa'",
    });
  });

  it("companyData z owner (rejestr) i type (index.md)", () => {
    expect(
      listArsenal()
        .targets.map((t) => [t.id, t.owner, t.companyData])
        .sort()
    ).toEqual([
      ["alfa", "personal", false],
      ["beta", "work", true],
      ["gamma", "personal", true],
    ]);
  });
});
