import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto } from "@/contexts/bc_projects/schemas";
import { ProjectLinks } from "@/src/features/projects/ProjectLinks";

afterEach(cleanup);

function project(partial: Partial<ProjectDetailDto> = {}): ProjectDetailDto {
  return {
    id: "a",
    name: "Alpha",
    status: "active",
    priority: "high",
    localPath: "~/projects/alpha",
    owner: "personal",
    freshness: "fresh",
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs: [],
    whereIStopped: null,
    state: null,
    stateVersion: null,
    devlog: [],
    ...partial,
  };
}

describe("ProjectLinks", () => {
  it("pokazuje Repo / Dev / Docs jak w makiecie; tylko http(s) jest linkiem", () => {
    render(
      <ProjectLinks
        project={project({
          github: "https://github.com/user/gen-podsum-ai",
          deploy: "localhost:5000",
          docs: "docs/specs/v2.md",
        })}
        onSave={vi.fn()}
      />
    );
    const repo = screen.getByText("Repo: github.com/user/gen-podsum-ai");
    expect(repo).toHaveAttribute("href", "https://github.com/user/gen-podsum-ai");
    expect(screen.getByText("Dev: localhost:5000").tagName).toBe("SPAN");
    expect(screen.getByText("Docs: docs/specs/v2.md").tagName).toBe("SPAN");
  });

  it("puste miejsca to przyciski „+ Repo”, „+ Dev”, „+ Docs”", () => {
    render(<ProjectLinks project={project()} onSave={vi.fn()} />);
    for (const label of ["Repo", "Dev", "Docs"]) {
      expect(screen.getByRole("button", { name: `Dodaj link: ${label}` })).toBeInTheDocument();
    }
  });

  it("edycja: zapis wysyła trzy pola, a pusty napis usuwa link", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ProjectLinks project={project({ github: "https://github.com/u/r" })} onSave={onSave} />
    );
    await user.click(screen.getByRole("button", { name: "Edytuj linki" }));
    await user.clear(screen.getByLabelText("Repo"));
    await user.type(screen.getByLabelText("Docs"), "docs/v2.md");
    await user.click(screen.getByRole("button", { name: "Zapisz linki" }));
    expect(onSave).toHaveBeenCalledWith({ github: "", deploy: "", docs: "docs/v2.md" });
    await waitFor(() => expect(screen.queryByLabelText("Repo")).not.toBeInTheDocument());
  });

  it("błąd zapisu zostaje w formularzu jako role=alert", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: "Zły link", conflict: false });
    render(<ProjectLinks project={project()} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Dodaj link: Repo" }));
    await user.type(screen.getByLabelText("Repo"), "ftp://x");
    await user.click(screen.getByRole("button", { name: "Zapisz linki" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zły link");
    expect(screen.getByLabelText("Repo")).toBeInTheDocument();
  });
});
