import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TagsSection } from "@/src/features/tags/TagsSection";

afterEach(cleanup);

test("pokazuje synonimy tagu jako tekst ≈", () => {
  const apiFetch = vi.fn();
  const onTagsChange = vi.fn();
  const userTags = [
    { id: "t1", tag: "Agenci AI", title: "Agenci AI", aliases: ["Agent AI", "agent"] },
    { id: "t2", tag: "AI", title: "AI" },
  ];
  render(<TagsSection apiFetch={apiFetch} userTags={userTags} onTagsChange={onTagsChange} />);

  expect(screen.getByText("≈ Agent AI, agent")).toBeInTheDocument();
  const approx = screen.getAllByText((_, el) => (el?.textContent ?? "").includes("≈"));
  const leafApprox = approx.filter(
    (el) => !approx.some((other) => other !== el && el.contains(other))
  );
  expect(leafApprox).toHaveLength(1);
});
