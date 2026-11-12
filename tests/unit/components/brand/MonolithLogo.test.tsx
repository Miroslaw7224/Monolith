import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MonolithLogo } from "@/src/components/brand/MonolithLogo";

describe("MonolithLogo", () => {
  beforeEach(() => cleanup());

  it("renders an accessible svg of the requested size", () => {
    render(<MonolithLogo size={64} />);

    const logo = screen.getByRole("img", { name: "Monolith" });
    expect(logo).toHaveAttribute("width", "64");
    expect(logo).toHaveAttribute("height", "64");
  });

  it("gives every instance its own gradient id", () => {
    const { container } = render(
      <>
        <MonolithLogo />
        <MonolithLogo />
      </>
    );

    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
