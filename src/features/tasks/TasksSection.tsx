import React, { useMemo, useState } from "react";
import { Plus, Search, Settings2 } from "lucide-react";
import "./tasks.css";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskWorkPanel } from "./TaskWorkPanel";
import { useMinWidth } from "./useMinWidth";
import { useBoardLayout } from "./useBoardLayout";
import { boardColumns, effectiveCollapsed } from "./taskBoardLayout";
import { TaskTemplatesModal } from "./TaskTemplatesModal";
import { TaskColumn } from "./TaskColumn";
import { TaskTiles } from "./TaskTiles";
import { computeTaskTiles, getTaskDueState } from "./taskStatsUtils";
import { getTaskEnergy, toggleTaskEnergy } from "./taskEnergyUtils";
import { useTasksBoard } from "./useTasksBoard";
import { TASK_STATUSES, tasksByStatus, type TaskStatus } from "./taskOrderUtils";
import { useT } from "@/src/i18n/useT";
import { useLang } from "@/src/i18n/useLang";
import { formatShortDate, formatFullDate } from "@/src/i18n/format";

export type { TaskDto as Task } from "@/contexts/bc_tasks/schemas";

interface TasksSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function TasksSection({ apiFetch }: TasksSectionProps) {
  const t = useT();
  const { lang } = useLang();
  const {
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
  } = useTasksBoard(apiFetch);

  const wide = useMinWidth(1024);
  const detailTask = detailTaskId ? (tasks.find((x) => x.id === detailTaskId) ?? null) : null;
  const panelOpen = wide && detailTask !== null;
  const mode = panelOpen ? "work" : "normal";
  const { layout, setCollapsed, setHeight } = useBoardLayout();
  const collapsedMap = effectiveCollapsed(layout, mode);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return formatShortDate(d, lang);
  };

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const labels = {
    titlePlaceholder: t("tasks:tasksNewTitlePlaceholder"),
    titleField: t("tasks:tasksDetailTitleFieldLabel"),
    linkLabel: t("tasks:tasksDetailLinkLabel"),
    linkPlaceholder: t("tasks:tasksDetailLinkPlaceholder"),
    templateLabel: t("tasks:tasksTemplateLabel"),
    templateNone: t("tasks:tasksTemplateNone"),
    manageTemplates: t("tasks:tasksManageTemplates"),
    deferred: t("tasks:tasksDeferred"),
    todo: t("tasks:tasksTodo"),
    inProgress: t("tasks:tasksInProgress"),
    toReview: t("tasks:tasksToReview"),
    done: t("tasks:tasksDone"),
    noTasks: t("tasks:tasksNoTasks"),
    startDateLabel: t("tasks:tasksStartDateLabel"),
    deadlineLabel: t("tasks:tasksDeadlineLabel"),
    searchPlaceholder: t("tasks:tasksSearchPlaceholder"),
    noSearchResults: t("tasks:tasksNoSearchResults"),
  };

  const columnLabels: Record<TaskStatus, string> = {
    deferred: labels.deferred,
    todo: labels.todo,
    in_progress: labels.inProgress,
    to_review: labels.toReview,
    done: labels.done,
  };

  const cardLabels = {
    startDateLabel: labels.startDateLabel,
    deadlineLabel: labels.deadlineLabel,
    showMore: (count: number) => t("tasks:tasksShowMore", { count }),
    showLess: t("tasks:tasksShowLess"),
  };

  const [dueOnly, setDueOnly] = useState(false);
  const tilesNow = useMemo(() => new Date(), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const tilesData = useMemo(() => computeTaskTiles(tasks, tilesNow), [tasks, tilesNow]);

  const boardTasks = useMemo(
    () => (dueOnly ? filteredTasks.filter((x) => getTaskDueState(x, tilesNow)) : filteredTasks),
    [dueOnly, filteredTasks, tilesNow]
  );

  const activeCount = tasks.filter((x) => x.status !== "done" && x.status !== "deferred").length;
  const doneCount = tasks.filter((x) => x.status === "done").length;
  const today = new Date();
  const dateFormatted = formatFullDate(today, lang);
  const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
  const dateSubtitle = t("tasks:tasksDateSubtitle", {
    date: capitalizedDate,
    active: activeCount,
    done: doneCount,
  });

  const renderColumn = (status: TaskStatus) => (
    <TaskColumn
      key={status}
      status={status}
      title={columnLabels[status]}
      tasks={tasksByStatus(boardTasks, status)}
      collapseEnabled={!isSearching && !dueOnly}
      isDragOverColumn={dragOverColumn === status && dragOverTaskId === null}
      dragTaskId={dragTaskId}
      dragOverTaskId={dragOverTaskId}
      draggable={canDrag && !dueOnly}
      editingId={editingId}
      editTitle={editTitle}
      labels={cardLabels}
      projectsById={projectsById}
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
      onToggleEnergy={toggleEnergy}
      onToggleUrgent={toggleUrgent}
      now={tilesNow}
      onDelete={deleteTask}
      columnCollapsed={collapsedMap[status]}
      stacked={mode === "work" && status !== "todo" && status !== "done"}
      onToggleColumn={setCollapsed}
      listHeight={layout.heights[status]}
      onListHeightChange={setHeight}
    />
  );

  return (
    <div className="zad" data-card="zadania">
      <header className="zad-head">
        <div>
          <p className="zad-eyebrow">{t("tasks:tasksEyebrow")}</p>
          <h1 className="zad-heading">{t("tasks:tasksHeading")}</h1>
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

      <TaskTiles
        data={tilesData}
        now={tilesNow}
        dueOnly={dueOnly}
        onToggleDueOnly={() => setDueOnly((v) => !v)}
      />

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
            <button
              type="button"
              className="zad-urgent-btn"
              aria-pressed={newTaskUrgent}
              title={t("tasks:tasksCardUrgentTitle")}
              onClick={() => setNewTaskUrgent(!newTaskUrgent)}
            >
              {t("tasks:tasksCardUrgent")}
            </button>
            <span
              className="zad-energy zad-energy--bar"
              role="group"
              aria-label={t("tasks:tasksEnergyAria")}
            >
              {(["deep", "quick"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`zad-energy__btn zad-energy__btn--${value}`}
                  aria-pressed={getTaskEnergy(newTaskTitle) === value}
                  onClick={() => setNewTaskTitle(toggleTaskEnergy(newTaskTitle, value))}
                >
                  {value === "deep" ? "Deep" : "Quick"}
                </button>
              ))}
            </span>
            <kbd className="zad-kbd">Enter</kbd>
            <button
              type="button"
              onClick={() => void addTask()}
              className="zad-btn zad-btn--primary zad-btn--sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("tasks:tasksAdd")}
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
          <p className="zad-state zad-state--loading">{t("tasks:tasksLoading")}</p>
        ) : tasks.length === 0 ? (
          <p className="zad-state">{labels.noTasks}</p>
        ) : boardTasks.length === 0 ? (
          <p className="zad-state">{labels.noSearchResults}</p>
        ) : (
          <div
            className="zad-board"
            style={{ "--zad-cols": boardColumns(mode, collapsedMap) } as React.CSSProperties}
          >
            {mode === "normal" ? (
              TASK_STATUSES.map((status) => renderColumn(status))
            ) : (
              <>
                {renderColumn("todo")}
                <div className="zad-stack">
                  {(["deferred", "in_progress", "to_review"] as const).map((status) =>
                    renderColumn(status)
                  )}
                </div>
                {detailTask ? (
                  <TaskWorkPanel
                    task={detailTask}
                    projects={projects}
                    onClose={() => setDetailTaskId(null)}
                    onPatch={saveTaskPatch}
                  />
                ) : null}
                {renderColumn("done")}
              </>
            )}
          </div>
        )}
      </div>

      <TaskDetailModal
        task={detailTask}
        isOpen={detailTask !== null && !wide}
        projects={projects}
        onClose={() => setDetailTaskId(null)}
        onPatch={saveTaskPatch}
      />
      <TaskTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        apiFetch={apiFetch}
        onTemplatesChange={() => void fetchTemplates()}
      />
    </div>
  );
}
