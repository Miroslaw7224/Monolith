import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";

test("zaślepka Kodeksu pokazuje etap i ścieżkę makiety 09", () => {
  render(<CardPlaceholder cardId="kodeks" />);
  expect(screen.getByRole("heading", { name: "Kodeks" })).toBeInTheDocument();
  expect(screen.getByText(/po etapie 0c/)).toBeInTheDocument();
  expect(screen.getByText("docs/mockups/karty/cards/09-kodeks.html")).toBeInTheDocument();
});
