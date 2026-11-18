import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArsenalSkillsView } from "@/src/features/arsenal/ArsenalSkillsView";

afterEach(cleanup);

const catalog = {
  entries: [
    {
      kind: "skill",
      id: "skill:tdd",
      path: "Arsenal/Skills/tdd/skill.md",
      name: "test-driven-development",
      slug: "tdd",
      summary: "Najpierw test",
      body: "# TDD\nTreść skilla",
      origin: "global",
      category: "testy",
      deployed: [{ project: "p", mode: "full", date: "2026-11-14" }],
      templates: [{ name: "t.md", text: "szablon" }],
    },
    {
      kind: "prompt",
      id: "prompt:Rada",
      path: "Knowledge/prompty/Rada.md",
      name: "Rada ekspertów",
      summary: "Rada",
      body: "Treść promptu",
      projects: [],
    },
  ],
  targets: [
    { id: "p", name: "Projekt P", localPath: "~/p", owner: "personal", companyData: false },
    { id: "w", name: "Projekt W", localPath: "~/w", owner: "work", companyData: true },
  ],
  skipped: 2,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function setup() {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return json({});
    if (url.includes("/deploy?")) {
      const project = new URL(url, "http://x").searchParams.get("project");
      return json({
        mode: "full",
        text: `scripts/deploy-skill.sh tdd '~/${project}'`,
        ...(project === "w" && { note: "Dane z firmy: sprawdź, gdzie wklejasz" }),
      });
    }
    return json(catalog);
  });
  render(<ArsenalSkillsView apiFetch={apiFetch} />);
  return apiFetch;
}

describe("ArsenalSkillsView", () => {
  it("pokazuje listę wpisów i licznik pominiętych", async () => {
    setup();
    expect(await screen.findByRole("button", { name: /test-driven-development/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Rada ekspertów/ })).toBeVisible();
    expect(screen.getByText(/pominięto 2/i)).toBeVisible();
  });

  it("pokazuje kafelki statystyk", async () => {
    setup();
    await screen.findByRole("button", { name: /test-driven-development/ });
    const tiles = within(screen.getByRole("region", { name: "Statystyki arsenału" }));
    expect(tiles.getByText("Skille").parentElement).toHaveTextContent("1");
    expect(tiles.getByText("Prompty").parentElement).toHaveTextContent("1");
    expect(tiles.getByText("Niewdrożone nigdzie").parentElement).toHaveTextContent("0");
  });

  it("karty mają kolor rodzaju (data-kind) i domyślnie wybrany jest pierwszy wpis", async () => {
    setup();
    const skillCard = (
      await screen.findByRole("button", { name: /test-driven-development/ })
    ).closest("article");
    const promptCard = screen.getByRole("button", { name: /Rada ekspertów/ }).closest("article");
    expect(skillCard).toHaveAttribute("data-kind", "skill");
    expect(promptCard).toHaveAttribute("data-kind", "prompt");
    expect(skillCard).toHaveAttribute("data-selected", "true");
    const side = within(screen.getByRole("complementary"));
    expect(side.getByRole("heading", { name: "test-driven-development" })).toBeVisible();
  });

  it("„Kopiuj” na karcie skilla kopiuje wywołanie, na karcie promptu treść", async () => {
    setup();
    const user = userEvent.setup();
    const skillCard = (
      await screen.findByRole("button", { name: /test-driven-development/ })
    ).closest("article") as HTMLElement;
    await user.click(within(skillCard).getByRole("button", { name: "Kopiuj wywołanie" }));
    expect(await navigator.clipboard.readText()).toBe("/tdd");
    const promptCard = screen
      .getByRole("button", { name: /Rada ekspertów/ })
      .closest("article") as HTMLElement;
    await user.click(within(promptCard).getByRole("button", { name: "Kopiuj prompt" }));
    expect(await navigator.clipboard.readText()).toBe("Treść promptu");
  });

  it("filtr „prompty” ukrywa skille", async () => {
    setup();
    await screen.findByRole("button", { name: /test-driven-development/ });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "prompty" }));
    expect(screen.queryByRole("button", { name: /test-driven-development/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Rada ekspertów/ })).toBeVisible();
  });

  it("filtr kategorii zostawia skille z wybraną kategorią i ukrywa prompty", async () => {
    setup();
    await screen.findByRole("button", { name: /test-driven-development/ });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Kategoria"), "git");
    expect(screen.queryByRole("button", { name: /test-driven-development/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Kategoria"), "testy");
    expect(screen.getByRole("button", { name: /test-driven-development/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Rada ekspertów/ })).toBeNull();
  });

  it("wybór skilla pokazuje treść, szablony i wdrożenia", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    expect(screen.getByRole("heading", { name: "test-driven-development" })).toBeVisible();
    expect(screen.getByText(/Treść skilla/)).toBeVisible();
    expect(screen.getByText("t.md")).toBeVisible();
    expect(screen.getByText(/Projekt P/, { selector: ".asv-deployed *" })).toBeVisible();
  });

  it("generuje polecenie dla projektu z etatu z notą ostrzegawczą", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    await user.selectOptions(screen.getByLabelText("Projekt docelowy"), "w");
    await user.click(screen.getByRole("button", { name: "Generuj" }));
    expect(await screen.findByText("scripts/deploy-skill.sh tdd '~/w'")).toBeVisible();
    expect(screen.getByText("Dane z firmy: sprawdź, gdzie wklejasz")).toBeVisible();
  });

  it("„Oznacz jako wdrożone” wysyła POST z projektem i trybem", async () => {
    const apiFetch = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    await user.selectOptions(screen.getByLabelText("Projekt docelowy"), "w");
    await user.click(screen.getByRole("button", { name: "Generuj" }));
    await user.click(await screen.findByRole("button", { name: "Oznacz jako wdrożone" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/arsenal/skills/tdd/deployed",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ project: "w", mode: "full" }),
        })
      )
    );
  });

  it("przełączenie projektu czyści wygenerowany tekst", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    await user.click(screen.getByRole("button", { name: "Generuj" }));
    await screen.findByText("scripts/deploy-skill.sh tdd '~/p'");
    await user.selectOptions(screen.getByLabelText("Projekt docelowy"), "w");
    expect(screen.queryByText("scripts/deploy-skill.sh tdd '~/p'")).toBeNull();
  });

  it("spóźniona odpowiedź dla poprzedniego projektu nie nadpisuje wyniku", async () => {
    let release: (r: Response) => void = () => {};
    const apiFetch = vi.fn((url: string) =>
      url.includes("/deploy?")
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(json(catalog))
    );
    render(<ArsenalSkillsView apiFetch={apiFetch} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    await user.click(screen.getByRole("button", { name: "Generuj" }));
    await user.selectOptions(screen.getByLabelText("Projekt docelowy"), "w");
    await act(async () => {
      release(json({ mode: "full", text: "STARY WYNIK" }));
    });
    expect(screen.queryByText("STARY WYNIK")).toBeNull();
    expect(screen.getByRole("button", { name: "Generuj" })).toBeEnabled();
  });

  it("stan „Skopiowano” nie przechodzi na inny wpis", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /test-driven-development/ }));
    const side = () => within(screen.getByRole("complementary"));
    await user.click(side().getByRole("button", { name: "Kopiuj treść" }));
    expect(await side().findByText("Skopiowano")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Rada ekspertów/ }));
    expect(side().queryByText("Skopiowano")).toBeNull();
  });
});
