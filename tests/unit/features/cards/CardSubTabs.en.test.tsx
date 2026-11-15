import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CardSubTabs } from "@/src/features/cards/CardSubTabs";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("CardSubTabs (EN)", () => {
  test("etykieta listy zakładek w EN i powrót do PL", async () => {
    const tabs = [
      { id: "board" as const, label: "Board" },
      { id: "mindmaps" as const, label: "Mind maps" },
    ];
    await act(async () => {
      await setLanguage("en");
    });
    render(<CardSubTabs tabs={tabs} active="board" onSelect={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "Card views" })).toBeInTheDocument();
    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByRole("tablist", { name: "Widoki karty" })).toBeInTheDocument();
  });
});
