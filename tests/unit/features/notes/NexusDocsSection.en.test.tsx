import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusDocsSection } from "@/src/features/notes/NexusDocsSection";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("NexusDocsSection po angielsku", () => {
  it("nagłówek i pusta baza", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const { container, getByLabelText } = render(
      <NexusDocsSection docs={[]} error={null} selectedPath={null} onSelect={vi.fn()} />
    );
    expect(getByLabelText("NEXUS knowledge base")).toBeTruthy();
    expect(container.querySelector(".not-nexus .not-sidebar__title")?.textContent).toContain(
      "read-only"
    );
    expect(container.textContent).toContain("No NEXUS documents");
  });
});
