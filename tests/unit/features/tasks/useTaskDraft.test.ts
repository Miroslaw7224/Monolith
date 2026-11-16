import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTaskDraft, buildDraftPatch } from "@/src/features/tasks/useTaskDraft";

const INITIAL = { title: "Tytuł", link: "", description: "Opis" };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (save = vi.fn().mockResolvedValue(undefined)) => {
  const hook = renderHook(() => useTaskDraft({ taskId: "t1", initial: INITIAL, save }));
  return { ...hook, save };
};
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("buildDraftPatch", () => {
  it("tylko zmienione pola, przycięte; pusty tytuł pomijany", () => {
    expect(buildDraftPatch({ ...INITIAL, description: " Nowy \n" }, INITIAL)).toEqual({
      description: "Nowy",
    });
    expect(buildDraftPatch({ ...INITIAL, title: "  " }, INITIAL)).toEqual({});
    expect(buildDraftPatch(INITIAL, INITIAL)).toEqual({});
  });
});

describe("useTaskDraft", () => {
  it("kilka zmian w ciągu 1,4 s → jeden zapis po 1,5 s od ostatniej", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "a"));
    await tick(700);
    act(() => result.current.setField("description", "ab"));
    await tick(700);
    expect(save).not.toHaveBeenCalled();
    await tick(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("t1", { description: "ab" });
    expect(result.current.state).toBe("saved");
  });

  it("brak zmiany treści → brak zapisu", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "Opis"));
    await tick(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("zapis zawiera tylko zmienione pola", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("link", "https://x.pl"));
    await tick(1500);
    expect(save).toHaveBeenCalledWith("t1", { link: "https://x.pl" });
  });

  it("błąd serwera → stan error i ponowienie przy następnej zmianie (z polami, które padły)", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValue(undefined);
    const { result } = setup(save);
    act(() => result.current.setField("description", "a"));
    await tick(1500);
    expect(result.current.state).toBe("error");
    act(() => result.current.setField("title", "Nowy"));
    await tick(1500);
    expect(save).toHaveBeenLastCalledWith("t1", { title: "Nowy", description: "a" });
    expect(result.current.state).toBe("saved");
  });

  it("flush() zapisuje od razu, bez czekania na timer", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "x"));
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith("t1", { description: "x" });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("odmontowanie (zamknięcie, zmiana zadania) zapisuje oczekującą zmianę dla starego id", async () => {
    const { result, save, unmount } = setup();
    act(() => result.current.setField("description", "x"));
    unmount();
    await tick(0);
    expect(save).toHaveBeenCalledWith("t1", { description: "x" });
  });

  it("pusty tytuł: titleEmpty = true i brak zapisu tytułu", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("title", ""));
    await tick(1500);
    expect(result.current.titleEmpty).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("saveNow wysyła jednopolowy zapis od razu i ustawia stan", async () => {
    const { result, save } = setup();
    await act(async () => {
      await result.current.saveNow({ status: "done" });
    });
    expect(save).toHaveBeenCalledWith("t1", { status: "done" });
    expect(result.current.state).toBe("saved");
  });

  it("błąd zapisu szkicu nie znika po udanym zapisie jednopolowym", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValue(undefined);
    const { result } = setup(save);
    act(() => result.current.setField("description", "a"));
    await tick(1500);
    expect(result.current.state).toBe("error");
    let ok = false;
    await act(async () => {
      ok = await result.current.saveNow({ status: "done" });
    });
    expect(ok).toBe(true);
    expect(result.current.state).toBe("error");
  });

  it("saveNow: nieudany zapis zwraca false", async () => {
    const save = vi.fn().mockRejectedValue(new Error("HTTP 500"));
    const { result } = setup(save);
    let ok = true;
    await act(async () => {
      ok = await result.current.saveNow({ status: "done" });
    });
    expect(ok).toBe(false);
    expect(result.current.state).toBe("error");
  });
});
