import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OpenPrs } from "@/src/features/home/OpenPrs";

const ITEMS = [
  {
    repo: "o/r",
    number: 5,
    title: "Gotowy PR",
    url: "https://github.com/o/r/pull/5",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: false,
  },
  {
    repo: "org/app",
    number: 6,
    title: "Szkic",
    url: "https://github.com/org/app/pull/6",
    updatedAt: "2026-11-15T10:00:00Z",
    draft: true,
  },
];

const ok = (items: unknown[], total: number = items.length) => ({
  ok: true,
  json: async () => ({ available: true, total, items }),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OpenPrs", () => {
  test("przed pierwszą odpowiedzią nic nie pokazuje i woła właściwą trasę", () => {
    const apiFetch = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<OpenPrs apiFetch={apiFetch} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/open-prs");
  });

  test("lista: nagłówek, licznik, bezpieczne linki, draft szary i gotowy zielony", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<OpenPrs apiFetch={apiFetch} />);
    expect(await screen.findByText("Otwarte PR")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    const link = screen.getByRole("link", { name: /o\/r#5/ });
    expect(link.getAttribute("href")).toBe(ITEMS[0].url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("o/r#5").className).toContain("kok-reviews__ref--ready");
    expect(screen.getByText("org/app#6").className).toContain("kok-reviews__ref--draft");
    expect(screen.getByText("gotowy").className).toContain("kok-reviews__state--ready");
    expect(screen.getByText("draft").className).toContain("kok-reviews__state--draft");
  });

  test("pusta lista: komunikat, licznik 0", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue(ok([]))} />);
    expect(await screen.findByText("Brak otwartych PR")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  test("błąd HTTP i available false pokazują komunikat o błędzie", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue({ ok: false, status: 500 })} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
    cleanup();
    render(
      <OpenPrs
        apiFetch={vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ available: false, total: 0, items: [] }),
        })}
      />
    );
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("total większy niż lista: „+N starszych”", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue(ok(ITEMS, 25))} />);
    expect(await screen.findByText("+23 starszych")).toBeTruthy();
  });

  test("odświeża co 5 minut przy widocznej karcie", async () => {
    vi.useFakeTimers();
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<OpenPrs apiFetch={apiFetch} />);
    await act(async () => {});
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
