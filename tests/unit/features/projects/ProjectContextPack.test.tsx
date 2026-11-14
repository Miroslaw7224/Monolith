import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextPackResult } from "@/src/features/projects/mutation";
import {
  ProjectContextPack,
  ProjectContextPackButton,
} from "@/src/features/projects/ProjectContextPack";
import { useContextPack } from "@/src/features/projects/useContextPack";

afterEach(() => cleanup());

const PACK = {
  markdown: "# P\n\nStatus\n\n## Save State\n\nnext\n\n## Kod (git)\n\n```\n## main\n```",
  approxTokens: 3200,
  truncated: false,
  warnings: [] as string[],
};

function Harness(props: { load: () => Promise<ContextPackResult>; id?: string | null }) {
  const pack = useContextPack(props.id === undefined ? "a" : props.id, props.load);
  return (
    <>
      <ProjectContextPackButton pack={pack} />
      <ProjectContextPack pack={pack} />
    </>
  );
}

function renderIt(
  load: () => Promise<ContextPackResult>,
  writeText: (text: string) => Promise<void> = vi.fn(async () => {})
) {
  const user = userEvent.setup();
  // `userEvent.setup()` podstawia własny schowek, więc stub ustawiamy dopiero po nim.
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const view = render(<Harness load={load} />);
  return { user, writeText, ...view };
}

/** Przycisk z nagłówka (z liczbą tokenów) i z karty mają ten sam początek nazwy. */
const copyButtons = () => screen.getAllByRole("button", { name: /^Kopiuj paczkę kontekstu/ });
const okLoad = () => vi.fn(async (): Promise<ContextPackResult> => ({ ok: true, pack: PACK }));

describe("paczka kontekstu", () => {
  it("po wczytaniu pokazuje budżet, skład sekcji i tokeny w przycisku", async () => {
    renderIt(okLoad());

    expect(await screen.findByText("3 200 / 4 000 tokenów")).toBeInTheDocument();
    expect(screen.getByText("Wykorzystanie okna: 80%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Budżet paczki kontekstu" })).toHaveAttribute(
      "aria-valuenow",
      "80"
    );
    expect(screen.getByText("Nagłówek")).toBeInTheDocument();
    expect(screen.getByText("Save State")).toBeInTheDocument();
    // `## main` w bloku kodu nie jest sekcją
    expect(screen.queryByText("main")).not.toBeInTheDocument();
    expect(copyButtons()[0]).toHaveTextContent("(~3,2 tys. tok)");
  });

  it("kopiuje markdown i pokazuje liczbę tokenów", async () => {
    const load = okLoad();
    const { user, writeText } = renderIt(load);
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(copyButtons()[0]);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(PACK.markdown);
    // jedno ładowanie przy starcie i jedno świeże przy kopiowaniu
    expect(load).toHaveBeenCalledTimes(2);
    expect(
      (await screen.findAllByText("Skopiowano paczkę kontekstu (~3,2 tys. tokenów)")).length
    ).toBeGreaterThan(0);
  });

  it("skrócona paczka i ostrzeżenia", async () => {
    const load = vi.fn(
      async (): Promise<ContextPackResult> => ({
        ok: true,
        pack: { ...PACK, truncated: true, warnings: ["a", "b"] },
      })
    );
    const { user } = renderIt(load);
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(copyButtons()[0]);

    expect(
      (
        await screen.findAllByText(
          "Skopiowano paczkę kontekstu (~3,2 tys. tokenów) · skrócona do budżetu"
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("a · b").length).toBeGreaterThan(0);
  });

  it("błąd wczytania: alert w karcie, kopiowanie nie dotyka schowka", async () => {
    const load = vi.fn(async (): Promise<ContextPackResult> => ({ ok: false, error: "HTTP 404" }));
    const { user, writeText } = renderIt(load);

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 404");
    await user.click(copyButtons()[0]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("błąd schowka: alert", async () => {
    const { user } = renderIt(
      okLoad(),
      vi.fn(async () => {
        throw new Error("odmowa");
      })
    );
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(copyButtons()[0]);

    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent(
      "Nie udało się skopiować do schowka"
    );
  });

  it("w trakcie składania przyciski są wyłączone", async () => {
    const results: ((v: ContextPackResult) => void)[] = [];
    const load = vi.fn(
      () =>
        new Promise<ContextPackResult>((r) => {
          results.push(r);
        })
    );
    const { user } = renderIt(load);
    await act(async () => results[0]({ ok: true, pack: PACK }));
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(copyButtons()[0]);
    expect(copyButtons()[0]).toBeDisabled();
    expect(copyButtons()[1]).toBeDisabled();

    await act(async () => results[1]({ ok: true, pack: PACK }));
    expect(copyButtons()[0]).toBeEnabled();
  });

  it("zmiana projektu w trakcie składania: schowek nietknięty", async () => {
    const resolvers: ((v: ContextPackResult) => void)[] = [];
    const load = vi.fn(
      () =>
        new Promise<ContextPackResult>((r) => {
          resolvers.push(r);
        })
    );
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const view = render(<Harness load={load} id="a" />);
    await act(async () => resolvers[0]({ ok: true, pack: PACK }));
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(copyButtons()[0]);
    view.rerender(<Harness load={load} id="b" />);
    await act(async () => resolvers[1]({ ok: true, pack: PACK }));

    expect(writeText).not.toHaveBeenCalled();
  });

  it("podgląd Markdown przełącza surowy tekst", async () => {
    const { user } = renderIt(okLoad());
    await screen.findByText("3 200 / 4 000 tokenów");

    await user.click(screen.getByRole("button", { name: "Podgląd Markdown" }));
    expect(document.querySelector(".prj-pack-card__preview")).toHaveTextContent("## Save State");
    await user.click(screen.getByRole("button", { name: "Ukryj podgląd" }));
    expect(document.querySelector(".prj-pack-card__preview")).toBeNull();
  });
});
