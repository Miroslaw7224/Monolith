import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto } from "@/contexts/bc_projects/schemas";
import type { MutationResult } from "@/src/features/projects/mutation";
import { ProjectSaveState } from "@/src/features/projects/ProjectSaveState";

afterEach(() => cleanup());

function project(partial: Partial<ProjectDetailDto> = {}): ProjectDetailDto {
  return {
    id: "a",
    name: "A",
    status: "active",
    priority: "P2",
    localPath: "/tmp/a",
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

const STATE = {
  branch: "main",
  env: "local",
  blocker: "",
  nextStep: "",
  links: ["https://a", "javascript:x"],
  milestone: "",
  updated: "2026-11-13T09:15",
};

function renderIt(
  p: ProjectDetailDto,
  onSave = vi.fn(async (): Promise<MutationResult> => ({ ok: true })),
  onReload = vi.fn()
) {
  const user = userEvent.setup();
  render(<ProjectSaveState project={p} onSave={onSave} onReload={onReload} />);
  return { user, onSave, onReload };
}

describe("ProjectSaveState", () => {
  it("bez state: akapit „Gdzie skończyłem” i przycisk utworzenia", () => {
    renderIt(project({ whereIStopped: "tu skończyłem" }));
    expect(screen.getByText("tu skończyłem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utwórz Save State" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edytuj" })).toBeNull();
  });

  it("ze state: kafle; link http(s) jest <a>, javascript: tekstem", () => {
    renderIt(project({ state: STATE, stateVersion: "5:h" }));
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://a" })).toHaveAttribute("href", "https://a");
    expect(screen.getByText("javascript:x")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "javascript:x" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edytuj" })).toBeInTheDocument();
  });

  it("zapis: onSave raz z przyciętymi liniami linków i wersją pliku", async () => {
    const { user, onSave } = renderIt(project({ state: STATE, stateVersion: "5:h" }));
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    const branch = screen.getByLabelText("Branch");
    await user.clear(branch);
    await user.type(branch, "feat/x");
    const links = screen.getByLabelText("Linki (jeden na linię)");
    await user.clear(links);
    await user.type(links, "https://a{enter}{enter} https://b ");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      branch: "feat/x",
      env: "local",
      blocker: "",
      nextStep: "",
      links: ["https://a", "https://b"],
      milestone: "",
      milestoneDue: "",
      version: "5:h",
    });
  });

  it("tworzenie: version null", async () => {
    const { user, onSave } = renderIt(project());
    await user.click(screen.getByRole("button", { name: "Utwórz Save State" }));
    await user.type(screen.getByLabelText("Branch"), "main");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ branch: "main", version: null }));
  });

  it("podwójny klik przy trwającym zapisie: jedno wywołanie, przycisk wyłączony", async () => {
    let resolve!: (r: MutationResult) => void;
    const onSave = vi.fn(() => new Promise<MutationResult>((r) => (resolve = r)));
    const { user } = renderIt(project(), onSave);
    await user.click(screen.getByRole("button", { name: "Utwórz Save State" }));
    const save = screen.getByRole("button", { name: "Zapisz" });
    await user.click(save);
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    await act(async () => resolve({ ok: true }));
    expect(screen.queryByLabelText("Branch")).toBeNull();
  });

  it("błąd: komunikat w role=alert, formularz otwarty ze szkicem", async () => {
    const onSave = vi.fn(
      async (): Promise<MutationResult> => ({ ok: false, error: "Brak NEXUS", conflict: false })
    );
    const { user } = renderIt(project(), onSave);
    await user.click(screen.getByRole("button", { name: "Utwórz Save State" }));
    await user.type(screen.getByLabelText("Branch"), "main");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak NEXUS");
    expect(screen.getByLabelText("Branch")).toHaveValue("main");
  });

  it("konflikt 409: komunikat i przycisk wczytania aktualnej wersji", async () => {
    const onSave = vi.fn(
      async (): Promise<MutationResult> => ({ ok: false, error: "x", conflict: true })
    );
    const { user, onReload } = renderIt(
      project({ state: { ...STATE, links: ["https://a"] }, stateVersion: "5:h" }),
      onSave
    );
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText(/state\.md zmienił się poza aplikacją/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wczytaj aktualną wersję" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Branch")).toBeNull();
  });

  it("link bez http(s): czytelny komunikat, bez wywołania onSave", async () => {
    const { user, onSave } = renderIt(project());
    await user.click(screen.getByRole("button", { name: "Utwórz Save State" }));
    await user.type(screen.getByLabelText("Linki (jeden na linię)"), "github.com/x");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Linki muszą zaczynać się od http:// lub https://"
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Linki (jeden na linię)")).toHaveValue("github.com/x");
  });

  it("Anuluj zamyka formularz bez zapisu", async () => {
    const { user, onSave } = renderIt(project());
    await user.click(screen.getByRole("button", { name: "Utwórz Save State" }));
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByLabelText("Branch")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
});
