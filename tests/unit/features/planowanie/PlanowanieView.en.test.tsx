import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PlanowanieView from "@/src/features/planowanie/PlanowanieView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

function listApiFetch() {
  return vi.fn(async () => ({
    ok: true,
    json: async () => [],
  })) as unknown as React.ComponentProps<typeof PlanowanieView>["apiFetch"];
}

describe("PlanowanieView po angielsku", () => {
  test("zakładka Kalendarz EN / PL", async () => {
    const setPlanningTab = vi.fn();
    const setAppMode = vi.fn();
    await act(async () => {
      await setLanguage("en");
    });
    render(
      <PlanowanieView
        apiFetch={listApiFetch()}
        appMode="planowanie"
        planningTab="calendar"
        setPlanningTab={setPlanningTab}
        setAppMode={setAppMode}
      />
    );
    expect(screen.getByRole("tab", { name: "Calendar" })).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByRole("tab", { name: "Kalendarz" })).toBeInTheDocument();
  });
});
