import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";

beforeEach(() => {
  window.history.replaceState(null, "", "/dashboard");
});

describe("useCardNavigation", () => {
  test("startuje na kokpicie", () => {
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.appMode).toBe("home");
    expect(result.current.activeCard).toBe("kokpit");
    expect(result.current.placeholder).toBeNull();
  });

  test("selectCard ustawia widok planowania i zakładkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("kalendarz"));
    expect(result.current.appMode).toBe("planowanie");
    expect(result.current.planningTab).toBe("calendar");
    expect(result.current.activeCard).toBe("kalendarz");
  });

  test("karta bez kodu ustawia zaślepkę, kolejna karta ją zdejmuje", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("mapa"));
    expect(result.current.placeholder).toBe("mapa");
    expect(result.current.activeCard).toBe("mapa");
    act(() => result.current.selectCard("kokpit"));
    expect(result.current.placeholder).toBeNull();
    expect(result.current.appMode).toBe("home");
  });

  test("setter starego widoku zdejmuje zaślepkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("projekty"));
    act(() => result.current.setPlanningTab("mindmaps"));
    expect(result.current.placeholder).toBeNull();
    act(() => result.current.setAppMode("planowanie"));
    expect(result.current.activeCard).toBe("plotno");
  });

  test("zapisuje aktywną kartę w hashu", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("notatki"));
    expect(window.location.hash).toBe("#notatki");
  });

  test("przy starcie czyta kartę z hasha", () => {
    window.history.replaceState(null, "", "/dashboard#arsenal");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("arsenal");
    expect(result.current.planningTab).toBe("resources");
  });

  test("nieznany hash zostawia kokpit", () => {
    window.history.replaceState(null, "", "/dashboard#xyz");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("kokpit");
  });
});
