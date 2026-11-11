import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardRail } from "@/src/features/cards/CardRail";

beforeEach(() => cleanup());

describe("CardRail", () => {
  test("pokazuje 8 kart w nawigacji", () => {
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Karty" });
    expect(nav.querySelectorAll("[data-card-id]")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /Płótno/ })).toHaveAttribute(
      "title",
      "Płótno (Alt+6)"
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
