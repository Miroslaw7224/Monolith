import React from "react";
import type { BoardDto as Board } from "@/contexts/bc_board/schemas";

export function BoardList({
  board,
  outsideLabel,
  onOpen,
}: {
  board: Board;
  outsideLabel: string;
  onOpen: (tileId: string) => void;
}) {
  const frameIds = new Set(board.frames.map((frame) => frame.id));
  const sections = [
    ...board.frames.map((frame) => ({
      id: frame.id,
      title: frame.title,
      tiles: board.tiles.filter((tile) => tile.frame === frame.id),
    })),
    {
      id: "loose",
      title: outsideLabel,
      tiles: board.tiles.filter((tile) => !tile.frame || !frameIds.has(tile.frame)),
    },
  ].filter((section) => section.id !== "loose" || section.tiles.length > 0);

  return (
    <div className="plo-list-view">
      {sections.map((section) => (
        <section key={section.id} className="panel plo-panel">
          <div className="panel__head plo-panel__head">
            <h3 className="panel__title plo-panel__title">
              <b>{section.title}</b>
            </h3>
            <span className="chip plo-chip">
              {section.tiles.length} {section.tiles.length === 1 ? "kafelek" : "kafelków"}
            </span>
          </div>
          <ul className="plo-boards">
            {section.tiles.map((tile) => (
              <li key={tile.id} className="plo-board-item">
                <button
                  type="button"
                  className="plo-board-item__btn"
                  onClick={() => onOpen(tile.id)}
                >
                  {tile.title}
                </button>
                {tile.note ? <span className="plo-board-item__note">{tile.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
