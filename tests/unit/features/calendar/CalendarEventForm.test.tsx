import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CalendarEventForm } from "@/src/features/calendar/CalendarEventForm";

afterEach(() => cleanup());

const LINK = "https://meet.google.com/gon-fztr-zrn";

describe("CalendarEventForm: link do spotkania", () => {
  test("pole jest wypełnione z initial i trafia do onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <CalendarEventForm
        initial={{ date: "2026-11-18", title: "Career Guide", type: "meeting", link: LINK }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText("Meeting link")).toHaveValue(LINK);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: "Career Guide", link: LINK });
  });

  test("wpisany link jest przycinany, a wyczyszczony wysyła pusty tekst (usunięcie)", () => {
    const onSubmit = vi.fn();
    render(
      <CalendarEventForm
        initial={{ date: "2026-11-18", title: "X", link: LINK }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    const input = screen.getByLabelText("Meeting link");
    fireEvent.change(input, { target: { value: `  ${LINK}/x  ` } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[0][0].link).toBe(`${LINK}/x`);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[1][0].link).toBe("");
  });

  test("pod polem jest klikalny odnośnik, gdy link jest poprawnym http(s)", () => {
    render(
      <CalendarEventForm
        initial={{ date: "2026-11-18", title: "X", link: LINK }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const open = screen.getByRole("link", { name: /Open meeting/ });
    expect(open).toHaveAttribute("href", LINK);
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.change(screen.getByLabelText("Meeting link"), { target: { value: "to nie url" } });
    expect(screen.queryByRole("link", { name: /Open meeting/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Meeting link"), { target: { value: "" } });
    expect(screen.queryByRole("link", { name: /Open meeting/ })).not.toBeInTheDocument();
  });
});

describe("CalendarEventForm: brief spotkania", () => {
  test("pole jest wypełnione z initial i trafia do onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <CalendarEventForm
        initial={{ date: "2026-11-18", title: "Sync", type: "meeting", brief: "Punkt 1\nPunkt 2" }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText("Brief")).toHaveValue("Punkt 1\nPunkt 2");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[0][0].brief).toBe("Punkt 1\nPunkt 2");
  });

  test("brief jest przycinany, a wyczyszczony wysyła pusty tekst (usunięcie)", () => {
    const onSubmit = vi.fn();
    render(
      <CalendarEventForm
        initial={{ date: "2026-11-18", title: "Sync", brief: "x" }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    const field = screen.getByLabelText("Brief");
    fireEvent.change(field, { target: { value: "  Punkt\n " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[0][0].brief).toBe("Punkt");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit.mock.calls[1][0].brief).toBe("");
  });
});
