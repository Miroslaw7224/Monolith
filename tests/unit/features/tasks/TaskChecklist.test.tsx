import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach } from "vitest";
import { TaskChecklist } from "@/src/features/tasks/TaskChecklist";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DESC = "Wstęp\n- [ ] A\n- [x] B\n  > ok\n  - [!] C";

function setup(value = DESC) {
  const onChange = vi.fn();
  render(<TaskChecklist title="Testy" value={value} onChange={onChange} />);
  return { onChange };
}

describe("TaskChecklist", () => {
  it("bez punktów pokazuje samo pole tekstowe (Notatka)", () => {
    setup("Zwykła notatka");
    expect(screen.getByLabelText("Notatka")).toHaveValue("Zwykła notatka");
    expect(screen.queryByRole("button", { name: "Lista" })).not.toBeInTheDocument();
  });

  it("z punktami domyślnie lista i licznik w nagłówku", () => {
    setup();
    expect(screen.getByText("PASS 1 · FAIL 1 · pozostało 1")).toBeInTheDocument();
    expect(screen.getAllByTestId("checklist-item")).toHaveLength(3);
  });

  it("klik statusu: todo → pass (zmienia tylko znak)", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getAllByRole("button", { name: /^Do sprawdzenia/ })[0]);
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [ ] A", "- [x] A"));
  });

  it("pass → fail oraz fail → todo", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: /^PASS:/ }));
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [x] B", "- [!] B"));
    await user.click(screen.getByRole("button", { name: /^FAIL:/ }));
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [!] C", "- [ ] C"));
  });

  it("komentarz zapisuje się pod właściwym punktem", () => {
    const { onChange } = setup();
    const inputs = screen.getAllByPlaceholderText("Uwaga do punktu…");
    fireEvent.change(inputs[0], { target: { value: "nie działa" } });
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [ ] A", "- [ ] A\n  > nie działa"));
  });

  it("przełączenie Lista ↔ Tekst nie traci zmian", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Tekst" }));
    expect(screen.getByLabelText("Notatka")).toHaveValue(DESC);
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getAllByTestId("checklist-item")).toHaveLength(3);
  });

  it("Kopiuj jako Markdown wysyła eksport do schowka", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    await user.click(screen.getByRole("button", { name: "Kopiuj jako Markdown" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Testy"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("✅ PASS B"));
    expect(await screen.findByText("Skopiowano")).toBeInTheDocument();
  });

  it("niedostępny schowek: komunikat, bez cichej porażki", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    setup();
    await user.click(screen.getByRole("button", { name: "Kopiuj jako Markdown" }));
    expect(await screen.findByText("Schowek niedostępny")).toBeInTheDocument();
  });
});
