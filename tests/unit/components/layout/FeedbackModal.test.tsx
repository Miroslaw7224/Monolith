import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { FeedbackModal } from "@/src/components/layout/FeedbackModal";

beforeEach(() => cleanup());

test("PL: okno „Feedback”, przycisk „Zamknij” zamyka", () => {
  const onClose = vi.fn();
  render(<FeedbackModal onClose={onClose} />);
  expect(screen.getByRole("dialog", { name: "Feedback" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("EN: przycisk „Close”", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(<FeedbackModal onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  expect(screen.getByTitle("Feedback – Monolith BETA")).toBeInTheDocument();
});
