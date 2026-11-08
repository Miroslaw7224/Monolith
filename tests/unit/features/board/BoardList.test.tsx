import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Board } from "@/src/features/board/boardTypes";
import { BoardList } from "@/src/features/board/BoardList";

const board: Board = {
  frames: [
    { id: "f", title: "Rdzeń", x: 0, y: 0, w: 400, h: 300 },
    { id: "empty", title: "Pusta", x: 0, y: 0, w: 200, h: 120 },
  ],
  tiles: [
    { id: "t1", title: "Płatności", note: "notatka", x: 0, y: 0, w: 160, h: 72, frame: "f" },
    { id: "t2", title: "Luz", note: "", x: 0, y: 0, w: 160, h: 72, frame: null },
  ],
  edges: [],
};

describe("BoardList", () => {
  it("groups tiles under frames and hides the loose section when it is empty", () => {
    const onlyFramed: Board = { ...board, tiles: [board.tiles[0]] };
    render(<BoardList board={onlyFramed} outsideLabel="Poza ramkami" onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Rdzeń" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pusta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Poza ramkami" })).not.toBeInTheDocument();
  });

  it("shows loose tiles and opens a tile from its title", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<BoardList board={board} outsideLabel="Poza ramkami" onOpen={onOpen} />);
    expect(screen.getByRole("heading", { name: "Poza ramkami" })).toBeInTheDocument();
    expect(screen.getByText("notatka")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Płatności" }));
    expect(onOpen).toHaveBeenCalledWith("t1");
  });
});
