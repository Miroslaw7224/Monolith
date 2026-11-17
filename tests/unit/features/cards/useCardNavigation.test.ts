import React from "react";
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
    expect(result.current.codexOpen).toBe(false);
  });

  test("selectCard ustawia widok planowania i zakładkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("kalendarz"));
    expect(result.current.appMode).toBe("planowanie");
    expect(result.current.planningTab).toBe("calendar");
    expect(result.current.activeCard).toBe("kalendarz");
  });

  test("Kodeks otwiera własny widok, kolejna karta go zamyka", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("kodeks"));
    expect(result.current.codexOpen).toBe(true);
    expect(result.current.activeCard).toBe("kodeks");
    act(() => result.current.selectCard("kokpit"));
    expect(result.current.codexOpen).toBe(false);
    expect(result.current.appMode).toBe("home");
  });

  test("Diagnostyka otwiera własny widok, kolejna karta go zamyka", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("diagnostyka"));
    expect(result.current.diagnosticsOpen).toBe(true);
    expect(result.current.activeCard).toBe("diagnostyka");
    act(() => result.current.selectCard("kokpit"));
    expect(result.current.diagnosticsOpen).toBe(false);
  });

  test("karta Mapa ustawia mapOpen, nie zaślepkę; kolejna karta zdejmuje mapOpen", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("mapa"));
    expect(result.current.mapOpen).toBe(true);
    expect(result.current.activeCard).toBe("mapa");
    act(() => result.current.selectCard("kokpit"));
    expect(result.current.mapOpen).toBe(false);
  });

  test("setter starego widoku zdejmuje zaślepkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("projekty"));
    expect(result.current.projectsOpen).toBe(true);
    expect(result.current.activeCard).toBe("projekty");
    act(() => result.current.setPlanningTab("mindmaps"));
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
    expect(result.current.planningTab).toBe("skills");
  });

  test("nieznany hash zostawia kokpit", () => {
    window.history.replaceState(null, "", "/dashboard#xyz");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("kokpit");
  });

  test("hash z adresu przeżywa podwójne efekty React.StrictMode", () => {
    window.history.replaceState(null, "", "/dashboard#arsenal");
    const { result } = renderHook(() => useCardNavigation(), { wrapper: React.StrictMode });
    expect(result.current.activeCard).toBe("arsenal");
    expect(window.location.hash).toBe("#arsenal");
  });

  test("przejście Projekty → Kodeks zamyka projekty, otwiera Kodeks i ustawia adres #kodeks", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("projekty"));
    expect(result.current.codexOpen).toBe(false);
    expect(result.current.projectsOpen).toBe(true);
    expect(result.current.activeCard).toBe("projekty");
    act(() => result.current.selectCard("kodeks"));
    expect(result.current.projectsOpen).toBe(false);
    expect(result.current.codexOpen).toBe(true);
    expect(result.current.activeCard).toBe("kodeks");
    expect(window.location.hash).toBe("#kodeks");
  });

  test("przy starcie czyta Kodeks z hasha", () => {
    window.history.replaceState(null, "", "/dashboard#kodeks");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("kodeks");
    expect(result.current.codexOpen).toBe(true);
  });

  test("projekty → zadania zamyka widok projektów", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("projekty"));
    act(() => result.current.selectCard("zadania"));
    expect(result.current.projectsOpen).toBe(false);
    expect(result.current.activeCard).toBe("zadania");
  });

  test("przy starcie czyta Projekty z hasha", () => {
    window.history.replaceState(null, "", "/dashboard#projekty");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.projectsOpen).toBe(true);
  });
});
