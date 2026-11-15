import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ActivityLog } from "@/src/components/sessions/ActivityLog";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

function emptyEventsFetch() {
  return vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
}

describe("ActivityLog po angielsku", () => {
  test("przycisk startu sesji EN / PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(
      <ActivityLog
        apiFetch={emptyEventsFetch()}
        userTags={[]}
        activeSession={null}
        onStartSession={vi.fn()}
      />
    );
    expect(screen.getByText("Start work")).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByText("Rozpocznij pracę")).toBeInTheDocument();
  });
});
