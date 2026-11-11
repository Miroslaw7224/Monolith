import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import type { PaletteCommand } from "@/src/features/cards/cards";

beforeEach(() => cleanup());

function cmds(): PaletteCommand[] {
  return [
    { id: "a", label: "Przejdź: Kokpit", hint: "Alt+1", run: vi.fn() },
    { id: "b", label: "Przejdź: Kalendarz", hint: "Alt+2", run: vi.fn() },
    { id: "c", label: "Przejdź: Płótno", hint: "Alt+6", run: vi.fn() },
  ];
}

describe("CommandPalette", () => {
  test("ustawia fokus na polu i zaznacza pierwszą pozycję", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Polecenie")).toHaveFocus();
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  test("filtruje po frazie bez polskich znaków", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Polecenie"), { target: { value: "plotno" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Przejdź: Płótno");
  });

  test("brak wyników pokazuje komunikat", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Polecenie"), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
  });

  test("strzałki i Enter uruchamiają wybraną komendę i zamykają paletę", () => {
    const list = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={list} onClose={onClose} />);
    const input = screen.getByLabelText("Polecenie");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(list[1].run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("klik w pozycję uruchamia komendę", () => {
    const list = cmds();
    render(<CommandPalette commands={list} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Przejdź: Płótno"));
    expect(list[2].run).toHaveBeenCalledTimes(1);
  });

  test("Escape i klik w tło zamykają bez uruchamiania", () => {
    const list = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={list} onClose={onClose} />);
    fireEvent.keyDown(screen.getByLabelText("Polecenie"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("palette-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(list[0].run).not.toHaveBeenCalled();
  });

  test("klik w okno palety nie zamyka", () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={cmds()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog", { name: "Paleta poleceń" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
