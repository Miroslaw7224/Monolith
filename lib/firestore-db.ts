export type {
  DocumentRecord,
  NoteRecord,
  NoteResourceRecord,
  CalendarEventRecord,
  TaskRecord,
  UserTagRecord,
  TaskTemplateRecord,
} from "@/types/records";

export { getDocuments, createDocument, deleteDocument } from "@/lib/nexus/repos/documents";
export { getNotes, createNote, updateNote, deleteNote } from "@/lib/nexus/repos/notes";
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
} from "@/lib/nexus/repos/calendarEvents";
export {
  getTasks,
  createTask,
  updateTask,
  reorderTasks,
  deleteTask,
} from "@/lib/nexus/repos/tasks";
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
} from "@/lib/nexus/repos/mindMaps";
export { getBoard, saveBoard } from "@/lib/nexus/repos/board";
