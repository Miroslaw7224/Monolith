import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/src/components/theme/ThemeProvider";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";
import { setLanguage } from "@/src/i18n";

describe("ThemeToggle (EN)", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: /prefers-color-scheme:\s*dark/.test(String(query)),
        media: String(query),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(async () => {
    cleanup();
    await act(async () => {
      await setLanguage("pl");
    });
  });

  it("etykieta w EN i powrót do PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(await screen.findByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByRole("button", { name: "Włącz tryb jasny" })).toBeTruthy();
  });
});
