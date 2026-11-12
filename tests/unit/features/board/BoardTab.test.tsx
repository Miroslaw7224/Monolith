import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardTab } from "@/src/features/board/BoardTab";

afterEach(() => cleanup());

vi.mock("@/src/features/board/BoardCanvas", () => ({
  BoardCanvas: ({
    onChange,
  }: {
    onChange: (board: { tiles: unknown[]; frames: unknown[]; edges: unknown[] }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
          frames: [],
          edges: [],
        })
      }
    >
      change
    </button>
  ),
}));

const labels = {
  canvas: "Płótno",
  list: "Lista",
  saveFailed: "Nie zapisano zmian",
  loadFailed: "Nie udało się wczytać tablicy",
  retry: "Ponów",
  outside: "Poza ramkami",
  tileTitle: "Tytuł",
  tileNote: "Notatka",
  close: "Zamknij",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("BoardTab", () => {
  it("shows a retry when the load fails and does not draw the canvas", async () => {
    const apiFetch = vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    render(<BoardTab apiFetch={apiFetch} lang="pl" labels={labels} canvasLabels={{} as never} />);
    expect(await screen.findByText("Nie udało się wczytać tablicy")).toBeInTheDocument();
    expect(screen.queryByTestId("flow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "change" })).not.toBeInTheDocument();
  });

  it("keeps the change on screen when the save fails", async () => {
    const user = userEvent.setup();
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tiles: [], frames: [], edges: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
          frames: [],
          edges: [],
        })
      );
    render(<BoardTab apiFetch={apiFetch} lang="pl" labels={labels} canvasLabels={{} as never} />);
    await user.click(await screen.findByRole("button", { name: "change" }));
    expect(await screen.findByText("Nie zapisano zmian")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "change" }));
    await waitFor(() => expect(screen.queryByText("Nie zapisano zmian")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "change" })).toBeInTheDocument();
  });
});
