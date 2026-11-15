import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ArsenalConfirmDialog } from "@/src/features/arsenal/ArsenalConfirmDialog";

afterEach(cleanup);

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ArsenalConfirmDialog
      title="Usunąć kurs „Pytest”?"
      confirmLabel="Usuń"
      cancelLabel="Anuluj"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel };
}

it("pokazuje dialog z tytułem i dwoma przyciskami, fokus na Anuluj", () => {
  setup();
  const dialog = screen.getByRole("dialog", { name: "Usunąć kurs „Pytest”?" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("button", { name: "Usuń" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Anuluj" })).toHaveFocus();
});

it("Usuń wywołuje onConfirm, nie onCancel", async () => {
  const { onConfirm, onCancel } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
});

it("Anuluj, Escape i kliknięcie w tło wywołują onCancel", async () => {
  const { onConfirm, onCancel } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("dialog"));
  expect(onCancel).toHaveBeenCalledTimes(3);
  expect(onConfirm).not.toHaveBeenCalled();
});

it("kliknięcie wewnątrz okna nie zamyka dialogu", async () => {
  const { onCancel } = setup();
  await userEvent.click(screen.getByRole("heading", { name: "Usunąć kurs „Pytest”?" }));
  expect(onCancel).not.toHaveBeenCalled();
});
