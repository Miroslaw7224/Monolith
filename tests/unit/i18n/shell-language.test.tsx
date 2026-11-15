import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { CardRail } from "@/src/features/cards/CardRail";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { ShellStatusBar } from "@/src/features/home/ShellStatusBar";

beforeEach(() => cleanup());

// zwykła funkcja (nie vi.fn): `resetMocks` czyści implementacje vi.fn przed każdym testem
const apiFetch = async () => ({ ok: false }) as Response;

function Shell() {
  return (
    <>
      <CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />
      <MobileNav
        appMode="home"
        setAppMode={vi.fn()}
        planningTab="tasks"
        setPlanningTab={vi.fn()}
        onMoreOpen={vi.fn()}
      />
      <ShellStatusBar apiFetch={apiFetch} refreshKey="kokpit" />
    </>
  );
}

describe("przełączenie języka w powłoce", () => {
  test("jedno kliknięcie PL/EN zmienia CardRail, MobileNav i pasek statusu", async () => {
    render(
      <I18nProvider>
        <Shell />
      </I18nProvider>
    );
    expect(await screen.findByRole("navigation", { name: "Karty" })).toBeInTheDocument();
    expect(screen.getByLabelText("Zadania")).toBeInTheDocument();
    expect(screen.getByLabelText("Pasek statusu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zmień język na angielski (EN)" }));

    expect(await screen.findByRole("navigation", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
