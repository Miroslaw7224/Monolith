import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapNodeList } from "@/src/features/map/MapNodeList";

afterEach(() => cleanup());

const nodes = [
  { id: "nexus", kind: "project" as const, label: "NEXUS" },
  { id: "@wiedza", kind: "continent" as const, label: "Wiedza", size: 300 },
  { id: "@skille", kind: "continent" as const, label: "Skille", soon: true },
];

describe("MapNodeList", () => {
  it("Tab + Enter wybiera węzeł", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MapNodeList nodes={nodes} selectedId={null} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("nexus");
  });

  it("opisuje rozmiar kontynentu i placeholder", () => {
    render(<MapNodeList nodes={nodes} selectedId="@wiedza" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Wiedza.*300/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: /Skille.*wkrótce/ })).toBeInTheDocument();
  });
});
