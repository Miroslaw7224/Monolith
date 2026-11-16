import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { ReviewRequests } from "@/src/features/home/ReviewRequests";

describe("ReviewRequests po angielsku", () => {
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await setLanguage("pl");
    });
  });

  test("lista: nagłówek i link do PR", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        items: [
          {
            repo: "o/r",
            number: 2,
            title: "Second PR",
            author: "ann",
            url: "https://github.com/o/r/pull/2",
            updatedAt: "2026-11-15T10:00:00Z",
          },
        ],
      }),
    });
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("To review")).toBeTruthy();
    expect(screen.getByRole("link", { name: /o\/r#2/ })).toBeTruthy();
  });

  test("pusta lista: komunikat", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, items: [] }),
    });
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("No review requests")).toBeTruthy();
  });

  test("błąd HTTP: komunikat", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Could not load from GitHub")).toBeTruthy();
  });
});
