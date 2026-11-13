import React from "react";
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardSubTabs } from "@/src/features/cards/CardSubTabs";

afterEach(() => {
  cleanup();
});

describe("CardSubTabs", () => {
  const tabs = [
    { id: "board" as const, label: "Tablica" },
    { id: "mindmaps" as const, label: "Mapy myśli" },
  ];

  test("render dwóch zakładek", () => {
    render(<CardSubTabs tabs={tabs} active="board" onSelect={vi.fn()} />);
    const tablist = screen.getByRole("tablist", { name: "Widoki karty" });
    expect(tablist).toBeInTheDocument();
    const renderedTabs = screen.getAllByRole("tab");
    expect(renderedTabs).toHaveLength(2);
    expect(renderedTabs[0]).toHaveTextContent("Tablica");
    expect(renderedTabs[1]).toHaveTextContent("Mapy myśli");
  });

  test("aria-selected jest poprawnie ustawione dla aktywnej i nieaktywnej zakładki", () => {
    render(<CardSubTabs tabs={tabs} active="board" onSelect={vi.fn()} />);
    const boardTab = screen.getByRole("tab", { name: "Tablica" });
    const mindmapsTab = screen.getByRole("tab", { name: "Mapy myśli" });

    expect(boardTab).toHaveAttribute("aria-selected", "true");
    expect(boardTab).toHaveClass("card-subtabs__tab--active");
    expect(boardTab).toHaveAttribute("tabindex", "0");

    expect(mindmapsTab).toHaveAttribute("aria-selected", "false");
    expect(mindmapsTab).not.toHaveClass("card-subtabs__tab--active");
    expect(mindmapsTab).toHaveAttribute("tabindex", "-1");
  });

  test("klik wywołuje onSelect", () => {
    const onSelect = vi.fn();
    render(<CardSubTabs tabs={tabs} active="board" onSelect={onSelect} />);
    const mindmapsTab = screen.getByRole("tab", { name: "Mapy myśli" });
    fireEvent.click(mindmapsTab);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("mindmaps");
  });

  test("strzałka prawa przesuwa zaznaczenie", () => {
    const onSelect = vi.fn();
    render(<CardSubTabs tabs={tabs} active="board" onSelect={onSelect} />);
    const boardTab = screen.getByRole("tab", { name: "Tablica" });
    const mindmapsTab = screen.getByRole("tab", { name: "Mapy myśli" });

    boardTab.focus();
    expect(document.activeElement).toBe(boardTab);

    fireEvent.keyDown(boardTab, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledWith("mindmaps");
    expect(document.activeElement).toBe(mindmapsTab);
  });

  test("strzałka lewa, Home i End nawigują po zakładkach", () => {
    const onSelect = vi.fn();
    render(<CardSubTabs tabs={tabs} active="mindmaps" onSelect={onSelect} />);
    const boardTab = screen.getByRole("tab", { name: "Tablica" });
    const mindmapsTab = screen.getByRole("tab", { name: "Mapy myśli" });

    mindmapsTab.focus();
    fireEvent.keyDown(mindmapsTab, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith("board");
    expect(document.activeElement).toBe(boardTab);

    fireEvent.keyDown(boardTab, { key: "End" });
    expect(onSelect).toHaveBeenCalledWith("mindmaps");
    expect(document.activeElement).toBe(mindmapsTab);

    fireEvent.keyDown(mindmapsTab, { key: "Home" });
    expect(onSelect).toHaveBeenCalledWith("board");
    expect(document.activeElement).toBe(boardTab);
  });

  test("null przy 1 zakładce", () => {
    const { container: c1 } = render(
      <CardSubTabs tabs={[{ id: "board", label: "Tablica" }]} active="board" onSelect={vi.fn()} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c0 } = render(<CardSubTabs tabs={[]} active="board" onSelect={vi.fn()} />);
    expect(c0.firstChild).toBeNull();
  });
});
