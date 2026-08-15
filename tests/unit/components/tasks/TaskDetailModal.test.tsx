import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";

import { TaskDetailModal } from "@/src/components/TaskDetailModal";

afterEach(() => cleanup());

const fakeTask = {
  id: "task-1",
  title: "Napisać testy",
  link: "https://example.com",
  description: "Opis zadania",
  status: "todo" as const,
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeT = {
  calendarCancel: "Zamknij",
  tasksDetailSave: "Zapisz",
  tasksDetailSaving: "…",
  tasksDetailLinkLabel: "Link",
  tasksDetailLinkPlaceholder: "https://…",
  tasksDetailNoteLabel: "Notatka",
  tasksDetailNotePlaceholder: "",
  tasksDetailTitleFieldLabel: "Tytuł",
  tasksDetailModalTitle: "Szczegóły zadania",
  tasksDetailStatusLabel: "Status",
  tasksTodo: "Do zrobienia",
  tasksInProgress: "W trakcie",
  tasksToReview: "Do sprawdzenia",
  tasksDone: "Zrobione",
  tasksDeadlineLabel: "Termin",
};

describe("TaskDetailModal", () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
    vi.clearAllMocks();
  });

  it("renders task title, link and note", () => {
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    expect(screen.getByDisplayValue("Napisać testy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Opis zadania")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <TaskDetailModal task={fakeTask} isOpen={false} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    expect(screen.queryByDisplayValue("Napisać testy")).not.toBeInTheDocument();
  });

  it("does not render when task is null", () => {
    render(
      <TaskDetailModal task={null} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when the X icon button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    // There are two "Zamknij" buttons: the icon button (aria-label) and the footer text button
    const closeBtns = screen.getAllByRole("button", { name: /zamknij/i });
    // The first one is the icon button in the header
    await user.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the cancel text button in footer is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    // There are two "Zamknij" buttons: the icon button (aria-label) and the footer text button
    const closeBtns = screen.getAllByRole("button", { name: /zamknij/i });
    // The last one is the footer cancel button with text content
    await user.click(closeBtns[closeBtns.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSave with updated title when saved", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );

    const titleInput = screen.getByDisplayValue("Napisać testy");
    await user.clear(titleInput);
    await user.type(titleInput, "Nowy tytuł");

    const saveBtn = screen.getByRole("button", { name: /zapisz/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Nowy tytuł" }));
  });

  it("calls onSave with current link and note when saved", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );

    const saveBtn = screen.getByRole("button", { name: /zapisz/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Napisać testy",
        link: "https://example.com",
        description: "Opis zadania",
        status: "todo",
        due_date: null,
      })
    );
  });

  it("disables save button when title is empty", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );

    const titleInput = screen.getByDisplayValue("Napisać testy");
    await user.clear(titleInput);

    const saveBtn = screen.getByRole("button", { name: /zapisz/i });
    expect(saveBtn).toBeDisabled();
  });

  it("disables save button when title is only whitespace", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );

    const titleInput = screen.getByDisplayValue("Napisać testy");
    await user.clear(titleInput);
    await user.type(titleInput, "   ");

    const saveBtn = screen.getByRole("button", { name: /zapisz/i });
    expect(saveBtn).toBeDisabled();
  });

  it("allows changing status via status buttons", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );

    const inProgressBtn = screen.getByRole("button", { name: "W trakcie" });
    await user.click(inProgressBtn);

    const saveBtn = screen.getByRole("button", { name: /zapisz/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
  });

  it("renders the modal title from translations", () => {
    render(
      <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
    );
    expect(screen.getByText("Szczegóły zadania")).toBeInTheDocument();
  });
});
