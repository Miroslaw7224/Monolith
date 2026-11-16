import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReviewRequests } from "@/src/features/home/ReviewRequests";

const ITEMS = [
  {
    repo: "crait-p-s-a/career-guide",
    number: 1476,
    title: "fix(matchers): słownik",
    author: "Adiszef-ai",
    url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
    updatedAt: "2026-11-16T05:58:28Z",
    state: "open",
  },
  {
    repo: "o/r",
    number: 2,
    title: "Drugi PR",
    author: null,
    url: "https://github.com/o/r/pull/2",
    updatedAt: "2026-11-15T10:00:00Z",
    state: "merged",
  },
];

const ok = (items: unknown[], total: number = items.length) => ({
  ok: true,
  json: async () => ({ available: true, total, items }),
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
  vi.restoreAllMocks();
});

describe("ReviewRequests", () => {
  test("przed pierwszą odpowiedzią nic nie pokazuje", () => {
    const apiFetch = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<ReviewRequests apiFetch={apiFetch} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/reviews");
  });

  test("lista: nagłówek, licznik i bezpieczne linki do PR-ów", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Do zrecenzowania")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    const link = screen.getByRole("link", { name: /career-guide#1476/ });
    expect(link.getAttribute("href")).toBe(ITEMS[0].url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /o\/r#2/ })).toBeTruthy();
    expect(screen.getByText(/Adiszef-ai/)).toBeTruthy();
  });

  test("zmergowany PR ma znacznik „scalony”, otwarty go nie ma", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    expect(screen.getAllByText("scalony")).toHaveLength(1);
  });

  test("chip pokazuje pełną liczbę, a pod listą „+N starszych”", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS, 39));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("39")).toBeTruthy();
    expect(screen.getByText("+37 starszych")).toBeTruthy();
  });

  test("gdy wszystkie się mieszczą, nie ma wiersza „starszych”", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    expect(screen.queryByText(/starszych/)).toBeNull();
  });

  test("pusta lista: komunikat, bez linków", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok([]));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Brak próśb o review")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test.each([
    ["available false", () => ({ ok: true, json: async () => ({ available: false, items: [] }) })],
    ["HTTP 500", () => ({ ok: false, status: 500, json: async () => ({}) })],
    ["odpowiedź bez items", () => ({ ok: true, json: async () => [] })],
  ])("błąd: %s pokazuje komunikat", async (_name, response) => {
    const apiFetch = vi.fn().mockResolvedValue(response());
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("odrzucony apiFetch pokazuje komunikat", async () => {
    const apiFetch = vi.fn().mockRejectedValue(new Error("sieć"));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("co 5 minut odświeża, ale tylko przy widocznej karcie", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test("powrót karty do widoczności odświeża od razu", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test("starsza odpowiedź nie nadpisuje nowszej (nakładające się zapytania)", async () => {
    let resolveOld: (v: unknown) => void = () => {};
    let resolveNew: (v: unknown) => void = () => {};
    const apiFetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveNew = r)));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveNew(ok([ITEMS[1]]));
    });
    expect(await screen.findByRole("link", { name: /o\/r#2/ })).toBeTruthy();

    await act(async () => {
      resolveOld(ok([ITEMS[0]]));
    });
    expect(screen.queryByRole("link", { name: /career-guide#1476/ })).toBeNull();
    expect(screen.getByRole("link", { name: /o\/r#2/ })).toBeTruthy();
  });

  test("po odmontowaniu: brak zapytań (interwał i nasłuch zdjęte)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    const { unmount } = render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  test("odmontowanie w trakcie zapytania: odpowiedź nie zmienia stanu (bez ostrzeżeń)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve: (v: unknown) => void = () => {};
    const apiFetch = vi.fn(() => new Promise((r) => (resolve = r)));
    const { unmount } = render(<ReviewRequests apiFetch={apiFetch as never} />);
    unmount();
    await act(async () => {
      resolve(ok(ITEMS));
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
