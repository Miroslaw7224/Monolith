import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { TaskColumn } from "@/src/features/tasks/TaskColumn";
import type { Task } from "@/src/features/tasks/TasksSection";

afterEach(cleanup);

const task: Task = {
  id: "a",
  title: "Alpha",
  link: "",
  description: "",
  status: "todo",
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function props(over: Partial<React.ComponentProps<typeof TaskColumn>> = {}) {
  const noop = vi.fn();
  return {
    status: "todo" as const,
    title: "Do zrobienia",
    tasks: [task],
    collapseEnabled: true,
    isDragOverColumn: false,
    dragTaskId: null,
    dragOverTaskId: null,
    draggable: true,
    editingId: null,
    editTitle: "",
    labels: {
      startDateLabel: "Start",
      deadlineLabel: "Do",
      showMore: () => "więcej",
      showLess: "mniej",
    },
    projectsById: new Map(),
    formatDate: () => "",
    onColumnDragOver: noop,
    onColumnDrop: noop,
    onDragStart: noop,
    onDragOverTask: noop,
    onDragEnd: noop,
    onDropOnTask: noop,
    onTitleAreaClick: noop,
    onTitleAreaDoubleClick: noop,
    onEditTitleChange: noop,
    onEditTitleCommit: noop,
    onEditTitleCancel: noop,
    onDueDateChange: noop,
    onToggleEnergy: noop,
    onToggleUrgent: noop,
    now: new Date(),
    onDelete: noop,
    columnCollapsed: false,
    onToggleColumn: vi.fn(),
    listHeight: undefined,
    onListHeightChange: vi.fn(),
    ...over,
  };
}

describe("TaskColumn: zwijanie i wysokość", () => {
  it("przycisk zwijania woła onToggleColumn(status, true)", () => {
    const p = props();
    render(<TaskColumn {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Zwiń kolumnę" }));
    expect(p.onToggleColumn).toHaveBeenCalledWith("todo", true);
  });

  it("zwinięta kolumna pokazuje nazwę i liczbę, chowa karty i oferuje rozwinięcie", () => {
    const p = props({ columnCollapsed: true });
    render(<TaskColumn {...p} />);
    expect(screen.getByText("Do zrobienia")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rozwiń kolumnę" }));
    expect(p.onToggleColumn).toHaveBeenCalledWith("todo", false);
  });

  it("zwinięta kolumna nadal przyjmuje upuszczenie", () => {
    const p = props({ columnCollapsed: true });
    const { container } = render(<TaskColumn {...p} />);
    fireEvent.drop(container.querySelector(".zad-column")!);
    expect(p.onColumnDrop).toHaveBeenCalledWith("todo");
  });

  it("własna wysokość listy ustawia style.height, a ↺ przywraca automatyczną", () => {
    const p = props({ listHeight: 300 });
    const { container } = render(<TaskColumn {...p} />);
    expect(container.querySelector(".zad-column__list")).toHaveStyle({ height: "300px" });
    fireEvent.click(screen.getByRole("button", { name: "Przywróć automatyczną wysokość" }));
    expect(p.onListHeightChange).toHaveBeenCalledWith("todo", null);
  });

  it("bez własnej wysokości nie ma przycisku ↺", () => {
    render(<TaskColumn {...props()} />);
    expect(
      screen.queryByRole("button", { name: "Przywróć automatyczną wysokość" })
    ).not.toBeInTheDocument();
  });

  describe("uchwyt wysokości", () => {
    const rect = (h: number) =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        height: h,
      } as DOMRect);
    const ptr = (type: string, clientY: number) => new MouseEvent(type, { bubbles: true, clientY });
    afterEach(() => vi.restoreAllMocks());

    it("przeciągnięcie zmienia wysokość na żywo i zapisuje ją po puszczeniu", () => {
      rect(200);
      const p = props();
      const { container } = render(<TaskColumn {...p} />);
      const handle = screen.getByRole("separator", { name: "Zmień wysokość kolumny" });
      fireEvent(handle, ptr("pointerdown", 100));
      fireEvent(handle, ptr("pointermove", 160));
      expect(container.querySelector(".zad-column__list")).toHaveStyle({ height: "260px" });
      expect(p.onListHeightChange).not.toHaveBeenCalled();
      fireEvent(handle, ptr("pointerup", 160));
      expect(p.onListHeightChange).toHaveBeenCalledWith("todo", 260);
    });

    it("strzałki zmieniają wysokość o 40 px, dwuklik przywraca automatyczną", () => {
      rect(200);
      const p = props();
      render(<TaskColumn {...p} />);
      const handle = screen.getByRole("separator", { name: "Zmień wysokość kolumny" });
      fireEvent.keyDown(handle, { key: "ArrowDown" });
      expect(p.onListHeightChange).toHaveBeenLastCalledWith("todo", 240);
      fireEvent.keyDown(handle, { key: "ArrowUp" });
      expect(p.onListHeightChange).toHaveBeenLastCalledWith("todo", 160);
      fireEvent.doubleClick(handle);
      expect(p.onListHeightChange).toHaveBeenLastCalledWith("todo", null);
    });

    it("zwinięta kolumna nie ma uchwytu", () => {
      render(<TaskColumn {...props({ columnCollapsed: true })} />);
      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });
  });
});
