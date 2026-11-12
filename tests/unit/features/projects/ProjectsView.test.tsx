import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { ProjectsView } from "@/src/features/projects/ProjectsView";

afterEach(() => cleanup());

function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  return {
    name: partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner: "personal",
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
    bugs: [],
    whereIStopped: null,
    ...partial,
  };
}

function listResponse(projects: ProjectSummaryDto[], warnings: string[] = []): Response {
  return new Response(JSON.stringify({ projects, warnings }), { status: 200 });
}

function makeApiFetch(
  projects: ProjectSummaryDto[],
  details: Record<string, ProjectDetailDto | Response>,
  warnings: string[] = []
) {
  return vi.fn(async (url: string) => {
    if (url === "/api/projects") return listResponse(projects, warnings);
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

describe("ProjectsView", () => {
  it("ładowanie", () => {
    const apiFetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<ProjectsView apiFetch={apiFetch} />);
    expect(screen.getByText("Ładowanie…")).toBeInTheDocument();
  });

  it("pusto", async () => {
    const apiFetch = makeApiFetch([], {});
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Brak projektów w rejestrze")).toBeInTheDocument();
    });
  });

  it("ostrzeżenia", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a" }) }, ["b: boom"]);
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("b: boom");
    });
  });

  it("stale i done", async () => {
    const a = summary({ id: "a", freshness: "stale" });
    const c = summary({ id: "c", status: "done" });
    const apiFetch = makeApiFetch([a, c], {
      a: detail({ id: "a", freshness: "stale" }),
      c: detail({ id: "c", status: "done" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(itemButton("a")).toHaveClass("prj-item--stale");
    });
    const items = screen.getAllByRole("listitem");
    expect(items.at(-1)).toHaveTextContent("c");
    expect(within(items.at(-1)!).getByRole("button")).toHaveClass("prj-item--done");
  });

  it("bugi", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], {
      a: detail({
        id: "a",
        bugs: [
          { id: "GP-001", title: "porty", section: "Aktywne", priority: "high", status: "open" },
          { id: "EA-001", title: "stary", section: "Zamknięte" },
        ],
      }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("GP-001")).toBeInTheDocument();
    });
    expect(screen.queryByText("EA-001")).not.toBeInTheDocument();
    expect(screen.getByText("Zamknięte: 1")).toBeInTheDocument();
  });

  it("linki tylko http(s): inny protokół jako zwykły tekst", async () => {
    const a = summary({ id: "a", github: "javascript:alert(1)", deploy: "https://example.com" });
    const apiFetch = makeApiFetch([a], {
      a: detail({ id: "a", github: "javascript:alert(1)", deploy: "https://example.com" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    const deploy = await screen.findByRole("link", { name: "deploy" });
    expect(deploy).toHaveAttribute("href", "https://example.com");
    expect(screen.queryByRole("link", { name: /github/ })).not.toBeInTheDocument();
    expect(screen.getByText(/github: javascript:alert\(1\)/)).toBeInTheDocument();
  });

  it("same zamknięte bugi: licznik bez pustej listy", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], {
      a: detail({ id: "a", bugs: [{ id: "EA-001", title: "stary", section: "Zamknięte" }] }),
    });
    const { container } = render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Zamknięte: 1")).toBeInTheDocument();
    });
    expect(container.querySelector("ul.prj-bugs")).toBeNull();
  });

  it("brak bugów", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a", bugs: [] }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Brak bugów")).toBeInTheDocument();
    });
  });

  it("Gdzie skończyłem", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a", whereIStopped: "Koniec X." }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Koniec X.")).toBeInTheDocument();
    });
  });

  it("wybrany element", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    const apiFetch = makeApiFetch([a, b], { a: detail({ id: "a" }), b: detail({ id: "b" }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(itemButton("a")).toHaveClass("prj-item--sel");
    });
  });
});

function itemButton(id: string): HTMLElement {
  const name = screen.getByText(id, { selector: ".prj-item__name" });
  const button = name.closest("button");
  if (!button) throw new Error(`brak przycisku dla ${id}`);
  return button;
}
