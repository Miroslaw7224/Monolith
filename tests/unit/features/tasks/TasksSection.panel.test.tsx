import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TasksSection } from "@/src/features/tasks/TasksSection";

const apiFetch = vi.fn();

function stubWidth(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
    if (url === "/api/tasks" && opts?.method === "POST") {
      const body = JSON.parse(opts.body as string);
      return { ok: true, json: async () => ({ id: "n1", status: "todo", ...body }) };
    }
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
            description: "Wstęp\n- [x] T-01\n  > ok\n- [!] T-02",
            status: "todo",
            due_date: "2026-11-20",
            priority: 1,
            project: "monolith",
          },
        ],
      };
    }
    if (url === "/api/projects") return { ok: true, json: async () => ({ projects: [] }) };
    return { ok: true, json: async () => [] };
  });
});

test("od 1024 px dwuklik otwiera panel, nie modal", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  expect(await screen.findByRole("complementary", { name: "Panel zadania" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("poniżej 1024 px dwuklik otwiera modal", async () => {
  stubWidth(false);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

test("dwuklik innej karty przełącza panel i zapisuje poprzednią zmianę (flush)", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  const panel = await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.change(within(panel).getByLabelText("Notatka"), { target: { value: "zmiana" } });
  fireEvent.doubleClick(screen.getAllByText("Beta")[0]);
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/tasks/a",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: "zmiana" }) })
    )
  );
  await waitFor(() =>
    expect(within(screen.getByRole("complementary")).getByDisplayValue("Beta")).toBeInTheDocument()
  );
});

test("w trybie roboczym Odłożone, W toku i Do sprawdzenia są w jednym stosie, a Zrobione zwinięte", async () => {
  stubWidth(true);
  const { container } = render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  await screen.findByRole("complementary");
  const stack = container.querySelector(".zad-stack");
  expect(stack).not.toBeNull();
  expect(stack!.querySelectorAll(".zad-column")).toHaveLength(3);
  expect(
    (container.querySelector(".zad-board") as HTMLElement).style.getPropertyValue("--zad-cols")
  ).toBe("1fr 1fr 2fr 3rem");
});

test("przycisk Zamknij zamyka panel", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  const panel = await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.click(within(panel).getAllByRole("button", { name: "Zamknij" })[0]);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

test("wyszukiwanie bez wyników nie zamyka otwartego panelu", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.change(screen.getByPlaceholderText("Szukaj zadań…"), {
    target: { value: "zzz-brak" },
  });
  expect(screen.getByRole("complementary", { name: "Panel zadania" })).toBeInTheDocument();
});

test("Kopiuj zadanie tworzy kopię z dopiskiem, wyzerowaną checklistą i skopiowanymi polami", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Beta"));
  const panel = await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.click(within(panel).getByRole("button", { name: "Kopiuj zadanie" }));
  fireEvent.change(within(panel).getByPlaceholderText("Dopisek (np. iPhone)"), {
    target: { value: "iPhone" },
  });
  fireEvent.click(within(panel).getByRole("button", { name: "Utwórz kopię" }));

  await waitFor(() => {
    const call = apiFetch.mock.calls.find(
      ([url, opts]) => url === "/api/tasks" && opts?.method === "POST"
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body)).toEqual({
      title: "Beta (iPhone)",
      link: "",
      description: "Wstęp\n- [ ] T-01\n- [ ] T-02",
      priority: 1,
      project: "monolith",
      due_date: "2026-11-20",
    });
  });
  expect(await screen.findByText("Beta (iPhone)")).toBeInTheDocument();
});
