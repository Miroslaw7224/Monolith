import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodexView } from "@/src/features/codex/CodexView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const EMPTY = { runs: [], eventCount: 0, skippedLines: 0, unterminatedTail: false };

const codexBody = () => ({
  status: "ok",
  path: "Knowledge/kodeks.md",
  mtimeMs: Date.UTC(2026, 10, 11, 7, 30, 14),
  title: "Kodeks pracy nad kodem",
  sections: [
    {
      id: "sec-tdd",
      title: "1. Zasady TDD",
      blocks: [
        { kind: "rule", ruleId: "TDD-1" },
        { kind: "rule", ruleId: "TDD-2" },
      ],
    },
  ],
  rules: [
    { id: "TDD-1", level: "MUST", text: "**Brak kodu** bez czerwonego testu", line: 6 },
    { id: "TDD-2", level: "SHOULD", text: "Pętla Red-Green-Refactor", line: 7 },
  ],
  checklists: [
    {
      id: "definition-of-done",
      title: "Definition of Done",
      items: [{ id: "definition-of-done-1", text: "[TDD-1] Czerwony test", ruleRefs: ["TDD-1"] }],
    },
  ],
  warnings: [],
  wikilinks: [],
  counts: { must: 1, should: 1 },
});

const stateBody = () => ({ month: "2026-11", personal: EMPTY, work: EMPTY });

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CodexView po angielsku", () => {
  it("kafle, nagłówek, wyszukiwarka i licznik reguł w sekcji", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/nexus/codex") return json(codexBody());
      return json(stateBody());
    });
    render(<CodexView apiFetch={apiFetch} />);
    await screen.findByText("Codex rules");

    expect(screen.getByText("Codex rules")).toBeInTheDocument();
    expect(screen.getByText("Event log")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh mtime" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search rules" });
    expect(search).toHaveAttribute("placeholder", expect.stringMatching(/Search rules by ID/i));

    const section = screen
      .getByRole("heading", { level: 2, name: "1. Zasady TDD" })
      .closest("article") as HTMLElement;
    expect(within(section).getByText("2 rules")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "MUST (1)" }));
    expect(within(section).getByText("1 rule")).toBeInTheDocument();
  });
});
