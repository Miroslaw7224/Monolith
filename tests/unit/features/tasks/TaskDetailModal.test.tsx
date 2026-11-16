import React from "react";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";

import { TaskDetailModal } from "@/src/features/tasks/TaskDetailModal";
import type { Task } from "@/src/features/tasks/TasksSection";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const fakeTask: Task = {
  id: "task-1",
  title: "Napisać testy",
  link: "https://example.com",
  description: "Opis zadania",
  status: "todo",
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const PROJECTS = [
  { id: "monolith", name: "Monolith" },
  { id: "career-guide", name: "Career Guide" },
];

describe("TaskDetailModal", () => {
  let onPatch: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPatch = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
  });

  const renderModal = (task = fakeTask, extra: { projects?: typeof PROJECTS } = {}) =>
    render(<TaskDetailModal task={task} isOpen onClose={onClose} onPatch={onPatch} {...extra} />);

  it("pokazuje tytuł, link i notatkę", () => {
    renderModal();
    expect(screen.getByDisplayValue("Napisać testy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Opis zadania")).toBeInTheDocument();
  });

  it("nie renderuje się, gdy zamknięty albo bez zadania", () => {
    const { unmount } = render(
      <TaskDetailModal task={fakeTask} isOpen={false} onClose={onClose} onPatch={onPatch} />
    );
    expect(screen.queryByDisplayValue("Napisać testy")).not.toBeInTheDocument();
    unmount();
    render(<TaskDetailModal task={null} isOpen onClose={onClose} onPatch={onPatch} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("nie ma przycisku „Zapisz”; „Zamknij” (ikona i stopka) zamyka", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByRole("button", { name: /^zapisz$/i })).not.toBeInTheDocument();
    const closeBtns = screen.getAllByRole("button", { name: "Zamknij" });
    await user.click(closeBtns[0]);
    await user.click(closeBtns[closeBtns.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("autozapis notatki: jeden zapis 1,5 s po ostatniej zmianie, tylko to pole", async () => {
    vi.useFakeTimers();
    renderModal();
    fireEvent.change(screen.getByLabelText("Notatka"), { target: { value: "Opis zadaniaX" } });
    expect(onPatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith("task-1", { description: "Opis zadaniaX" });
    expect(screen.getByText("Zapisano")).toBeInTheDocument();
  });

  it("zamknięcie modala zapisuje oczekującą zmianę (flush)", async () => {
    vi.useFakeTimers();
    const { rerender } = renderModal();
    fireEvent.change(screen.getByLabelText("Notatka"), { target: { value: "Opis zadaniaY" } });
    rerender(
      <TaskDetailModal task={fakeTask} isOpen={false} onClose={onClose} onPatch={onPatch} />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onPatch).toHaveBeenCalledWith("task-1", { description: "Opis zadaniaY" });
  });

  it("pusty tytuł nie jest zapisywany i pokazuje błąd", async () => {
    vi.useFakeTimers();
    renderModal();
    fireEvent.change(screen.getByDisplayValue("Napisać testy"), { target: { value: "" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByText("Tytuł nie może być pusty")).toBeInTheDocument();
  });

  it("status zapisuje się od razu jednopolowym patchem", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "W toku" }));
    expect(onPatch).toHaveBeenCalledWith("task-1", { status: "in_progress" });
    await user.click(screen.getByRole("button", { name: "Odłożone" }));
    expect(onPatch).toHaveBeenLastCalledWith("task-1", { status: "deferred" });
  });

  it("nieudany zapis statusu cofa wybór w polu", async () => {
    const user = userEvent.setup();
    onPatch.mockRejectedValue(new Error("HTTP 500"));
    renderModal();
    await user.click(screen.getByRole("button", { name: "W toku" }));
    expect(await screen.findByText(/Nie zapisano/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "W toku" })).not.toHaveClass(
      "zad-status-btn--active"
    );
    expect(screen.getByRole("button", { name: "Do zrobienia" })).toHaveClass(
      "zad-status-btn--active"
    );
  });

  it("odhaczenie punktu checklisty zapisuje opis autozapisem", async () => {
    vi.useFakeTimers();
    renderModal({ ...fakeTask, description: "- [ ] T-01\n- [ ] T-02" });
    fireEvent.click(screen.getAllByRole("button", { name: /^Do sprawdzenia:/ })[0]);
    expect(onPatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onPatch).toHaveBeenCalledWith("task-1", { description: "- [x] T-01\n- [ ] T-02" });
  });

  it("błąd zapisu pokazuje komunikat", async () => {
    vi.useFakeTimers();
    onPatch.mockRejectedValue(new Error("HTTP 500"));
    renderModal();
    fireEvent.change(screen.getByLabelText("Notatka"), { target: { value: "Opis zadaniaZ" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText(/Nie zapisano/)).toBeInTheDocument();
  });

  it("tytuł okna z tłumaczeń", () => {
    renderModal();
    expect(screen.getByText("Zadanie")).toBeInTheDocument();
  });

  describe("projekt zadania", () => {
    it("zapisuje wybrany projekt od razu", async () => {
      const user = userEvent.setup();
      renderModal(fakeTask, { projects: PROJECTS });
      const select = screen.getByLabelText("Projekt");
      expect(select).toHaveValue("");
      await user.selectOptions(select, "monolith");
      expect(onPatch).toHaveBeenCalledWith("task-1", { project: "monolith" });
    });

    it("„Bez projektu” zdejmuje projekt (null)", async () => {
      const user = userEvent.setup();
      renderModal({ ...fakeTask, project: "monolith" }, { projects: PROJECTS });
      const select = screen.getByLabelText("Projekt");
      expect(select).toHaveValue("monolith");
      await user.selectOptions(select, "");
      expect(onPatch).toHaveBeenCalledWith("task-1", { project: null });
    });

    it("nieznane id projektu zostaje wybrane i nie jest wysyłane bez zmiany", async () => {
      renderModal({ ...fakeTask, project: "usuniety-projekt" }, { projects: PROJECTS });
      expect(screen.getByLabelText("Projekt")).toHaveValue("usuniety-projekt");
      expect(onPatch).not.toHaveBeenCalled();
    });
  });
});
