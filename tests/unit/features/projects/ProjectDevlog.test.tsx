import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevlogEntryDto } from "@/contexts/bc_projects/schemas";
import type { MutationResult } from "@/src/features/projects/mutation";
import { ProjectDevlog } from "@/src/features/projects/ProjectDevlog";

afterEach(() => cleanup());

function renderIt(
  entries: DevlogEntryDto[] = [],
  onAdd = vi.fn(async (): Promise<MutationResult> => ({ ok: true }))
) {
  const user = userEvent.setup();
  render(<ProjectDevlog entries={entries} onAdd={onAdd} />);
  return { user, onAdd };
}

describe("ProjectDevlog", () => {
  it("pusta lista", () => {
    renderIt([]);
    expect(screen.getByText("Brak wpisów")).toBeInTheDocument();
  });

  it("wpisy w kolejności z propsów; brak daty jako „—”", () => {
    renderIt([
      { date: "2026-11-13", title: "Drugi", why: "Powód 2" },
      { date: null, title: "Bez daty", why: "" },
    ]);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("2026-11-13")).toBeInTheDocument();
    expect(within(items[0]).getByText("Drugi")).toBeInTheDocument();
    expect(within(items[0]).getByText("Powód 2")).toBeInTheDocument();
    expect(within(items[1]).getByText("—")).toBeInTheDocument();
    expect(within(items[1]).getByText("Bez daty")).toBeInTheDocument();
  });

  it("pusty tytuł lub same spacje: przycisk wyłączony", async () => {
    const { user } = renderIt();
    const add = screen.getByRole("button", { name: "Dodaj wpis" });
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText("Tytuł"), "   ");
    expect(add).toBeDisabled();
  });

  it("dodanie: onAdd raz z tytułem i powodem, po sukcesie pola puste", async () => {
    const { user, onAdd } = renderIt();
    await user.type(screen.getByLabelText("Tytuł"), "T");
    await user.type(screen.getByLabelText("Dlaczego"), "W");
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({ title: "T", why: "W" });
    expect(screen.getByLabelText("Tytuł")).toHaveValue("");
    expect(screen.getByLabelText("Dlaczego")).toHaveValue("");
  });

  it("podwójny klik przy trwającym zapisie: jedno wywołanie", async () => {
    let resolve!: (r: MutationResult) => void;
    const onAdd = vi.fn(() => new Promise<MutationResult>((r) => (resolve = r)));
    const { user } = renderIt([], onAdd);
    await user.type(screen.getByLabelText("Tytuł"), "T");
    const add = screen.getByRole("button", { name: "Dodaj wpis" });
    await user.click(add);
    await user.click(add);
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true }));
  });

  it("błąd: komunikat w role=alert, pola zachowane", async () => {
    const onAdd = vi.fn(
      async (): Promise<MutationResult> => ({ ok: false, error: "zły tytuł", conflict: false })
    );
    const { user } = renderIt([], onAdd);
    await user.type(screen.getByLabelText("Tytuł"), "T");
    await user.type(screen.getByLabelText("Dlaczego"), "W");
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("zły tytuł");
    expect(screen.getByLabelText("Tytuł")).toHaveValue("T");
    expect(screen.getByLabelText("Dlaczego")).toHaveValue("W");
  });
});
