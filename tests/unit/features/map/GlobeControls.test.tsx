import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GlobeControls } from "@/src/features/map/GlobeControls";

afterEach(() => cleanup());

it("przyciski wywołują przybliżenie, oddalenie i dopasowanie; pokazuje procent", async () => {
  const [zin, zout, fit] = [vi.fn(), vi.fn(), vi.fn()];
  const user = userEvent.setup();
  render(<GlobeControls zoom={1.25} onZoomIn={zin} onZoomOut={zout} onFit={fit} />);
  expect(screen.getByText("125%")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Przybliż" }));
  await user.click(screen.getByRole("button", { name: "Oddal" }));
  await user.click(screen.getByRole("button", { name: "Dopasuj do okna" }));
  expect([zin, zout, fit].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
});
