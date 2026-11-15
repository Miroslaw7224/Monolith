import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type {
  DeployInstructionsDto,
  DeployModeDto,
  DeployTargetDto,
  SkillEntryDto,
} from "@/contexts/bc_arsenal/schemas";
import { DeployPanel } from "@/src/features/arsenal/DeployPanel";

afterEach(cleanup);

const skill: SkillEntryDto = {
  kind: "skill",
  id: "skill:tdd",
  path: "Arsenal/Skills/tdd/skill.md",
  name: "test-driven-development",
  slug: "tdd",
  summary: "TDD",
  body: "# TDD",
  deployed: [],
  templates: [],
};

const fetchInstructions = vi.fn(
  async (): Promise<DeployInstructionsDto> => ({ mode: "full" as DeployModeDto, text: "" })
);
const markDeployed = vi.fn(async (): Promise<void> => undefined);

describe("DeployPanel", () => {
  it("dopisuje „(etat)” przy companyData, nie przy zwykłym własnym", () => {
    const targets: DeployTargetDto[] = [
      { id: "own", name: "Własny", localPath: "~/own", owner: "personal", companyData: false },
      {
        id: "etat",
        name: "Etat osobisty",
        localPath: "~/etat",
        owner: "personal",
        companyData: true,
      },
      { id: "firm", name: "Firma", localPath: "~/firm", owner: "work", companyData: true },
    ];
    render(
      <DeployPanel
        skill={skill}
        targets={targets}
        fetchInstructions={fetchInstructions}
        markDeployed={markDeployed}
      />
    );
    const select = screen.getByLabelText("Projekt docelowy");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toContain("Własny");
    expect(options).toContain("Etat osobisty (etat)");
    expect(options).toContain("Firma (etat)");
    expect(options.find((t) => t === "Własny (etat)")).toBeUndefined();
  });
});
