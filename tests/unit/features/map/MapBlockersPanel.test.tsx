import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MapBlockersPanel } from "@/src/features/map/MapBlockersPanel";

afterEach(() => cleanup());

it("radar blokad to stan pusty „wkrótce”, bez wymyślonych danych", () => {
  render(<MapBlockersPanel />);
  expect(screen.getByRole("heading", { name: /Radar blokad/ })).toBeInTheDocument();
  expect(screen.getByText(/wkrótce/)).toBeInTheDocument();
});
