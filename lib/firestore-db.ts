import { getFirestore } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { eventOverlapsInclusiveRange } from "@/lib/calendarRange";

const COLLECTION_USERS = "users";

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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
  createdAt?: Timestamp;
};

function db() {
  return getFirestore();
}

function documentsCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("documents");
}

function notesCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("notes");
}

export function mindMapsCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("mindMaps");
}

export function boardDoc(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("board").doc("main");
}

export function resourcesCol(userId: string, noteId: string) {
  return notesCol(userId).doc(noteId).collection("resources");
}

function userResourcesCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("resources");
}

function chunksCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("chunks");
}

function calendarEventsCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("calendar_events");
}

export async function getDocuments(userId: string): Promise<DocumentRecord[]> {
  const snap = await documentsCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      name: data.name ?? "",
      content: data.content ?? "",
      type: data.type ?? "",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: createdAt ?? undefined,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function getNotes(userId: string): Promise<NoteRecord[]> {
  const snap = await notesCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      title: data.title ?? "",
      content: data.content ?? "",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function createNote(
  userId: string,
  data: { title: string; content: string }
): Promise<{ id: string; title: string; content: string }> {
  const col = notesCol(userId);
  const ref = await col.add({
    title: data.title,
    content: data.content,
    createdAt: FieldValue.serverTimestamp(),
  });
  await chunksCol(userId).add({
    noteId: ref.id,
    content: data.content,
  });
  return { id: ref.id, title: data.title, content: data.content };
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: { title: string; content: string }
): Promise<void> {
  const noteRef = notesCol(userId).doc(noteId);
  await noteRef.update({
    title: data.title,
    content: data.content,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await deleteChunksByNote(userId, noteId);
  await chunksCol(userId).add({ noteId, content: data.content });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteChunksByNote(userId, noteId);
  await notesCol(userId).doc(noteId).delete();
}

export async function createDocument(
  userId: string,
  data: { name: string; content: string; type: string }
): Promise<{ id: string; name: string }> {
  const col = documentsCol(userId);
  const ref = await col.add({
    name: data.name,
    content: data.content,
    type: data.type,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, name: data.name };
}

export async function addChunks(
  userId: string,
  chunks: { documentId?: string; noteId?: string; content: string }[]
): Promise<void> {
  const col = chunksCol(userId);
  for (const c of chunks) {
    await col.add({
      documentId: c.documentId ?? null,
      noteId: c.noteId ?? null,
      content: c.content,
    });
  }
}

const FIRESTORE_BATCH_LIMIT = 500;

export async function deleteChunksByDocument(userId: string, documentId: string): Promise<void> {
  const snap = await chunksCol(userId).where("documentId", "==", documentId).get();
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db().batch();
    snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteChunksByNote(userId: string, noteId: string): Promise<void> {
  const snap = await chunksCol(userId).where("noteId", "==", noteId).get();
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db().batch();
    snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteDocument(userId: string, docId: string): Promise<void> {
  await deleteChunksByDocument(userId, docId);
  await documentsCol(userId).doc(docId).delete();
}

// --- Zasoby użytkownika (kolekcja na poziomie użytkownika, niezależna od notatek) ---

export async function addResourceToFirestore(
  userId: string,
  data: Omit<NoteResourceRecord, "id" | "createdAt" | "updatedAt">
): Promise<NoteResourceRecord> {
  const col = userResourcesCol(userId);
  const ref = await col.add({
    userId,
    description: data.description,
    url: data.url,
    title: data.title,
    tags: data.tags ?? [],
    isFavorite: data.isFavorite ?? false,
    ...(data.noteId != null && { noteId: data.noteId }),
    ...(data.thumbnailUrl != null && { thumbnailUrl: data.thumbnailUrl }),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    noteId: d.noteId,
    userId: d.userId ?? userId,
    description: d.description ?? "",
    url: d.url ?? "",
    title: d.title ?? "",
    thumbnailUrl: d.thumbnailUrl,
    tags: Array.isArray(d.tags) ? d.tags : [],
    isFavorite: d.isFavorite === true,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function getResourcesFromFirestore(userId: string): Promise<NoteResourceRecord[]> {
  const snap = await userResourcesCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      noteId: data.noteId,
      userId: data.userId ?? userId,
      description: data.description ?? "",
      url: data.url ?? "",
      title: data.title ?? "",
      thumbnailUrl: data.thumbnailUrl,
      tags: Array.isArray(data.tags) ? data.tags : [],
      isFavorite: data.isFavorite === true,
      createdAt: (data.createdAt ?? createdAt) as Timestamp,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const tA =
      a.createdAt?.toMillis?.() ??
      (a.createdAt &&
      typeof (a.createdAt as unknown as { toDate?: () => Date }).toDate === "function"
        ? (a.createdAt as unknown as { toDate: () => Date }).toDate().getTime()
        : 0);
    const tB =
      b.createdAt?.toMillis?.() ??
      (b.createdAt &&
      typeof (b.createdAt as unknown as { toDate?: () => Date }).toDate === "function"
        ? (b.createdAt as unknown as { toDate: () => Date }).toDate().getTime()
        : 0);
    return tB - tA;
  });
  return list;
}

export async function deleteResourceFromFirestore(
  userId: string,
  resourceId: string
): Promise<void> {
  await userResourcesCol(userId).doc(resourceId).delete();
}

export async function updateResourceInFirestore(
  userId: string,
  resourceId: string,
  data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.url !== undefined) updateData.url = data.url.trim();
  if (data.tags !== undefined) updateData.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
  await userResourcesCol(userId).doc(resourceId).update(updateData);
}

// --- Legacy: subkolekcja notatki (nie używane przy nowym API; zostawione na ewentualną migrację) ---

export async function getResourcesByNoteFromFirestore(
  userId: string,
  noteId: string
): Promise<NoteResourceRecord[]> {
  const snap = await resourcesCol(userId, noteId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      noteId: data.noteId ?? noteId,
      userId: data.userId ?? userId,
      description: data.description ?? "",
      url: data.url ?? "",
      title: data.title ?? "",
      thumbnailUrl: data.thumbnailUrl,
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
}

export async function _deleteResourceFromNoteFirestore(
  userId: string,
  noteId: string,
  resourceId: string
): Promise<void> {
  await resourcesCol(userId, noteId).doc(resourceId).delete();
}

export type ChunkWithSource = {
  content: string;
  source_name?: string;
  note_title?: string;
  documentId?: string;
  noteId?: string;
};

export async function getChunksForSearch(
  userId: string,
  keywords: string[],
  limitCount: number = 5
): Promise<ChunkWithSource[]> {
  const snap = await chunksCol(userId).get();
  let docs = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as { id: string; content: string; documentId?: string; noteId?: string }[];

  if (keywords.length > 0) {
    docs = docs.filter((d) =>
      keywords.some((k) => (d.content ?? "").toLowerCase().includes(k.toLowerCase()))
    );
  }
  docs = docs.slice(0, limitCount);

  const docIds = [...new Set(docs.map((d) => d.documentId).filter(Boolean))] as string[];
  const noteIds = [...new Set(docs.map((d) => d.noteId).filter(Boolean))] as string[];

  const namesByDoc: Record<string, string> = {};
  const namesByNote: Record<string, string> = {};

  for (const id of docIds) {
    const ref = documentsCol(userId).doc(id);
    const s = await ref.get();
    if (s.exists) namesByDoc[id] = (s.data()?.name as string) ?? "";
  }
  for (const id of noteIds) {
    const ref = notesCol(userId).doc(id);
    const s = await ref.get();
    if (s.exists) namesByNote[id] = (s.data()?.title as string) ?? "";
  }

  return docs.map((d) => ({
    content: d.content,
    source_name: d.documentId ? namesByDoc[d.documentId] : undefined,
    note_title: d.noteId ? namesByNote[d.noteId] : undefined,
    documentId: d.documentId,
    noteId: d.noteId,
  }));
}

// --- Calendar events ---

export async function getCalendarEvents(
  userId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<CalendarEventRecord[]> {
  const snap = await calendarEventsCol(userId).get();
  let list = snap.docs.map((d): CalendarEventRecord => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      date: data.date ?? "",
      start_minutes: data.start_minutes ?? 0,
      duration_minutes: data.duration_minutes ?? 0,
      title: data.title ?? "",
      tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
      color: data.color ?? "#3B82F6",
      type: data.type === "meeting" ? "meeting" : "work",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
    };
  });
  if (options?.startDate && options?.endDate) {
    list = list.filter((e) => eventOverlapsInclusiveRange(e, options.startDate!, options.endDate!));
  } else if (options?.startDate) {
    list = list.filter((e) => e.date >= options.startDate!);
  } else if (options?.endDate) {
    list = list.filter((e) => e.date <= options.endDate!);
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes);
  return list;
}

export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
): Promise<CalendarEventRecord> {
  if (data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = await calendarEventsCol(userId).add({
    date: data.date,
    start_minutes: data.start_minutes,
    duration_minutes: data.duration_minutes,
    title: data.title,
    tags: data.tags ?? [],
    color: data.color ?? "#3B82F6",
    type: data.type === "meeting" ? "meeting" : "work",
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    date: d.date ?? "",
    start_minutes: d.start_minutes ?? 0,
    duration_minutes: d.duration_minutes ?? 0,
    title: d.title ?? "",
    tags: Array.isArray(d.tags) ? d.tags : [],
    color: d.color ?? "#3B82F6",
    type: d.type === "meeting" ? "meeting" : "work",
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
): Promise<void> {
  if (data.duration_minutes != null && data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = calendarEventsCol(userId).doc(eventId);
  const update: Record<string, unknown> = {};
  if (data.date !== undefined) update.date = data.date;
  if (data.start_minutes !== undefined) update.start_minutes = data.start_minutes;
  if (data.duration_minutes !== undefined) update.duration_minutes = data.duration_minutes;
  if (data.title !== undefined) update.title = data.title;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.color !== undefined) update.color = data.color;
  if (data.type !== undefined) update.type = data.type === "meeting" ? "meeting" : "work";
  if (Object.keys(update).length > 0) {
    await ref.update(update);
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  await calendarEventsCol(userId).doc(eventId).delete();
}

// --- Tasks (to-do) ---

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function tasksCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("tasks");
}

export async function getTasks(userId: string): Promise<TaskRecord[]> {
  const snap = await tasksCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? {
              toDate: () => new Date(data.created_at),
              toMillis: () => new Date(data.created_at).getTime(),
            }
          : data.created_at
        : null);
    return {
      id: d.id,
      title: data.title ?? "",
      link: data.link ?? "",
      description: data.description ?? "",
      status: (data.status as TaskRecord["status"]) ?? "todo",
      due_date: data.due_date ?? null,
      priority: data.priority ?? null,
      order: typeof data.order === "number" ? data.order : undefined,
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const oA = a.order ?? 999999;
    const oB = b.order ?? 999999;
    if (oA !== oB) return oA - oB;
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function createTask(
  userId: string,
  data: {
    title: string;
    link?: string;
    description?: string;
    status?: TaskRecord["status"];
    due_date?: string | null;
    priority?: number | null;
  }
): Promise<TaskRecord> {
  const ref = await tasksCol(userId).add({
    title: data.title ?? "",
    link: data.link ?? "",
    description: data.description ?? "",
    status: data.status ?? "todo",
    due_date: data.due_date ?? null,
    priority: data.priority ?? null,
    order: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    title: d.title ?? "",
    link: d.link ?? "",
    description: d.description ?? "",
    status: (d.status as TaskRecord["status"]) ?? "todo",
    due_date: d.due_date ?? null,
    priority: d.priority ?? null,
    order: typeof d.order === "number" ? d.order : 0,
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    updated_at: d.updatedAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function updateTask(
  userId: string,
  taskId: string,
  data: Partial<{
    title: string;
    link: string;
    description: string;
    status: TaskRecord["status"];
    due_date: string | null;
    priority: number | null;
    order: number;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (data.title !== undefined) update.title = data.title;
  if (data.link !== undefined) update.link = data.link;
  if (data.description !== undefined) update.description = data.description;
  if (data.status !== undefined) update.status = data.status;
  if (data.due_date !== undefined) update.due_date = data.due_date;
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.order !== undefined) update.order = data.order;
  await tasksCol(userId).doc(taskId).update(update);
}

export async function reorderTasks(userId: string, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const col = tasksCol(userId);
  const batch = db().batch();
  taskIds.forEach((id, index) => {
    batch.update(col.doc(id), { order: index, updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await tasksCol(userId).doc(taskId).delete();
}

// --- User tags (tag name + default title for calendar entries) ---

export type UserTagRecord = {
  id: string;
  tag: string;
  title: string;
  color?: string;
  created_at?: string;
  createdAt?: Timestamp;
};

function userTagsCol(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("user_tags");
}

export async function getUserTags(userId: string): Promise<UserTagRecord[]> {
  const snap = await userTagsCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      tag: (data.tag ?? "").trim().replace(/^#/, "") || "",
      title: (data.title ?? "").trim() || "",
      color: typeof data.color === "string" && data.color ? data.color : undefined,
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tA - tB;
  });
  return list;
}

export async function createUserTag(
  userId: string,
  data: { tag: string; title: string; color?: string }
): Promise<UserTagRecord> {
  const tag = (data.tag ?? "").trim().replace(/^#/, "") || "";
  const title = (data.title ?? "").trim() || "";
  const color = typeof data.color === "string" && data.color.trim() ? data.color.trim() : undefined;
  const payload: Record<string, unknown> = { tag, title, createdAt: FieldValue.serverTimestamp() };
  if (color) payload.color = color;
  const ref = await userTagsCol(userId).add(payload);
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    tag: d.tag ?? "",
    title: d.title ?? "",
    color: typeof d.color === "string" && d.color ? d.color : undefined,
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}

export async function updateUserTag(
  userId: string,
  tagId: string,
  data: { tag?: string; title?: string; color?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.tag !== undefined) update.tag = (data.tag ?? "").trim().replace(/^#/, "") || "";
  if (data.title !== undefined) update.title = (data.title ?? "").trim() || "";
  if (data.color !== undefined)
    update.color = typeof data.color === "string" && data.color.trim() ? data.color.trim() : null;
  if (Object.keys(update).length > 0) {
    await userTagsCol(userId).doc(tagId).update(update);
  }
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  await userTagsCol(userId).doc(tagId).delete();
}
