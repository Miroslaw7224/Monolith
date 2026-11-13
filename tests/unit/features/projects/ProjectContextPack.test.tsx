import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextPackResult } from "@/src/features/projects/mutation";
import { ProjectContextPack } from "@/src/features/projects/ProjectContextPack";

afterEach(() => cleanup());

const PACK = { markdown: "# P", approxTokens: 3200, truncated: false, warnings: [] as string[] };

function renderIt(
  onLoad: () => Promise<ContextPackResult>,
  writeText: (text: string) => Promise<void> = vi.fn(async () => {})
) {
  const user = userEvent.setup();
  // `userEvent.setup()` podstawia własny schowek, więc stub ustawiamy dopiero po nim.
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<ProjectContextPack onLoad={onLoad} />);
  return { user, writeText };
}

const button = () => screen.getByRole("button", { name: "Kopiuj paczkę kontekstu" });

describe("ProjectContextPack", () => {
  it("kopiuje markdown i pokazuje liczbę tokenów", async () => {
    const onLoad = vi.fn(async (): Promise<ContextPackResult> => ({ ok: true, pack: PACK }));
    const { user, writeText } = renderIt(onLoad);

    await user.click(button());

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("# P");
    expect(
      await screen.findByText("Skopiowano paczkę kontekstu (~3,2 tys. tokenów)")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("skrócona paczka i ostrzeżenia", async () => {
    const onLoad = vi.fn(
      async (): Promise<ContextPackResult> => ({
        ok: true,
        pack: { ...PACK, truncated: true, warnings: ["a", "b"] },
      })
    );
    const { user } = renderIt(onLoad);

    await user.click(button());

    expect(
      await screen.findByText(
        "Skopiowano paczkę kontekstu (~3,2 tys. tokenów) · skrócona do budżetu"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("a · b")).toBeInTheDocument();
  });

  it("błąd pobierania: alert, schowek nietknięty", async () => {
    const onLoad = vi.fn(
      async (): Promise<ContextPackResult> => ({ ok: false, error: "HTTP 404" })
    );
    const { user, writeText } = renderIt(onLoad);

    await user.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 404");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("błąd schowka: alert", async () => {
    const onLoad = vi.fn(async (): Promise<ContextPackResult> => ({ ok: true, pack: PACK }));
    const { user } = renderIt(
      onLoad,
      vi.fn(async () => {
        throw new Error("odmowa");
      })
    );

    await user.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się skopiować do schowka"
    );
  });

  it("w trakcie ładowania przycisk jest wyłączony", async () => {
    let resolve!: (value: ContextPackResult) => void;
    const onLoad = vi.fn(
      () =>
        new Promise<ContextPackResult>((r) => {
          resolve = r;
        })
    );
    const { user } = renderIt(onLoad);

    await user.click(button());
    expect(button()).toBeDisabled();

    await act(async () => {
      resolve({ ok: true, pack: PACK });
    });
    expect(button()).toBeEnabled();
  });

  it("nowe kliknięcie czyści poprzedni komunikat", async () => {
    const results: ContextPackResult[] = [
      { ok: false, error: "HTTP 500" },
      { ok: true, pack: PACK },
    ];
    const onLoad = vi.fn(async () => results.shift() as ContextPackResult);
    const { user } = renderIt(onLoad);

    await user.click(button());
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(button());
    expect(await screen.findByText(/Skopiowano paczkę kontekstu/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
