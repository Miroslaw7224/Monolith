import React from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { setLanguage } from "@/src/i18n";

beforeEach(() => cleanup());

test("renders 5 nav tabs", () => {
  render(
    <MobileNav
      appMode="home"
      setAppMode={vi.fn()}
      planningTab="tasks"
      setPlanningTab={vi.fn()}
      onMoreOpen={vi.fn()}
    />
  );
  expect(screen.getByLabelText("Home")).toBeInTheDocument();
  expect(screen.getByLabelText("Zadania")).toBeInTheDocument();
  expect(screen.getByLabelText("Notatki")).toBeInTheDocument();
  expect(screen.getByLabelText("Kalendarz")).toBeInTheDocument();
  expect(screen.getByLabelText("Więcej")).toBeInTheDocument();
});

test("calls setAppMode with 'home' when Home tab clicked", () => {
  const setAppMode = vi.fn();
  render(
    <MobileNav
      appMode="planowanie"
      setAppMode={setAppMode}
      planningTab="tasks"
      setPlanningTab={vi.fn()}
      onMoreOpen={vi.fn()}
    />
  );
  fireEvent.click(screen.getByLabelText("Home"));
  expect(setAppMode).toHaveBeenCalledWith("home");
});

test("navigates to notes tab", () => {
  const setAppMode = vi.fn();
  const setPlanningTab = vi.fn();
  render(
    <MobileNav
      appMode="home"
      setAppMode={setAppMode}
      planningTab="tasks"
      setPlanningTab={setPlanningTab}
      onMoreOpen={vi.fn()}
    />
  );
  fireEvent.click(screen.getByLabelText("Notatki"));
  expect(setPlanningTab).toHaveBeenCalledWith("notes");
  expect(setAppMode).toHaveBeenCalledWith("planowanie");
});

test("po angielsku etykiety zakładek są angielskie", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(
    <MobileNav
      appMode="home"
      setAppMode={vi.fn()}
      planningTab="tasks"
      setPlanningTab={vi.fn()}
      onMoreOpen={vi.fn()}
    />
  );
  expect(screen.getByLabelText("Home")).toBeInTheDocument();
  expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
  expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
  expect(screen.getByLabelText("More")).toBeInTheDocument();
});
