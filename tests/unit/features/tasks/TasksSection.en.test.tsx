import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TasksSection } from "@/src/features/tasks/TasksSection";
import { dueLabel } from "@/src/features/tasks/TaskTiles";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const apiFetch = vi.fn();

describe("TasksSection po angielsku", () => {
  test("nagłówek EN / PL", async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === "/api/tasks") return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    });
    await act(async () => {
      await setLanguage("en");
    });
    render(<TasksSection apiFetch={apiFetch} />);
    expect(screen.getByText("Project Tasks")).toBeInTheDocument();
    expect(screen.getByText("Alt+3 · Tasks")).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByText("Zadania projektowe")).toBeInTheDocument();
    expect(screen.getByText("Alt+3 · Zadania")).toBeInTheDocument();
  });
});

describe("dueLabel", () => {
  const now = new Date(2026, 10, 15);

  test("dziś / today", () => {
    expect(dueLabel("2026-11-15", now, "en")).toBe("today");
    expect(dueLabel("2026-11-15", now, "pl")).toBe("dziś");
  });
});
