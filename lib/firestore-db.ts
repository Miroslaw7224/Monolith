export type {
  DocumentRecord,
  NoteRecord,
  ChunkRecord,
  NoteResourceRecord,
  CalendarEventRecord,
  TaskRecord,
  UserTagRecord,
  TaskTemplateRecord,
} from "@/types/records";

export { getDocuments, createDocument, deleteDocument } from "@/lib/firestore/documents";
export { getNotes, createNote, updateNote, deleteNote } from "@/lib/firestore/notes";
export { addChunks, deleteChunksByDocument, deleteChunksByNote } from "@/lib/firestore/chunks";
export {
  addResourceToFirestore,
  getResourcesFromFirestore,
  deleteResourceFromFirestore,
  updateResourceInFirestore,
} from "@/lib/nexus/repos/resources";
export {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/firestore/calendar";
export { getTasks, createTask, updateTask, reorderTasks, deleteTask } from "@/lib/firestore/tasks";
export { getUserTags, createUserTag, updateUserTag, deleteUserTag } from "@/lib/nexus/repos/tags";
export {
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
} from "@/lib/nexus/repos/taskTemplates";
export {
  getMindMaps,
  getMindMap,
  createMindMap,
  saveMindMap,
  deleteMindMap,
} from "@/lib/firestore/mindMaps";
export { getBoard, saveBoard } from "@/lib/firestore/board";
