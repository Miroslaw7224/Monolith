import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_BOARD } from "@/contexts/bc_board/schemas";
import { BoardCanvas } from "@/src/features/board/BoardCanvas";

afterEach(() => cleanup());

vi.mock("@xyflow/react", () => {
  const React = require("react");
  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ReactFlow: ({
      children,
      deleteKeyCode,
    }: {
      children?: React.ReactNode;
      deleteKeyCode?: string | null;
    }) => (
      <div data-testid="flow" data-delete-key={deleteKeyCode ?? ""}>
        {children}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    MarkerType: { ArrowClosed: "arrow" },
    NodeResizer: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    BaseEdge: () => null,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getSmoothStepPath: () => ["M0 0", 0, 0, 0, 0],
    useReactFlow: () => ({
      screenToFlowPosition: () => ({ x: 100, y: 80 }),
      getNodes: () => [],
    }),
    useNodesState: (initial: unknown[]) => {
      const [nodes, setNodes] = React.useState(initial);
      return [nodes, setNodes, () => {}];
    },
    useEdgesState: (initial: unknown[]) => {
      const [edges, setEdges] = React.useState(initial);
      return [edges, setEdges, () => {}];
    },
  };
});

const labels = {
  addTile: "+ Kafelek",
  addFrame: "+ Ramka",
  newTile: "Nowy kafelek",
  frameName: "Nazwa ramki",
  save: "Zapisz",
  cancel: "Anuluj",
  close: "Zamknij",
  tileTitle: "Tytuł",
  tileNote: "Notatka",
  delete: "Usuń",
};

describe("BoardCanvas", () => {
  it("adds a tile from the toolbar and asks for a frame name before adding a frame", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BoardCanvas
        board={EMPTY_BOARD}
        lang="pl"
        labels={labels}
        dialogOpen={false}
        onChange={onChange}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "+ Kafelek" }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].tiles[0].title).toBe("Nowy kafelek");
    await user.click(screen.getByRole("button", { name: "+ Ramka" }));
    expect(screen.getByRole("dialog", { name: "Nazwa ramki" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "Rdzeń");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onChange.mock.calls.at(-1)[0].frames[0].title).toBe("Rdzeń");
  });

  it("clears the delete key while a dialog is open", () => {
    const { rerender } = render(
      <BoardCanvas
        board={EMPTY_BOARD}
        lang="pl"
        labels={labels}
        dialogOpen={false}
        onChange={vi.fn()}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("flow")).toHaveAttribute("data-delete-key", "Backspace");
    rerender(
      <BoardCanvas
        board={EMPTY_BOARD}
        lang="pl"
        labels={labels}
        dialogOpen
        onChange={vi.fn()}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("flow")).toHaveAttribute("data-delete-key", "");
  });
});
