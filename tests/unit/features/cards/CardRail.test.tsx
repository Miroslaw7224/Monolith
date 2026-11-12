import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardRail } from "@/src/features/cards/CardRail";

beforeEach(() => cleanup());

describe("CardRail", () => {
  test("pokazuje 9 kart w nawigacji, Kodeks ostatni", () => {
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Karty" });
    const items = nav.querySelectorAll("[data-card-id]");
    expect(items).toHaveLength(9);
    expect(items[items.length - 1]).toHaveAttribute("data-card-id", "kodeks");
    expect(screen.getByRole("button", { name: /Płótno/ })).toHaveAttribute(
      "title",
      "Płótno (Alt+6)"
    );
    expect(screen.getByRole("button", { name: /Kodeks/ })).toHaveAttribute(
      "title",
      "Kodeks (Alt+9)"
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
    fireEvent.click(screen.getByRole("button", { name: /Mapa/ }));
    expect(onSelect).toHaveBeenCalledWith("mapa");
  });

  test("przycisk palety otwiera paletę", () => {
    const onOpenPalette = vi.fn();
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={onOpenPalette} />);
    fireEvent.click(screen.getByRole("button", { name: "Paleta poleceń (Ctrl+K)" }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
});
