import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentPendingActions } from "@/src/components/AgentPendingActions";

const pending = [
  { id: "p1", tool: "delete_task", args: { id: "t1" }, summary: "Usunąć zadanie „Raport”?" },
];

describe("AgentPendingActions", () => {
  it("renders nothing when there are no pending actions", () => {
    const { container } = render(
      <AgentPendingActions pending={[]} busy={false} lang="pl" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the summary and calls onConfirm / onCancel with the action", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <AgentPendingActions pending={pending} busy={false} lang="pl" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByText("Usunąć zadanie „Raport”?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Potwierdź" }));
    expect(onConfirm).toHaveBeenCalledWith(pending[0]);
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalledWith(pending[0]);
  });

  it("disables buttons while busy", () => {
    render(
      <AgentPendingActions pending={pending} busy lang="en" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
