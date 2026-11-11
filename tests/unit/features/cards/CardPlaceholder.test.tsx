import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";

test("pokazuje nazwę karty, etap i ścieżkę makiety", () => {
  render(<CardPlaceholder cardId="mapa" />);
  expect(screen.getByRole("heading", { name: "Mapa" })).toBeInTheDocument();
  expect(screen.getByText(/etap 4/)).toBeInTheDocument();
  expect(screen.getByText("docs/mockups/karty/cards/08-mapa.html")).toBeInTheDocument();
});
