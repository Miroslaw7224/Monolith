import React, { useState } from "react";
import type { BoardTile } from "@/src/features/board/boardTypes";

export function TileDialog({
  tile,
  titleLabel,
  noteLabel,
  closeLabel,
  onSave,
}: {
  tile: BoardTile;
  titleLabel: string;
  noteLabel: string;
  closeLabel: string;
  onSave: (patch: { title: string; note: string }) => void;
}) {
  const [title, setTitle] = useState(tile.title);
  const [note, setNote] = useState(tile.note);
  return (
    <div
      role="dialog"
      aria-label={titleLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4">
        <label className="block text-sm text-[var(--text)]">
          {titleLabel}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm text-[var(--text)]">
          {noteLabel}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() =>
              onSave({ title: title.trim().slice(0, 200), note: note.slice(0, 10000) })
            }
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
