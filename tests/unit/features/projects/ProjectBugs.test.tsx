import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { BugEntryDto } from "@/contexts/bc_projects/schemas";
import { ProjectBugs } from "@/src/features/projects/ProjectBugs";

afterEach(() => cleanup());

const open = (o: Partial<BugEntryDto> = {}): BugEntryDto => ({
  id: "GP-001",
  title: "Porty",
  section: "Aktywne",
  ...o,
});
const closed = (o: Partial<BugEntryDto> = {}): BugEntryDto => ({
  id: "EA-001",
  title: "Stary",
  section: "Zamknięte",
  ...o,
});

describe("ProjectBugs", () => {
  it("brak bugów", () => {
    render(<ProjectBugs bugs={[]} />);
    expect(screen.getByText("Brak bugów")).toBeInTheDocument();
  });

  it("wiek: zwykły znaczek, a przy stale ostrzegawczy; bez Otwarto brak znaczka", () => {
    render(
      <ProjectBugs
        bugs={[
          open({ id: "A-1", ageDays: 3 }),
          open({ id: "A-2", ageDays: 23, stale: true }),
          open({ id: "A-3" }),
        ]}
      />
    );
    expect(screen.getByText("otwarty 3 d")).not.toHaveClass("prj-badge--warn");
    expect(screen.getByText("otwarty 23 d")).toHaveClass("prj-badge--warn");
    expect(screen.getAllByText(/^otwarty \d+ d$/)).toHaveLength(2);
  });

  it("szczegóły ukryte do kliknięcia", async () => {
    const user = userEvent.setup();
    render(
      <ProjectBugs
        bugs={[open({ file: "start_v2.bat", description: "Opis buga", fix: "Popraw echo" })]}
      />
    );
    expect(screen.queryByText("Opis buga")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Szczegóły GP-001" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("start_v2.bat")).toBeInTheDocument();
    expect(screen.getByText("Opis buga")).toBeInTheDocument();
    expect(screen.getByText("Popraw echo")).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText("Opis buga")).not.toBeInTheDocument();
  });

  it("bug bez pól szczegółowych nie ma przycisku", () => {
    render(<ProjectBugs bugs={[open()]} />);
    expect(screen.queryByRole("button", { name: /Szczegóły/ })).not.toBeInTheDocument();
  });

  it("znaczniki zgodności bugu z zadaniem", () => {
    render(
      <ProjectBugs
        bugs={[
          open({ id: "A-1", task: { column: "now", done: false } }),
          open({ id: "A-2", task: { column: "next", done: true } }),
          closed({ id: "Z-1", task: { column: "next", done: false } }),
          closed({ id: "Z-2", task: { column: "next", done: true } }),
        ]}
      />
    );
    expect(screen.getByText("w zadaniach: Teraz")).toBeInTheDocument();
    expect(screen.getByText("zadanie zrobione, bug nadal otwarty")).toBeInTheDocument();
    expect(screen.queryByText("bug zamknięty, zadanie nadal otwarte")).not.toBeInTheDocument();
  });

  it("zamknięte pod przełącznikiem: tytuł, data zamknięcia, rozwiązanie, znacznik zgodności", async () => {
    const user = userEvent.setup();
    render(
      <ProjectBugs
        bugs={[
          closed({
            resolution: "Vercel Cron",
            closedOn: "2026-05-19",
            task: { column: "next", done: false },
          }),
        ]}
      />
    );
    expect(screen.queryByText("EA-001")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Zamknięte: 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText("EA-001")).toBeInTheDocument();
    expect(screen.getByText("zamknięto 2026-05-19")).toBeInTheDocument();
    expect(screen.getByText("bug zamknięty, zadanie nadal otwarte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Szczegóły EA-001" }));
    expect(screen.getByText("Vercel Cron")).toBeInTheDocument();
  });
});
