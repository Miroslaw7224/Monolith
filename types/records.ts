import type { Timestamp } from "firebase-admin/firestore";

export type DocumentRecord = {
  id: string;
  name: string;
  content: string;
  type: string;
  created_at?: string;
  createdAt?: Timestamp;
};

export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};

export type ChunkRecord = {
  id: string;
  content: string;
  documentId?: string;
  noteId?: string;
  sourceName?: string;
  noteTitle?: string;
};

export interface NoteResourceRecord {
  id: string;
  noteId?: string; // opcjonalne – zasoby są na poziomie użytkownika, nie notatki
  userId: string;
  description: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  tags: string[];
  isFavorite?: boolean;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

/** Stored events are work | meeting; createCalendarEvent does not persist task_deadline. */
export type CalendarEventRecord = {
  id: string;
  date: string; // YYYY-MM-DD (date-only, user's day)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
  created_at?: string;
};

/** API and UI calendar event; task_deadline is synthesized by calendarService and is never stored. */
export type CalendarEvent = Omit<CalendarEventRecord, "type"> & {
  type: "work" | "meeting" | "task_deadline";
};

export type TaskRecord = {
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
};

export type UserTagRecord = {
  id: string;
  tag: string;
  title: string;
  color?: string;
  created_at?: string;
};

export type TaskTemplateRecord = {
  id: string;
  label: string;
  title: string;
  link: string;
  created_at?: string;
};

export interface MindMap {
  id: string;
  userId: string;
  title: string;
  rootNode: MindMapNode;
  /** Column widths in px per depth level. */
  colWidths: Record<number, number>;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

export interface MindMapNode {
  /** Unique within a mind map (use nanoid()). */
  id: string;
  label: string;
  /** Rich text (TipTap JSON or HTML depending on editor implementation). */
  note: string;
  /** UI state persisted in the document. */
  collapsed: boolean;
  children: MindMapNode[];
}

/** Zapisany dokument tablicy (surowe, jeszcze nieprzetworzone przez parseBoard). */
export type BoardDoc = { tiles: unknown; frames: unknown; edges: unknown };
