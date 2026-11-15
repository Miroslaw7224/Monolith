import React from "react";
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { DeployModeDto, SkillEntryDto } from "@/contexts/bc_arsenal/schemas";
import { DeployPanel } from "@/src/features/arsenal/DeployPanel";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const skill: SkillEntryDto = {
  kind: "skill",
  id: "skill:tdd",
  path: "Arsenal/Skills/tdd/skill.md",
  name: "tdd",
  slug: "tdd",
  summary: "TDD",
  body: "# TDD",
  deployed: [],
  templates: [],
};

const fetchInstructions = vi.fn(async () => ({ mode: "full" as DeployModeDto, text: "" }));
const markDeployed = vi.fn(async () => undefined);

describe("DeployPanel po angielsku", () => {
  test("nagłówek, tryb, oznaczenie wdrożenia i pusty rejestr", async () => {
    await act(async () => {
      await setLanguage("en");
    });

    const { unmount } = render(
      <DeployPanel
        skill={skill}
        targets={[{ id: "p", name: "P", localPath: "~/p", owner: "personal", companyData: false }]}
        fetchInstructions={fetchInstructions}
        markDeployed={markDeployed}
      />
    );
    expect(screen.getByRole("region", { name: "Deploy to project" })).toBeInTheDocument();
    expect(screen.getByText("Deploy to project", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Mode", { selector: "legend" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("button", { name: "Mark as deployed" })).toBeInTheDocument();
    unmount();

    render(
      <DeployPanel
        skill={skill}
        targets={[]}
        fetchInstructions={fetchInstructions}
        markDeployed={markDeployed}
      />
    );
    expect(screen.getByText("No projects in the registry.")).toBeInTheDocument();
  });

  test("opcja projektu z danymi firmowymi: „(day job)” w EN, „(etat)” w PL", async () => {
    const targets = [
      { id: "w", name: "Firma", localPath: "~/w", owner: "work" as const, companyData: true },
    ];
    await act(async () => {
      await setLanguage("en");
    });
    render(
      <DeployPanel
        skill={skill}
        targets={targets}
        fetchInstructions={fetchInstructions}
        markDeployed={markDeployed}
      />
    );
    expect(screen.getByRole("option", { name: "Firma (day job)" })).toBeInTheDocument();
    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByRole("option", { name: "Firma (etat)" })).toBeInTheDocument();
  });
});
