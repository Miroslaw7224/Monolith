import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MapBlockersPanel } from "@/src/features/map/MapBlockersPanel";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("MapBlockersPanel po angielsku", () => {
  test("nagłówek i chip soon", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<MapBlockersPanel />);
    expect(screen.getByRole("heading", { name: "Blocker radar" })).toBeInTheDocument();
    expect(screen.getByText("soon")).toBeInTheDocument();
  });
});
