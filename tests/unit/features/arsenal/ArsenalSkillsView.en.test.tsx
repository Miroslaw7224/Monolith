import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ArsenalSkillsView } from "@/src/features/arsenal/ArsenalSkillsView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const catalog = {
  entries: [
    {
      kind: "skill" as const,
      id: "skill:tdd",
      path: "Arsenal/Skills/tdd/skill.md",
      name: "test-driven-development",
      slug: "tdd",
      summary: "Najpierw test",
      body: "# TDD",
      deployed: [],
      templates: [],
    },
  ],
  targets: [
    {
      id: "p",
      name: "Projekt P",
      localPath: "~/p",
      owner: "personal" as const,
      companyData: false,
    },
  ],
  skipped: 0,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe("ArsenalSkillsView po angielsku", () => {
  test("kafelki, licznik i kopia po EN; po powrocie na PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = async () => json(catalog);
    render(<ArsenalSkillsView apiFetch={apiFetch} />);
    await screen.findByRole("button", { name: /test-driven-development/ });

    const tiles = within(screen.getByRole("region", { name: "Arsenal statistics" }));
    expect(tiles.getByText("Skills")).toBeInTheDocument();
    expect(tiles.getByText("Prompts")).toBeInTheDocument();
    expect(tiles.getByText("Not deployed anywhere")).toBeInTheDocument();
    expect(screen.getByText("1 entry")).toBeInTheDocument();
    const card = screen.getByRole("article");
    expect(within(card).getByRole("button", { name: "Copy invocation" })).toHaveTextContent("Copy");

    await act(async () => {
      await setLanguage("pl");
    });

    const tilesPl = within(screen.getByRole("region", { name: "Statystyki arsenału" }));
    expect(tilesPl.getByText("Skille")).toBeInTheDocument();
    expect(tilesPl.getByText("Prompty")).toBeInTheDocument();
    expect(tilesPl.getByText("Niewdrożone nigdzie")).toBeInTheDocument();
    expect(screen.getByText("1 wpis")).toBeInTheDocument();
  });
});
