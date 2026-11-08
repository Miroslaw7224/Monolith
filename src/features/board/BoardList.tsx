import React from "react";
import type { Board } from "@/src/features/board/boardTypes";

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
    <div className="space-y-6 overflow-y-auto p-4">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="text-sm font-bold text-[var(--text)]">{section.title}</h3>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {section.tiles.map((tile) => (
              <li key={tile.id} className="flex gap-4 p-3">
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--accent)]"
                  onClick={() => onOpen(tile.id)}
                >
                  {tile.title}
                </button>
                <span className="text-sm text-[var(--text2)]">{tile.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
