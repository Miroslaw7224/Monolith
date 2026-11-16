import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeSyncMarker, ProjectCodeSync } from "@/src/features/projects/ProjectCodeSync";

afterEach(cleanup);

const HEAD = "abcdef1234567890abcdef1234567890abcdef12";
const ok = { ok: true } as const;

describe("CodeSyncMarker", () => {
  it("behind pokazuje liczbę commitów", () => {
    render(<CodeSyncMarker sync={{ status: "behind", ahead: 3, head: HEAD }} />);
    expect(screen.getByText("kod nowszy (commity: 3)")).toBeTruthy();
  });
  it("diverged i unknown-sha mają osobne napisy", () => {
    render(<CodeSyncMarker sync={{ status: "diverged", head: HEAD }} />);
    expect(screen.getByText("historia repo zmieniona")).toBeTruthy();
    cleanup();
    render(<CodeSyncMarker sync={{ status: "unknown-sha" }} />);
    expect(screen.getByText("sha poza repo")).toBeTruthy();
  });
  it.each([undefined, { status: "current", head: HEAD }, { status: "no-baseline" }] as const)(
    "bez znacznika dla %j",
    (sync) => {
      const { container } = render(<CodeSyncMarker sync={sync} />);
      expect(container.textContent).toBe("");
    }
  );
});

describe("ProjectCodeSync", () => {
  it("behind: opis ze skróconym HEAD, przycisk wysyła pełny head", async () => {
    const onMark = vi.fn().mockResolvedValue(ok);
    render(
      <ProjectCodeSync
        sync={{ status: "behind", ahead: 2, head: HEAD }}
        onMark={onMark}
        onShowPack={() => {}}
      />
    );
    expect(screen.getByText(/commity: 2, HEAD abcdef1/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect(onMark).toHaveBeenCalledWith(HEAD);
  });

  it("no-baseline: przycisk wysyła undefined (serwer weźmie HEAD)", async () => {
    const onMark = vi.fn().mockResolvedValue(ok);
    render(
      <ProjectCodeSync sync={{ status: "no-baseline" }} onMark={onMark} onShowPack={() => {}} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect(onMark).toHaveBeenCalledWith(undefined);
  });

  it("current: tekst o zgodności, bez przycisku „Oznacz”", () => {
    render(
      <ProjectCodeSync
        sync={{ status: "current", head: HEAD }}
        onMark={vi.fn()}
        onShowPack={() => {}}
      />
    );
    expect(screen.getByText("Karta zgadza się z HEAD (abcdef1).")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Oznacz jako zaktualizowaną" })).toBeNull();
  });

  it("przycisk paczki woła onShowPack; uwaga o zacommitowanych zmianach jest zawsze", async () => {
    const onShowPack = vi.fn();
    render(
      <ProjectCodeSync
        sync={{ status: "behind", ahead: 1, head: HEAD }}
        onMark={vi.fn()}
        onShowPack={onShowPack}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Pokaż paczkę „odśwież kartę”" }));
    expect(onShowPack).toHaveBeenCalled();
    expect(screen.getByText("Wykrywamy tylko zacommitowane zmiany.")).toBeTruthy();
  });

  it("błąd zapisu pokazuje komunikat", async () => {
    const onMark = vi.fn().mockResolvedValue({ ok: false, error: "Konflikt", conflict: true });
    render(
      <ProjectCodeSync
        sync={{ status: "diverged", head: HEAD }}
        onMark={onMark}
        onShowPack={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Konflikt");
  });

  it("brak sync (jeszcze nie policzono): nic nie renderuje", () => {
    const { container } = render(
      <ProjectCodeSync sync={undefined} onMark={vi.fn()} onShowPack={() => {}} />
    );
    expect(container.textContent).toBe("");
  });
});
