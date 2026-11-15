import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CourseDto, CourseInputDto } from "@/contexts/bc_arsenal/schemas";
import { formatDate } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";
import "@/src/features/resources/resources.css";
import "./arsenal.css";
import { ArsenalConfirmDialog } from "./ArsenalConfirmDialog";
import { CourseForm } from "./CourseForm";
import { messageOf } from "./apiError";
import { useCourses } from "./useCourses";
import type { ApiFetch } from "./useArsenal";

type StatusFilter = "all" | CourseDto["status"];

const STATUS_KEY = {
  plan: "courses:statusPlan",
  "w-trakcie": "courses:statusInProgress",
  ukonczony: "courses:statusDone",
} as const;

function Tile({
  label,
  value,
  meta,
  accent = false,
}: {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "asv-tile asv-tile--accent" : "asv-tile"}>
      <span className="asv-tile__label">{label}</span>
      <span className="asv-tile__value">{value}</span>
      <span className="asv-tile__meta">{meta}</span>
    </div>
  );
}

function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: CourseDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <article className="crs-card" data-status={course.status}>
      <div className="crs-card__head">
        <span className="asv-badge" data-status={course.status}>
          {t(STATUS_KEY[course.status])}
        </span>
        <a href={course.url} target="_blank" rel="noopener noreferrer" className="crs-card__title">
          {course.title}
        </a>
      </div>
      <p className="crs-card__meta">
        {[
          course.provider,
          course.completed !== undefined
            ? t("courses:completedOn", {
                date: formatDate(new Date(`${course.completed}T12:00:00`)),
              })
            : undefined,
        ]
          .filter((part): part is string => part !== undefined)
          .join(" · ")}
      </p>
      {(course.certificateUrl !== undefined || course.certificateFile !== undefined) && (
        <p className="crs-card__cert">
          {course.certificateUrl !== undefined && (
            <a href={course.certificateUrl} target="_blank" rel="noopener noreferrer">
              {t("courses:certificateLink")}
            </a>
          )}
          {course.certificateFile !== undefined && (
            <span>{t("courses:certificateFile", { path: course.certificateFile })}</span>
          )}
          {course.certificateMissing && (
            <span className="crs-warn">{t("courses:certificateMissing")}</span>
          )}
        </p>
      )}
      {course.note !== undefined && <p className="crs-card__note">{course.note}</p>}
      <div className="crs-card__actions">
        <button type="button" className="asv-btn" onClick={onEdit}>
          {t("courses:edit")}
        </button>
        <button type="button" className="asv-btn" onClick={onDelete}>
          {t("courses:delete")}
        </button>
      </div>
    </article>
  );
}

export function CoursesView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const c = useCourses(apiFetch);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const count = (status: CourseDto["status"]) =>
    c.courses.filter((x) => x.status === status).length;
  const visible = filter === "all" ? c.courses : c.courses.filter((x) => x.status === filter);
  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("courses:filterAll") },
    { id: "w-trakcie", label: t("courses:statusInProgress") },
    { id: "plan", label: t("courses:statusPlan") },
    { id: "ukonczony", label: t("courses:statusDone") },
  ];

  const save = async (input: CourseInputDto, id?: string) => {
    setActionError(null);
    await c.save(input, id);
    setEditing(null);
  };
  const [pendingDelete, setPendingDelete] = useState<CourseDto | null>(null);
  const remove = async (course: CourseDto) => {
    setPendingDelete(null);
    setActionError(null);
    try {
      await c.remove(course.id);
    } catch (err) {
      setActionError(messageOf(err));
    }
  };

  return (
    <div className="ars asv" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{`Alt+7 · ${t("shell:cards.arsenal")}`}</p>
          <h1 className="ars-title">{t("courses:title")}</h1>
          <p className="ars-sub">
            {t("courses:count", { count: c.courses.length })}
            {c.skipped > 0 ? t("courses:skippedSuffix", { count: c.skipped }) : ""}
          </p>
        </div>
        <button
          type="button"
          className="asv-btn asv-btn--primary"
          disabled={c.loading || c.error !== null}
          onClick={() => setEditing("new")}
        >
          {t("courses:add")}
        </button>
      </header>

      {c.loading ? (
        <Loader2 className="animate-spin" aria-label={t("courses:loading")} />
      ) : c.error !== null ? (
        <p role="alert" className="asv-error">
          {c.error}
        </p>
      ) : (
        <>
          <section className="asv-tiles" aria-label={t("courses:statsAria")}>
            <Tile
              label={t("courses:tileInProgress")}
              value={count("w-trakcie")}
              meta={t("courses:tileInProgressMeta")}
              accent
            />
            <Tile
              label={t("courses:tilePlanned")}
              value={count("plan")}
              meta={t("courses:tilePlannedMeta")}
            />
            <Tile
              label={t("courses:tileDone")}
              value={count("ukonczony")}
              meta={t("courses:tileDoneMeta")}
            />
          </section>

          <div className="asv-chips" role="group" aria-label={t("courses:filterAria")}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="asv-chip"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {actionError !== null && (
            <p role="alert" className="asv-error">
              {actionError}
            </p>
          )}
          {editing === "new" && (
            <CourseForm onSubmit={(input) => save(input)} onCancel={() => setEditing(null)} />
          )}

          {visible.length === 0 && editing !== "new" ? (
            <p className="asv-empty">
              {t(c.courses.length === 0 ? "courses:empty" : "courses:emptyFilter")}
            </p>
          ) : (
            <div className="crs-list">
              {visible.map((course) =>
                editing === course.id ? (
                  <CourseForm
                    key={course.id}
                    initial={course}
                    onSubmit={(input) => save(input, course.id)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEdit={() => setEditing(course.id)}
                    onDelete={() => setPendingDelete(course)}
                  />
                )
              )}
            </div>
          )}
        </>
      )}
      {pendingDelete && (
        <ArsenalConfirmDialog
          title={t("courses:deleteConfirm", { title: pendingDelete.title })}
          confirmLabel={t("common:delete")}
          cancelLabel={t("common:cancel")}
          onConfirm={() => void remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
