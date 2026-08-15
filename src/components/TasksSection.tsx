import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskColumn } from "./tasks/TaskColumn";
import { matchTaskSearch, normalizeTaskFields, parseTaskInput } from "./tasks/taskInputUtils";
import {
  computeTaskOrderAfterDrop,
  TASK_STATUSES,
  tasksByStatus,
  type TaskStatus,
} from "./tasks/taskOrderUtils";

export interface Task {
  id: string;
  title: string;
  link: string;
  description: string;
  status: "todo" | "in_progress" | "to_review" | "done";
  due_date: string | null;
  priority: number | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

type TranslationDict = Record<string, string | string[]>;

interface TasksSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
}

export function TasksSection({ apiFetch, lang, t }: TasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const titleClickPendingRef = useRef<{
    taskId: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US");
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setTasks(
            list.map((task: Task) => {
              const { link, description } = normalizeTaskFields(task);
              return { ...task, link, description };
            })
          );
        }
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    return () => {
      const p = titleClickPendingRef.current;
      if (p) clearTimeout(p.timer);
    };
  }, []);

  useEffect(() => {
    if (detailTaskId && !tasks.some((x) => x.id === detailTaskId)) {
      setDetailTaskId(null);
    }
  }, [detailTaskId, tasks]);

  const clearTitleClickPending = () => {
    const p = titleClickPendingRef.current;
    if (p) {
      clearTimeout(p.timer);
      titleClickPendingRef.current = null;
    }
  };

  const handleTitleAreaClick = (task: Task) => {
    clearTitleClickPending();
    const timer = setTimeout(() => {
      titleClickPendingRef.current = null;
      setEditingId(task.id);
      setEditTitle(task.title);
    }, 280);
    titleClickPendingRef.current = { taskId: task.id, timer };
  };

  const handleTitleAreaDoubleClick = (task: Task) => {
    clearTitleClickPending();
    setEditingId(null);
    setEditTitle("");
    setDetailTaskId(task.id);
  };

  const saveTaskDetail = async (payload: {
    title: string;
    link: string;
    description: string;
    status: Task["status"];
    due_date: string | null;
  }) => {
    if (!detailTaskId) return;
    try {
      await apiFetch(`/api/tasks/${detailTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          link: payload.link,
          description: payload.description,
          status: payload.status,
          due_date: payload.due_date,
        }),
      });
      setTasks((prev) =>
        prev.map((x) =>
          x.id === detailTaskId
            ? {
                ...x,
                title: payload.title,
                link: payload.link,
                description: payload.description,
                status: payload.status,
                due_date: payload.due_date,
              }
            : x
        )
      );
    } catch (err) {
      console.error("Save task detail failed", err);
    }
  };

  const addTask = async () => {
    const { title, link, description } = parseTaskInput(newTitle);
    if (!title) return;
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, link, description }),
      });
      const task = await res.json();
      const { link: normalizedLink, description: normalizedDescription } =
        normalizeTaskFields(task);
      setTasks((prev) => [
        { ...task, link: normalizedLink, description: normalizedDescription },
        ...prev,
      ]);
      setNewTitle("");
    } catch (err) {
      console.error("Add task failed", err);
    }
  };

  const handleNewTaskKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void addTask();
    }
  };

  const updateTitle = async (id: string) => {
    if (editingId !== id || editTitle.trim() === "") {
      setEditingId(null);
      return;
    }
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: editTitle.trim() } : t)));
      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      console.error("Update task failed", err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (detailTaskId === id) setDetailTaskId(null);
    } catch (err) {
      console.error("Delete task failed", err);
    }
  };

  const isSearching = searchQuery.trim().length > 0;
  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchTaskSearch(task, searchQuery)),
    [tasks, searchQuery]
  );
  const canDrag = !isSearching;

  const applyDrop = async (
    draggedId: string | null,
    targetStatus: TaskStatus,
    targetTaskId: string | null
  ) => {
    if (!draggedId || !canDrag) return;

    const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(
      tasks,
      draggedId,
      targetStatus,
      targetTaskId
    );

    setTasks((prev) => {
      const byId = new Map(prev.map((task) => [task.id, task]));
      const dragged = byId.get(draggedId);
      if (!dragged) return prev;
      if (statusChanged) {
        byId.set(draggedId, { ...dragged, status: targetStatus });
      }
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });

    try {
      if (statusChanged) {
        await apiFetch(`/api/tasks/${draggedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
      }
      await apiFetch("/api/tasks/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: orderedIds }),
      });
    } catch (err) {
      console.error("Task drop failed", err);
    }
  };

  const clearDragState = () => {
    setDragTaskId(null);
    setDragOverColumn(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    clearDragState();
  };

  const handleColumnDrop = (status: TaskStatus) => {
    void applyDrop(dragTaskId, status, null);
    clearDragState();
  };

  const handleDropOnTask = (targetTaskId: string, columnStatus: TaskStatus) => {
    void applyDrop(dragTaskId, columnStatus, targetTaskId);
    clearDragState();
  };

  const updateDueDate = async (id: string, due: string | null) => {
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: due }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: due } : t)));
    } catch (err) {
      console.error("Update task due_date failed", err);
    }
  };

  const labels = {
    addPlaceholder: (t.tasksNewPlaceholder as string) ?? "New task...",
    todo: (t.tasksTodo as string) ?? "To do",
    inProgress: (t.tasksInProgress as string) ?? "In progress",
    toReview: (t.tasksToReview as string) ?? "To review",
    done: (t.tasksDone as string) ?? "Done",
    noTasks: (t.tasksNoTasks as string) ?? "No tasks. Add your first.",
    startDateLabel: (t.tasksStartDateLabel as string) ?? "Start",
    deadlineLabel: (t.tasksDeadlineLabel as string) ?? "Due",
    searchPlaceholder: (t.tasksSearchPlaceholder as string) ?? "Search tasks…",
    noSearchResults: (t.tasksNoSearchResults as string) ?? "No tasks match your search.",
  };

  const columnLabels: Record<TaskStatus, string> = {
    todo: labels.todo,
    in_progress: labels.inProgress,
    to_review: labels.toReview,
    done: labels.done,
  };

  const cardLabels = {
    startDateLabel: labels.startDateLabel,
    deadlineLabel: labels.deadlineLabel,
    showMore: (count: number) =>
      ((t.tasksShowMore as string) ?? "Show {count} more").replace("{count}", String(count)),
    showLess: (t.tasksShowLess as string) ?? "Show less",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-2xl flex gap-2 items-start">
          <textarea
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleNewTaskKeyDown}
            placeholder={labels.addPlaceholder}
            rows={2}
            className="flex-1 px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)] resize-y min-h-[3.25rem]"
          />
          <button
            onClick={addTask}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-xl text-base font-semibold"
          >
            <Plus className="w-4 h-4" />
            {(t.tasksAdd as string) ?? "Add"}
          </button>
        </div>
        <div className="max-w-2xl mt-3 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)] pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg3)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 flex flex-col min-h-0">
        {loading ? (
          <div className="text-[var(--text2)] text-base">Loading…</div>
        ) : tasks.length === 0 ? (
          <p className="text-[var(--text3)] font-medium text-base">{labels.noTasks}</p>
        ) : filteredTasks.length === 0 ? (
          <p className="text-[var(--text3)] font-medium text-base">{labels.noSearchResults}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-w-0 w-full content-start">
            {TASK_STATUSES.map((status) => (
              <TaskColumn
                key={status}
                status={status}
                title={columnLabels[status]}
                tasks={tasksByStatus(filteredTasks, status)}
                lang={lang}
                collapseEnabled={!isSearching}
                isDragOverColumn={dragOverColumn === status && dragOverTaskId === null}
                dragTaskId={dragTaskId}
                dragOverTaskId={dragOverTaskId}
                draggable={canDrag}
                editingId={editingId}
                editTitle={editTitle}
                labels={cardLabels}
                formatDate={formatDate}
                onColumnDragOver={(s) => {
                  setDragOverColumn(s);
                  setDragOverTaskId(null);
                }}
                onColumnDrop={handleColumnDrop}
                onDragStart={setDragTaskId}
                onDragOverTask={(taskId) => {
                  setDragOverTaskId(taskId);
                  setDragOverColumn(status);
                }}
                onDragEnd={handleDragEnd}
                onDropOnTask={handleDropOnTask}
                onTitleAreaClick={handleTitleAreaClick}
                onTitleAreaDoubleClick={handleTitleAreaDoubleClick}
                onEditTitleChange={setEditTitle}
                onEditTitleCommit={updateTitle}
                onEditTitleCancel={() => {
                  setEditingId(null);
                  setEditTitle("");
                }}
                onDueDateChange={updateDueDate}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>
      <TaskDetailModal
        task={detailTaskId ? (tasks.find((x) => x.id === detailTaskId) ?? null) : null}
        isOpen={detailTaskId !== null}
        t={t}
        onClose={() => setDetailTaskId(null)}
        onSave={saveTaskDetail}
      />
    </div>
  );
}
