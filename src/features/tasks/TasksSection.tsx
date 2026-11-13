import React, { useMemo } from "react";
import { Plus, Search, Settings2 } from "lucide-react";
import "./tasks.css";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskTemplatesModal } from "./TaskTemplatesModal";
import { TaskColumn } from "./TaskColumn";
import { useTasksBoard } from "./useTasksBoard";
import { TASK_STATUSES, tasksByStatus, type TaskStatus } from "./taskOrderUtils";

export type { TaskDto as Task } from "@/contexts/bc_tasks/schemas";

type TranslationDict = Record<string, string | string[]>;

interface TasksSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
}

export function TasksSection({ apiFetch, lang, t }: TasksSectionProps) {
  const {
    tasks,
    loading,
    newTaskTitle,
    setNewTaskTitle,
    newTaskLink,
    setNewTaskLink,
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
    saveTaskDetail,
    addTask,
    applyTemplate,
    handleNewTaskTitleKeyDown,
    handleNewTaskLinkKeyDown,
    updateTitle,
    deleteTask,
    isSearching,
    filteredTasks,
    canDrag,
    handleDragEnd,
    handleColumnDrop,
    handleDropOnTask,
    updateDueDate,
  } = useTasksBoard(apiFetch);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US");
  };

  const labels = {
    titlePlaceholder: (t.tasksNewTitlePlaceholder as string) ?? "Task name…",
    titleField: (t.tasksDetailTitleFieldLabel as string) ?? "Title",
    linkLabel: (t.tasksDetailLinkLabel as string) ?? "Link",
    linkPlaceholder: (t.tasksDetailLinkPlaceholder as string) ?? "https://…",
    templateLabel: (t.tasksTemplateLabel as string) ?? "Template",
    templateNone: (t.tasksTemplateNone as string) ?? "No template",
    manageTemplates: (t.tasksManageTemplates as string) ?? "Manage templates",
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

  const dateSubtitle = useMemo(() => {
    const activeCount = tasks.filter((x) => x.status !== "done").length;
    const doneCount = tasks.filter((x) => x.status === "done").length;
    const today = new Date();
    const dateFormatted = today.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    if (lang === "pl") {
      return `${capitalizedDate} · ${activeCount} zadań aktywnych · ${doneCount} ukończonych`;
    }
    return `${capitalizedDate} · ${activeCount} active tasks · ${doneCount} completed`;
  }, [tasks, lang]);

  return (
    <div className="zad" data-card="zadania">
      <header className="zad-head">
        <div>
          <p className="zad-eyebrow">{lang === "pl" ? "Alt+3 · Zadania" : "Alt+3 · Tasks"}</p>
          <h1 className="zad-heading">{lang === "pl" ? "Zadania projektowe" : "Project Tasks"}</h1>
          <p className="zad-sub">{dateSubtitle}</p>
        </div>
        <div className="zad-head__actions">
          <button
            type="button"
            onClick={() => setTemplatesModalOpen(true)}
            className="zad-btn zad-btn--ghost"
          >
            <Settings2 className="w-4 h-4" />
            {labels.manageTemplates}
          </button>
        </div>
      </header>

      <div className="zad-toolbar">
        <div className="zad-cli">
          <span className="zad-cli__prompt" aria-hidden="true">
            &gt;
          </span>
          <div className="zad-cli__field">
            <label htmlFor="new-task-template" className="zad-sr-only">
              {labels.templateLabel}
            </label>
            <select
              id="new-task-template"
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="zad-cli__select"
              aria-label={labels.templateLabel}
            >
              <option value="">{labels.templateNone}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="new-task-title" className="zad-sr-only">
            {labels.titleField}
          </label>
          <input
            id="new-task-title"
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleNewTaskTitleKeyDown}
            placeholder={labels.titlePlaceholder}
            aria-label={labels.titleField}
            className="zad-cli__input"
          />

          <label htmlFor="new-task-link" className="zad-sr-only">
            {labels.linkLabel}
          </label>
          <input
            id="new-task-link"
            ref={linkInputRef}
            type="url"
            value={newTaskLink}
            onChange={(e) => setNewTaskLink(e.target.value)}
            onKeyDown={handleNewTaskLinkKeyDown}
            placeholder={labels.linkPlaceholder}
            aria-label={labels.linkLabel}
            className="zad-cli__input zad-cli__input--link"
          />

          <div className="zad-cli__meta">
            <kbd className="zad-kbd">Enter</kbd>
            <button
              type="button"
              onClick={() => void addTask()}
              className="zad-btn zad-btn--primary zad-btn--sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {(t.tasksAdd as string) ?? "Add"}
            </button>
          </div>
        </div>

        <div className="zad-search-bar">
          <Search className="zad-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className="zad-search-input"
          />
        </div>
      </div>

      <div className="zad-board-container">
        {loading ? (
          <p className="zad-state zad-state--loading">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="zad-state">{labels.noTasks}</p>
        ) : filteredTasks.length === 0 ? (
          <p className="zad-state">{labels.noSearchResults}</p>
        ) : (
          <div className="zad-board">
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
      <TaskTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        apiFetch={apiFetch}
        t={t}
        onTemplatesChange={() => void fetchTemplates()}
      />
    </div>
  );
}
