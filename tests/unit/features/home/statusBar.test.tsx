import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { StatusBar } from "@/src/features/home/StatusBar";

const NOW = new Date(2026, 10, 16, 14, 5);

beforeEach(() => cleanup());

describe("StatusBar", () => {
  test("PL: projekt, branch, vault zsynchronizowany, podpowiedź skrótów i godzina", () => {
    render(<StatusBar projectId="monolith" branch="main" warningsCount={0} now={NOW} />);
    const bar = screen.getByLabelText("Pasek statusu");
    expect(bar).toHaveTextContent("projekt monolith");
    expect(bar).toHaveTextContent("branch main");
    expect(bar).toHaveTextContent("vault zsynchronizowany");
    expect(bar).toHaveTextContent("Alt+1…9 karty · Alt+I inbox · Ctrl+K polecenia");
    expect(bar).toHaveTextContent("14:05");
  });

  test.each([
    [1, "1 ostrzeżenie"],
    [2, "2 ostrzeżenia"],
    [5, "5 ostrzeżeń"],
    [22, "22 ostrzeżenia"],
  ])("PL: %i ostrzeżeń → %s", (count, text) => {
    render(<StatusBar projectId={null} warningsCount={count} now={NOW} />);
    expect(screen.getByLabelText("Pasek statusu")).toHaveTextContent(text);
  });

  test("EN: etykiety, plural i godzina 24 h", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const { rerender } = render(
      <StatusBar projectId="monolith" branch="main" warningsCount={0} now={NOW} />
    );
    const bar = screen.getByLabelText("Status bar");
    expect(bar).toHaveTextContent("project monolith");
    expect(bar).toHaveTextContent("vault in sync");
    expect(bar).toHaveTextContent("Alt+1…9 cards · Alt+I inbox · Ctrl+K commands");
    expect(bar).toHaveTextContent("14:05");
    rerender(<StatusBar projectId="monolith" branch="main" warningsCount={1} now={NOW} />);
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("1 warning");
    rerender(<StatusBar projectId="monolith" branch="main" warningsCount={3} now={NOW} />);
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("3 warnings");
  });

  test("bez projektu i brancha ukrywa te pozycje", () => {
    render(<StatusBar projectId={null} warningsCount={0} now={NOW} />);
    const bar = screen.getByLabelText("Pasek statusu");
    expect(bar).not.toHaveTextContent("projekt");
    expect(bar).not.toHaveTextContent("branch");
  });
});
