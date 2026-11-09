import React from "react";
import { Plus, Search, Settings2 } from "lucide-react";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskTemplatesModal } from "./TaskTemplatesModal";
import { TaskColumn } from "./tasks/TaskColumn";
import { useTasksBoard } from "./tasks/useTasksBoard";
import { TASK_STATUSES, tasksByStatus, type TaskStatus } from "./tasks/taskOrderUtils";

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-3xl flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="sm:w-44 flex-shrink-0">
              <label
                htmlFor="new-task-template"
                className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
              >
                {labels.templateLabel}
              </label>
              <select
                id="new-task-template"
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full px-3 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
              >
                <option value="">{labels.templateNone}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <label
                htmlFor="new-task-title"
                className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
              >
                {labels.titleField}
              </label>
              <input
                id="new-task-title"
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleNewTaskTitleKeyDown}
                placeholder={labels.titlePlaceholder}
                className="w-full px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)] outline-none"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label
                htmlFor="new-task-link"
                className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
              >
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
                className="w-full px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void addTask()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-xl text-base font-semibold flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              {(t.tasksAdd as string) ?? "Add"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setTemplatesModalOpen(true)}
            className="self-start flex items-center gap-2 text-sm text-[var(--text2)] hover:text-[var(--accent)] transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            {labels.manageTemplates}
          </button>
        </div>
        <div className="max-w-3xl mt-3 relative">
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
