import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { CardRail } from "@/src/features/cards/CardRail";
import { setLanguage } from "@/src/i18n";

beforeEach(() => cleanup());

describe("CardRail", () => {
  test("pokazuje 10 kart w nawigacji, Diagnostyka ostatnia", () => {
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Karty" });
    const items = nav.querySelectorAll("[data-card-id]");
    expect(items).toHaveLength(10);
    expect(items[items.length - 1]).toHaveAttribute("data-card-id", "diagnostyka");
    expect(screen.getByRole("button", { name: /Płótno/ })).toHaveAttribute(
      "title",
      "Płótno (Alt+6)"
    );
    expect(screen.getByRole("button", { name: /Kodeks/ })).toHaveAttribute(
      "title",
      "Kodeks (Alt+9)"
    );
    expect(screen.getByRole("button", { name: /Diagnostyka/ })).toHaveAttribute(
      "title",
      "Diagnostyka (Alt+0)"
    );
  });

  test("oznacza aktywną kartę", () => {
    render(<CardRail activeCard="zadania" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Zadania/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Kokpit/ })).not.toHaveAttribute("aria-current");
  });

  test("klik wybiera kartę", () => {
    const onSelect = vi.fn();
    render(<CardRail activeCard="kokpit" onSelect={onSelect} onOpenPalette={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /NEXUS/ }));
    expect(onSelect).toHaveBeenCalledWith("mapa");
  });

  test("przycisk palety otwiera paletę", () => {
    const onOpenPalette = vi.fn();
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={onOpenPalette} />);
    fireEvent.click(screen.getByRole("button", { name: "Paleta poleceń (Ctrl+K)" }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  test("po angielsku: aria-label „Cards” i angielskie etykiety kart", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    expect(screen.getByRole("navigation", { name: "Cards" })).toBeInTheDocument();
    const labels = [...document.querySelectorAll(".card-rail__label")].map((n) => n.textContent);
    expect(labels).toEqual([
      "Cockpit",
      "Calendar",
      "Tasks",
      "Projects",
      "Notes",
      "Canvas",
      "Arsenal",
      "NEXUS",
      "Codex",
      "Diagnostics",
    ]);
    expect(screen.getByRole("button", { name: /Canvas/ })).toHaveAttribute(
      "title",
      "Canvas (Alt+6)"
    );
    expect(screen.getByRole("button", { name: "Command palette (Ctrl+K)" })).toBeInTheDocument();
  });

  test("przycisk PL/EN przełącza język i zapisuje wybór", async () => {
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Zmień język na angielski (EN)" }));
    expect(await screen.findByRole("navigation", { name: "Cards" })).toBeInTheDocument();
    expect(window.localStorage.getItem("monolith.lang")).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "Switch language to Polish (PL)" }));
    expect(await screen.findByRole("navigation", { name: "Karty" })).toBeInTheDocument();
  });
});
