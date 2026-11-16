import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Task } from "./TasksSection";
import type { TaskTemplate } from "./TaskTemplatesModal";
import { matchTaskSearch, normalizeTaskFields } from "./taskInputUtils";
import { resetChecklist } from "./taskChecklist";
import { URGENT_PRIORITY } from "./taskPriorityUtils";
import { toggleTaskEnergy, type TaskEnergy } from "./taskEnergyUtils";
import { computeTaskOrderAfterDrop, type TaskStatus } from "./taskOrderUtils";
import type { ProjectSummaryDto } from "@/contexts/bc_projects/schemas";

/** Projekt z rejestru w zakresie potrzebnym do wyboru i koloru zadania. */
export type TaskProject = Pick<ProjectSummaryDto, "id" | "name" | "kind">;

/** Częściowa zmiana zadania wysyłana jednym `PUT /api/tasks/:id`. */
export type TaskPatch = Partial<{
  title: string;
  link: string;
  description: string;
  status: Task["status"];
  due_date: string | null;
  project: string | null;
}>;

export function useTasksBoard(apiFetch: (url: string, options?: RequestInit) => Promise<Response>) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskLink, setNewTaskLink] = useState("");
  const [newTaskUrgent, setNewTaskUrgent] = useState(false);
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const titleClickPendingRef = useRef<{
    taskId: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiFetch("/api/task-templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    }
  }, [apiFetch]);

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
    void fetchTemplates();
  }, [fetchTemplates]);

  // lista projektów tylko do koloru i wyboru w oknie zadania; błąd = zadania bez koloru
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { projects?: TaskProject[] }) => {
        if (!cancelled) setProjects(Array.isArray(data?.projects) ? data.projects : []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
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

  const saveTaskPatch = useCallback(
    async (id: string, patch: TaskPatch): Promise<void> => {
      const res = await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res && res.ok === false) throw new Error(`HTTP ${res.status}`);
      const { project, ...rest } = patch;
      setTasks((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                ...rest,
                ...(project !== undefined ? { project: project ?? undefined } : {}),
              }
            : x
        )
      );
    },
    [apiFetch]
  );

  /** Kopia zadania z dopiskiem: ten sam link, projekt, termin, priorytet; checklista wyzerowana. */
  const duplicateTask = useCallback(
    async (
      sourceId: string,
      suffix: string,
      current: { title: string; link: string; description: string }
    ): Promise<Task> => {
      const source = tasks.find((x) => x.id === sourceId);
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${current.title} (${suffix})`,
          link: current.link,
          description: resetChecklist(current.description),
          ...(source?.priority != null ? { priority: source.priority } : {}),
          ...(source?.project ? { project: source.project } : {}),
          ...(source?.due_date ? { due_date: source.due_date } : {}),
        }),
      });
      if (res && res.ok === false) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      const { link, description } = normalizeTaskFields(created);
      const task: Task = { ...created, link, description };
      setTasks((prev) => [task, ...prev]);
      return task;
    },
    [apiFetch, tasks]
  );

  const addTask = async () => {
    const title = newTaskTitle.trim();
    const link = newTaskLink.trim();
    if (!title) return;
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          link,
          description: "",
          ...(newTaskUrgent ? { priority: URGENT_PRIORITY } : {}),
        }),
      });
      const task = await res.json();
      const { link: normalizedLink, description: normalizedDescription } =
        normalizeTaskFields(task);
      setTasks((prev) => [
        { ...task, link: normalizedLink, description: normalizedDescription },
        ...prev,
      ]);
      setNewTaskTitle("");
      setNewTaskLink("");
      setNewTaskUrgent(false);
      setSelectedTemplateId("");
    } catch (err) {
      console.error("Add task failed", err);
    }
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = templates.find((x) => x.id === templateId);
    if (!tpl) return;
    setNewTaskTitle(tpl.title);
    setNewTaskLink(tpl.link ?? "");
    if (!(tpl.link ?? "").trim()) {
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  };

  const handleNewTaskTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (newTaskLink.trim()) {
      void addTask();
    } else {
      linkInputRef.current?.focus();
    }
  };

  const handleNewTaskLinkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void addTask();
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

  const toggleEnergy = async (id: string, energy: TaskEnergy) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const title = toggleTaskEnergy(task.title, energy);
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    } catch (err) {
      console.error("Update task energy failed", err);
    }
  };

  const toggleUrgent = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const priority = task.priority === URGENT_PRIORITY ? null : URGENT_PRIORITY;
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
    } catch (err) {
      console.error("Update task priority failed", err);
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

  return {
    tasks,
    loading,
    newTaskTitle,
    setNewTaskTitle,
    newTaskLink,
    setNewTaskLink,
    newTaskUrgent,
    setNewTaskUrgent,
    projects,
    templates,
    selectedTemplateId,
    templatesModalOpen,
    setTemplatesModalOpen,
    searchQuery,
    setSearchQuery,
    editingId,
    setEditingId,
    editTitle,
    setEditTitle,
    detailTaskId,
    setDetailTaskId,
    dragTaskId,
    setDragTaskId,
    dragOverColumn,
    setDragOverColumn,
    dragOverTaskId,
    setDragOverTaskId,
    linkInputRef,
    fetchTemplates,
    handleTitleAreaClick,
    handleTitleAreaDoubleClick,
    saveTaskPatch,
    duplicateTask,
    addTask,
    applyTemplate,
    handleNewTaskTitleKeyDown,
    handleNewTaskLinkKeyDown,
    updateTitle,
    toggleEnergy,
    toggleUrgent,
    deleteTask,
    isSearching,
    filteredTasks,
    canDrag,
    handleDragEnd,
    handleColumnDrop,
    handleDropOnTask,
    updateDueDate,
  };
}
