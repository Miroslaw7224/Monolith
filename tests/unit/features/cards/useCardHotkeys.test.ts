import { describe, test, expect, vi } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";

function setup(disabled = false) {
  const onSelectCard = vi.fn();
  const onOpenPalette = vi.fn();
  const hook = renderHook(() => useCardHotkeys({ onSelectCard, onOpenPalette, disabled }));
  return { onSelectCard, onOpenPalette, ...hook };
}

describe("useCardHotkeys", () => {
  test("Alt+3 wybiera zadania", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "3", code: "Digit3", altKey: true });
    expect(onSelectCard).toHaveBeenCalledWith("zadania");
  });

  test("Alt+9 wybiera Kodeks", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "9", code: "Digit9", altKey: true });
    expect(onSelectCard).toHaveBeenCalledWith("kodeks");
  });

  test("Alt+0 nic nie robi", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "0", code: "Digit0", altKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("AltGr (Ctrl+Alt) jest ignorowany", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true, ctrlKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("sama cyfra bez Alt nic nie robi", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("Ctrl+K i Cmd+K otwierają paletę", () => {
    const { onOpenPalette } = setup();
    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    fireEvent.keyDown(window, { key: "K", code: "KeyK", metaKey: true });
    expect(onOpenPalette).toHaveBeenCalledTimes(2);
  });

  test("Ctrl+K blokuje domyślną akcję przeglądarki", () => {
    setup();
    const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("disabled wyłącza skróty", () => {
    const { onSelectCard, onOpenPalette } = setup(true);
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
    expect(onOpenPalette).not.toHaveBeenCalled();
  });

  test("odpina nasłuch po odmontowaniu", () => {
    const { onSelectCard, unmount } = setup();
    unmount();
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });
});
