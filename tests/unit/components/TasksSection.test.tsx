import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { TasksSection } from "@/src/components/TasksSection";
import { translations } from "@/src/translations";

const apiFetch = vi.fn();
const t = translations.pl;

beforeEach(() => {
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
