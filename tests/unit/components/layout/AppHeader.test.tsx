import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppHeader } from "@/src/components/layout/AppHeader";

vi.mock("@/src/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

const t = {
  brainActive: "Brain active",
  searchPlaceholder: "Search…",
  feedback: "Feedback",
};

afterEach(() => cleanup());

describe("AppHeader", () => {
  test("lang=pl shows EN button; click calls setLang('en')", () => {
    const setLang = vi.fn();
    render(<AppHeader lang="pl" setLang={setLang} t={t} />);
    const btn = screen.getByRole("button", { name: "Zmień język / Change language" });
    expect(btn).toHaveTextContent("EN");
    fireEvent.click(btn);
    expect(setLang).toHaveBeenCalledWith("en");
  });

  test("lang=en shows PL button; click calls setLang('pl')", () => {
    const setLang = vi.fn();
    render(<AppHeader lang="en" setLang={setLang} t={t} />);
    const btn = screen.getByRole("button", { name: "Zmień język / Change language" });
    expect(btn).toHaveTextContent("PL");
    fireEvent.click(btn);
    expect(setLang).toHaveBeenCalledWith("pl");
  });

  test("does not render sidebar toggle chevron", () => {
    render(<AppHeader lang="pl" setLang={vi.fn()} t={t} />);
    expect(screen.queryByRole("button", { name: /sidebar/i })).toBeNull();
    const header = screen.getByRole("banner");
    expect(header.querySelector("svg.lucide-chevron-right")).toBeNull();
  });
});
