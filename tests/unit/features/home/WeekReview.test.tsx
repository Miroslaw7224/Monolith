import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WeekReview } from "@/src/features/home/WeekReview";
import type { WeekReviewDto } from "@/contexts/bc_cockpit/schemas";

const REVIEW: WeekReviewDto = {
  from: "2026-11-10",
  to: "2026-11-16",
  weekStart: "2026-11-16",
  git: { available: true, commits: 15, prs: 1 },
  projects: [
    {
      projectId: "monolith",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: ["feat: a"],
      doneTasks: ["Z"],
    },
  ],
  closings: [{ date: "2026-11-12", text: "Zaczep Monolith", projectId: "monolith" }],
  reviews: { available: true, approved: 1, comments: 1, prs: 2 },
  meetings: { count: 3, minutes: 180 },
  containsWork: false,
  prompt: "# Przegląd tygodnia 2026-11-10 – 2026-11-16",
};

// Atrapy sieci: z `Response` komponent czyta tylko `ok`, `status` i `json()`.
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;
const fail = () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response;

const mount = (over: Partial<React.ComponentProps<typeof WeekReview>> = {}) => {
  const props = {
    apiFetch: vi.fn().mockResolvedValue(ok(REVIEW)),
    focus: null,
    onChangeActive: vi.fn(),
    onFocusSaved: vi.fn(),
    ...over,
  };
  render(<WeekReview {...props} />);
  return props;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WeekReview", () => {
  test("zwinięty panel nie pobiera danych; rozwinięcie pobiera raz", async () => {
    const { apiFetch } = mount();
    expect(screen.getByText("Przegląd tygodnia")).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Monolith")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/week-review");
    fireEvent.click(screen.getByRole("button", { name: "Ukryj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  test("pokazuje projekty, zamknięcia dnia, review i spotkania", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("commity 5 · PR 1")).toBeTruthy();
    expect(screen.getByText("Zaczep Monolith", { exact: false })).toBeTruthy();
    expect(screen.getByText("Review: zatwierdzone 1, komentarze 1, PR 2")).toBeTruthy();
    expect(screen.getByText("Spotkania: 3 (180 min)")).toBeTruthy();
  });

  test("ostrzeżenie o danych firmy tylko przy containsWork", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(REVIEW));
    const first = mount({ apiFetch });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    await screen.findByText("Monolith");
    expect(screen.queryByText("Dane z firmy: sprawdź, gdzie wklejasz.")).toBeNull();
    cleanup();
    apiFetch.mockResolvedValue(
      ok({
        ...REVIEW,
        containsWork: true,
        projects: [
          { ...REVIEW.projects[0], name: "Firma", work: true, subjects: [], doneTasks: [] },
        ],
      })
    );
    render(<WeekReview {...first} />);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Dane z firmy: sprawdź, gdzie wklejasz.")).toBeTruthy();
  });

  test("„Kopiuj prompt dla agenta” kopiuje prompt do schowka", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kopiuj prompt dla agenta" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REVIEW.prompt));
    expect(await screen.findByText("Skopiowano")).toBeTruthy();
  });

  test("zapis focusu wysyła PUT i woła onFocusSaved; pole jest wstępnie wypełnione", async () => {
    const apiFetch = vi.fn((url: string) =>
      Promise.resolve(url === "/api/cockpit/week-focus" ? ok({}) : ok(REVIEW))
    );
    const { onFocusSaved } = mount({
      apiFetch,
      focus: { weekStart: "2026-11-16", text: "Stary focus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    const input = (await screen.findByLabelText("Focus na ten tydzień")) as HTMLInputElement;
    expect(input.value).toBe("Stary focus");
    fireEvent.change(input, { target: { value: "Domknąć słownik tagów" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onFocusSaved).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/week-focus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Domknąć słownik tagów" }),
    });
  });

  test("pusty focus blokuje „Zapisz”; błąd zapisu pokazuje komunikat", async () => {
    const apiFetch = vi.fn((url: string) =>
      Promise.resolve(url === "/api/cockpit/week-focus" ? fail() : ok(REVIEW))
    );
    const { onFocusSaved } = mount({ apiFetch });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    const save = (await screen.findByRole("button", { name: "Zapisz" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Focus na ten tydzień"), { target: { value: "X" } });
    fireEvent.click(save);
    expect(await screen.findByText("Nie udało się zapisać")).toBeTruthy();
    expect(onFocusSaved).not.toHaveBeenCalled();
  });

  test("„Zmień aktywne tematy” woła onChangeActive", async () => {
    const { onChangeActive } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    fireEvent.click(await screen.findByRole("button", { name: "Zmień aktywne tematy" }));
    expect(onChangeActive).toHaveBeenCalledTimes(1);
  });

  test("po nieudanym pobraniu ponowne otwarcie panelu ponawia żądanie", async () => {
    const apiFetch = vi.fn().mockResolvedValueOnce(fail()).mockResolvedValueOnce(ok(REVIEW));
    mount({ apiFetch });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Nie udało się wczytać przeglądu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ukryj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Monolith")).toBeTruthy();
    expect(screen.queryByText("Nie udało się wczytać przeglądu")).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["HTTP 500", () => fail()],
    ["odpowiedź bez projects", () => ok({ git: {} })],
  ])("błąd pobierania: %s pokazuje komunikat", async (_name, response) => {
    mount({ apiFetch: vi.fn().mockResolvedValue(response()) });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Nie udało się wczytać przeglądu")).toBeTruthy();
  });
});
