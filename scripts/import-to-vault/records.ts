import { TASK_STATUSES, type TaskLine, type TaskStatus } from "../../lib/nexus/task-line";
import type {
  Converted,
  DumpData,
  DumpRow,
  VaultNote,
  VaultResource,
  VaultTag,
  VaultTemplate,
} from "./types";

/** Tekst zwraca bez zmian; Timestamp ze zrzutu daje jego `iso`; reszta `null`. */
export function toIso(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (rec.__type === "timestamp" && typeof rec.iso === "string") return rec.iso;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function created(data: Record<string, unknown>): string | null {
  return toIso(data.created_at) ?? toIso(data.createdAt);
}

function updated(data: Record<string, unknown>): string | null {
  return toIso(data.updated_at) ?? toIso(data.updatedAt);
}

export function normalizeTask(row: DumpRow, warnings: string[]): TaskLine {
  const { data } = row;
  if (typeof data.title !== "string") {
    warnings.push(`zadanie ${row.id}: tytuł nie jest tekstem, ustawiono pusty`);
  }
  let status: TaskStatus = "todo";
  if ((TASK_STATUSES as readonly unknown[]).includes(data.status)) {
    status = data.status as TaskStatus;
  } else {
    warnings.push(`zadanie ${row.id}: nieznany status "${String(data.status)}", ustawiono todo`);
  }
  return {
    id: row.id,
    title: text(data.title),
    status,
    link: text(data.link),
    description: text(data.description),
    due_date: typeof data.due_date === "string" && data.due_date !== "" ? data.due_date : null,
    priority: finiteNumber(data.priority),
    order: finiteNumber(data.order),
    created_at: created(data),
    updated_at: updated(data),
  };
}

export function normalizeNote(row: DumpRow, warnings: string[]): VaultNote {
  const { data } = row;
  if (data.content !== undefined && typeof data.content !== "string") {
    warnings.push(`notatka ${row.id}: treść nie jest tekstem, ustawiono pustą`);
  }
  return {
    id: row.id,
    title: text(data.title),
    html: text(data.content),
    created: created(data),
    updated: updated(data),
    tags: stringArray(data.tags),
  };
}

export function normalizeResource(row: DumpRow): VaultResource {
  const { data } = row;
  const rec: VaultResource = {
    id: row.id,
    title: text(data.title),
    url: text(data.url),
    description: text(data.description),
    tags: stringArray(data.tags),
    favorite: data.isFavorite === true,
  };
  if (typeof data.thumbnailUrl === "string" && data.thumbnailUrl !== "") {
    rec.thumbnail_url = data.thumbnailUrl;
  }
  if (typeof data.noteId === "string" && data.noteId !== "") rec.note_id = data.noteId;
  const c = created(data);
  if (c !== null) rec.created = c;
  const u = updated(data);
  if (u !== null) rec.updated = u;
  return rec;
}

export function normalizeTag(row: DumpRow): VaultTag {
  const { data } = row;
  const rec: VaultTag = { id: row.id, tag: text(data.tag), title: text(data.title) };
  if (typeof data.color === "string" && data.color !== "") rec.color = data.color;
  const c = created(data);
  if (c !== null) rec.created = c;
  return rec;
}

export function normalizeTemplate(row: DumpRow): VaultTemplate {
  const { data } = row;
  const rec: VaultTemplate = {
    id: row.id,
    label: text(data.label),
    title: text(data.title),
    link: text(data.link),
  };
  const c = created(data);
  if (c !== null) rec.created = c;
  return rec;
}

export function convertDump(dump: DumpData): Converted {
  const warnings: string[] = [];
  return {
    notes: dump.rows.notes.map((r) => normalizeNote(r, warnings)),
    tasks: dump.rows.tasks.map((r) => normalizeTask(r, warnings)),
    resources: dump.rows.resources.map((r) => normalizeResource(r)),
    tags: dump.rows.user_tags.map((r) => normalizeTag(r)),
    templates: dump.rows.task_templates.map((r) => normalizeTemplate(r)),
    warnings,
  };
}
