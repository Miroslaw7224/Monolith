import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { ProjectsView } from "@/src/features/projects/ProjectsView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  const owner = partial.owner ?? "personal";
  return {
    name: partial.name ?? partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner,
    kind: partial.type ?? (owner === "work" ? "etat" : "wlasny"),
    companyData: owner === "work" || partial.type === "etat",
    freshness: "fresh",
    ...partial,
  };
}

function detail(
  partial: Partial<ProjectDetailDto> & Pick<ProjectDetailDto, "id">
): ProjectDetailDto {
  return {
    ...summary(partial),
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs: [],
    whereIStopped: null,
    purpose: null,
    state: null,
    stateVersion: null,
    devlog: [],
    ...partial,
  };
}

function listResponse(projects: ProjectSummaryDto[], warnings: string[] = []): Response {
  return new Response(JSON.stringify({ projects, warnings }), { status: 200 });
}

function makeApiFetch(
  projects: ProjectSummaryDto[],
  details: Record<string, ProjectDetailDto | Response> = {},
  warnings: string[] = []
) {
  const pack = {
    markdown: "# P",
    approxTokens: 3850,
    truncated: false,
    warnings: [] as string[],
  };
  return vi.fn(async (url: string) => {
    if (url === "/api/projects") return listResponse(projects, warnings);
    if (url.endsWith("/context-pack")) return new Response(JSON.stringify(pack), { status: 200 });
    const prefix = "/api/projects/";
    if (url.startsWith(prefix)) {
      const id = decodeURIComponent(url.slice(prefix.length));
      const value = details[id];
      if (value instanceof Response) return value;
      if (value) return new Response(JSON.stringify(value), { status: 200 });
      return new Response(JSON.stringify({ error: `Nie ma projektu o id ${id}` }), {
        status: 404,
      });
    }
    return new Response("{}", { status: 404 });
  });
}

const twoProjects: ProjectSummaryDto[] = [
  summary({ id: "a", name: "Alpha" }),
  summary({ id: "b", name: "Beta" }),
];

describe("ProjectsView po angielsku", () => {
  test("nagłówek i licznik rejestru po EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Engineering project dossier"
    );
    expect(screen.getByText("2 projects in registry")).toBeInTheDocument();
    expect(screen.queryByText("Teczka inżynierska projektów")).toBeNull();
  });

  test("przycisk nowego projektu i placeholder wyszukiwania", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    expect(await screen.findByRole("button", { name: "+ New project" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search project registry…")).toBeInTheDocument();
  });

  test("karta celu projektu po angielsku ma tytuł „Why this exists”", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const a = summary({ id: "a", name: "Alpha" });
    const apiFetch = makeApiFetch([a], {
      a: detail({ id: "a", name: "Alpha", purpose: "Application purpose text." }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);

    expect(await screen.findByText("Why this exists")).toBeInTheDocument();
    expect(screen.getByText("Application purpose text.")).toBeInTheDocument();
    expect(screen.queryByText("Po co i dlaczego")).toBeNull();
  });

  test("przełączenie na PL bez remountu: nagłówek i 2 projekty", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Engineering project dossier");
    expect(screen.getByText("2 projects in registry")).toBeInTheDocument();
    expect(screen.getByText("Active projects")).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });

    expect(heading).toHaveTextContent("Teczka inżynierska projektów");
    expect(screen.getByText("2 projekty w rejestrze")).toBeInTheDocument();
    expect(screen.getByText("Aktywne projekty")).toBeInTheDocument();
    expect(screen.queryByText("Active projects")).toBeNull();

    await act(async () => {
      await setLanguage("en");
    });

    expect(screen.getByText("Active projects")).toBeInTheDocument();
    expect(screen.queryByText("Aktywne projekty")).toBeNull();
  });
});
