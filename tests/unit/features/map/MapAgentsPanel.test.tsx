import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapAgentsPanel } from "@/src/features/map/MapAgentsPanel";

afterEach(() => cleanup());

describe("MapAgentsPanel", () => {
  it("niedostępny Herdr pokazuje komunikat i nie psuje panelu", () => {
    render(
      <MapAgentsPanel
        available={false}
        agents={[]}
        loading={false}
        projectNames={{}}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText("Herdr niedostępny")).toBeInTheDocument();
  });

  it("agent z projektu ma nazwę projektu i miejsce; agent bez projektu tylko etykietę i stan", () => {
    render(
      <MapAgentsPanel
        available
        loading={false}
        projectNames={{ mine: "Moja apka" }}
        onRefresh={() => {}}
        agents={[
          {
            address: "t1",
            label: "claude-code",
            state: "live",
            status: "working",
            projectId: "mine",
            where: "Mono / 1",
          },
          { address: "t2", label: "antigravity", state: "live" },
        ]}
      />
    );
    expect(screen.getByText("Moja apka")).toBeInTheDocument();
    expect(screen.getByText("Mono / 1")).toBeInTheDocument();
    expect(screen.getByText("antigravity")).toBeInTheDocument();
    expect(screen.getAllByText("live")).toHaveLength(2);
  });

  it("przycisk „Odśwież stan” wywołuje odświeżenie", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <MapAgentsPanel
        available
        agents={[]}
        loading={false}
        projectNames={{}}
        onRefresh={onRefresh}
      />
    );
    await user.click(screen.getByRole("button", { name: "Odśwież stan" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
