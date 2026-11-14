import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapNodeList } from "@/src/features/map/MapNodeList";

afterEach(() => cleanup());

const clusters = [
  { id: "nexus", label: "NEXUS", group: "projects" as const, size: 4 },
  { id: "knowledge:tools", label: "tools", group: "knowledge" as const, size: 300 },
  { id: "skille", label: "Skille", group: "skills" as const, size: 0, soon: true },
];

describe("MapNodeList", () => {
  it("Tab + Enter wybiera skupisko", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MapNodeList clusters={clusters} selectedId={null} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("nexus");
  });

  it("opisuje liczbę notatek i placeholder", () => {
    render(<MapNodeList clusters={clusters} selectedId="knowledge:tools" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /tools.*300/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: /Skille.*wkrótce/ })).toBeInTheDocument();
  });
});
