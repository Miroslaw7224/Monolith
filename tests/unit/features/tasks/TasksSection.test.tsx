import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TasksSection } from "@/src/features/tasks/TasksSection";
import { translations } from "@/src/translations";

const apiFetch = vi.fn();
const t = translations.pl;

afterEach(cleanup);

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string) => {
    if (url === "/api/tasks") {
      return {
        ok: true,
        json: async () => [
          {
            id: "a",
            title: "Alpha",
            link: "",
            description: "",
            status: "todo",
            due_date: null,
            priority: null,
          },
          {
            id: "b",
            title: "Beta",
            link: "",
            description: "",
            status: "done",
            due_date: null,
            priority: null,
          },
        ],
      };
    }
    return { ok: true, json: async () => [] };
  });
});

test("places each task in the column for its status", async () => {
  render(<TasksSection apiFetch={apiFetch} lang="pl" t={t} />);

  const todo = await screen.findByRole("heading", { name: /Do zrobienia/ });
  const done = screen.getByRole("heading", { name: /Zrobione/ });

  expect(todo.parentElement).toHaveTextContent("Alpha");
  expect(todo.parentElement).not.toHaveTextContent("Beta");
  expect(done.parentElement).toHaveTextContent("Beta");
  expect(done.parentElement).not.toHaveTextContent("Alpha");
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith("/api/tasks");
  });
});

test("przycisk „Pilne” na karcie ustawia i zdejmuje priorytet 1", async () => {
  render(<TasksSection apiFetch={apiFetch} lang="pl" t={t} />);
  await screen.findByText("Alpha");

  const column = screen.getByRole("heading", { name: /Do zrobienia/ }).parentElement!;
  const urgentBtn = within(column).getByRole("button", { name: "Pilne" });
  expect(urgentBtn).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(urgentBtn);

  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/tasks/a",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ priority: 1 }) })
    );
  });
  await waitFor(() => {
    expect(within(column).getByRole("button", { name: "Pilne" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  fireEvent.click(within(column).getByRole("button", { name: "Pilne" }));
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/tasks/a",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ priority: null }) })
    );
  });
});

test("„Pilne” w pasku dodawania tworzy zadanie z priorytetem 1", async () => {
  render(<TasksSection apiFetch={apiFetch} lang="pl" t={t} />);
  await screen.findByText("Alpha");

  fireEvent.change(screen.getByLabelText(t.tasksDetailTitleFieldLabel as string), {
    target: { value: "Nowe" },
  });
  const barUrgent = document.querySelector<HTMLButtonElement>(".zad-cli .zad-urgent-btn")!;
  fireEvent.click(barUrgent);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(t.tasksAdd as string) }));

  await waitFor(() => {
    const call = apiFetch.mock.calls.find(
      ([url, opts]) => url === "/api/tasks" && opts?.method === "POST"
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body)).toMatchObject({ title: "Nowe", priority: 1 });
  });
});

test("odłożone zadanie trafia do pierwszej kolumny „Odłożone”", async () => {
  apiFetch.mockImplementation(async (url: string) => {
    if (url === "/api/tasks") {
      return {
        ok: true,
        json: async () => [
          {
            id: "a",
            title: "Alpha",
            link: "",
            description: "",
            status: "todo",
            due_date: null,
            priority: null,
          },
          {
            id: "p",
            title: "Kurs Playwright",
            link: "",
            description: "",
            status: "deferred",
            due_date: null,
            priority: null,
          },
        ],
      };
    }
    return { ok: true, json: async () => [] };
  });
  render(<TasksSection apiFetch={apiFetch} lang="pl" t={t} />);

  const deferred = await screen.findByRole("heading", { name: /Odłożone/ });
  const todo = screen.getByRole("heading", { name: /Do zrobienia/ });

  expect(deferred.parentElement).toHaveTextContent("Kurs Playwright");
  expect(deferred.parentElement).not.toHaveTextContent("Alpha");
  expect(todo.parentElement).not.toHaveTextContent("Kurs Playwright");
  const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
  expect(headings.findIndex((h) => /Odłożone/.test(h))).toBeLessThan(
    headings.findIndex((h) => /Do zrobienia/.test(h))
  );
  // licznik aktywnych nie liczy odłożonych (D5): tylko „Alpha”
  expect(screen.getByText(/1 zadań aktywnych/)).toBeInTheDocument();
});
