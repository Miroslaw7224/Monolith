import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReviewHistory } from "@/src/features/home/ReviewHistory";

const HISTORY = {
  from: "2026-11-14",
  to: "2026-11-16",
  available: true,
  approved: 3,
  comments: 3,
  prs: 4,
  days: [
    { date: "2026-11-14", approved: 0, comments: 0 },
    { date: "2026-11-15", approved: 2, comments: 1 },
    { date: "2026-11-16", approved: 1, comments: 2 },
  ],
};

const ok = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReviewHistory", () => {
  test("przed pierwszą odpowiedzią nic nie pokazuje; pobiera 7 dni", () => {
    const apiFetch = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/review-history?days=7");
  });

  test("panel: tytuł, legenda, chip z sumami i słupki dzień po dniu", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(HISTORY));
    render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(await screen.findByText("Review")).toBeTruthy();
    expect(screen.getByText("zatwierdzone")).toBeTruthy();
    expect(screen.getByText("komentarze")).toBeTruthy();
    expect(screen.getByText("3 zatw. · 3 kom. · 4 PR · 3 dni")).toBeTruthy();
    expect(screen.getByRole("img", { name: "14 listopada: brak review" })).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "15 listopada: zatwierdzone 2, komentarze 1" })
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "16 listopada: zatwierdzone 1, komentarze 2" })
    ).toBeTruthy();
  });

  test.each([
    ["available false", () => ok({ ...HISTORY, available: false, days: [] })],
    ["HTTP 500", () => ({ ok: false, status: 500, json: async () => ({}) })],
    ["odpowiedź bez days", () => ok({ available: true })],
  ])("błąd: %s pokazuje komunikat", async (_name, response) => {
    const apiFetch = vi.fn().mockResolvedValue(response());
    render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("dzień z samymi komentarzami nie ma wiodącej kropki nad słupkiem", async () => {
    const only = {
      ...HISTORY,
      days: [{ date: "2026-11-16", approved: 0, comments: 2 }],
      approved: 0,
      comments: 2,
      prs: 1,
    };
    const apiFetch = vi.fn().mockResolvedValue(ok(only));
    const { container } = render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    await screen.findByText("Review");
    const value = container.querySelector(".kok-history__value") as HTMLElement;
    expect(value.textContent?.trim()).toBe("2");
  });

  test("starsza odpowiedź po zmianie dnia nie nadpisuje nowszej", async () => {
    let resolveOld: (v: unknown) => void = () => {};
    const newer = { ...HISTORY, approved: 9 };
    const apiFetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(ok(newer));
    const { rerender } = render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    rerender(<ReviewHistory apiFetch={apiFetch} day="2026-11-17" />);
    expect(await screen.findByText(/^9 zatw\./)).toBeTruthy();
    await act(async () => {
      resolveOld(ok(HISTORY));
    });
    expect(screen.getByText(/^9 zatw\./)).toBeTruthy();
    expect(screen.queryByText(/^3 zatw\./)).toBeNull();
  });

  test("odrzucony apiFetch pokazuje komunikat", async () => {
    const apiFetch = vi.fn().mockRejectedValue(new Error("sieć"));
    render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("zmiana dnia pobiera dane od nowa", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(HISTORY));
    const { rerender } = render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    await screen.findByText("Review");
    rerender(<ReviewHistory apiFetch={apiFetch} day="2026-11-17" />);
    await screen.findByText("Review");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test("odmontowanie w trakcie zapytania nie zmienia stanu (bez ostrzeżeń)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve: (v: unknown) => void = () => {};
    // Atrapa sieci: zapytanie rozwiązywane ręcznie ułamkiem Response (`ok`, `json()`), nie pełnym Response.
    const apiFetch = vi.fn(() => new Promise((r) => (resolve = r)));
    const { unmount } = render(<ReviewHistory apiFetch={apiFetch as never} day="2026-11-16" />);
    unmount();
    resolve(ok(HISTORY));
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
