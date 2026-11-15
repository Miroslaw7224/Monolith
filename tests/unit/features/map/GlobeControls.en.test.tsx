import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { GlobeControls } from "@/src/features/map/GlobeControls";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("GlobeControls po angielsku", () => {
  test("aria-label przycisków zoom", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<GlobeControls zoom={1} onZoomIn={() => {}} onZoomOut={() => {}} onFit={() => {}} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit to window" })).toBeInTheDocument();
  });
});
