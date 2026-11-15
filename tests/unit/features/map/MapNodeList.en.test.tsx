import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MapNodeList } from "@/src/features/map/MapNodeList";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const clusters = [{ id: "skille", label: "Skille", group: "skills" as const, size: 0, soon: true }];

describe("MapNodeList po angielsku", () => {
  test("skupisko soon pokazuje (soon)", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<MapNodeList clusters={clusters} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Skille (soon)" })).toBeInTheDocument();
  });
});
