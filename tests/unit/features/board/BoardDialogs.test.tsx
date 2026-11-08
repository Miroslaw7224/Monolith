import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeleteDialog } from "@/src/features/board/ConfirmDeleteDialog";
import { FrameNameDialog } from "@/src/features/board/FrameNameDialog";
import { TileDialog } from "@/src/features/board/TileDialog";

afterEach(() => cleanup());

describe("board dialogs", () => {
  it("focuses the cancel button of the delete dialog", () => {
    render(
      <ConfirmDeleteDialog
        title="Usunąć kafelek?"
        lines={["„A” zniknie z tablicy."]}
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveFocus();
  });

  it("does not submit a blank frame name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FrameNameDialog
        title="Nazwa ramki"
        submitLabel="Zapisz"
        cancelLabel="Anuluj"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox"), "  Rdzeń  ");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSubmit).toHaveBeenCalledWith("Rdzeń");
  });

  it("saves the tile when the window closes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TileDialog
        tile={{ id: "t", title: "A", note: "", x: 0, y: 0, w: 160, h: 72, frame: null }}
        titleLabel="Tytuł"
        noteLabel="Notatka"
        closeLabel="Zamknij"
        onSave={onSave}
      />
    );
    const fields = screen.getAllByRole("textbox");
    await user.clear(fields[0]);
    await user.type(fields[0], "Nowy");
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onSave).toHaveBeenCalledWith({ title: "Nowy", note: "" });
  });
});
