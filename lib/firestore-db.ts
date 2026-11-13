export type { DocumentRecord, NoteRecord, NoteResourceRecord } from "@/types/records";

export { getDocuments, createDocument, deleteDocument } from "@/lib/nexus/repos/documents";
export { getNotes, createNote, updateNote, deleteNote } from "@/lib/nexus/repos/notes";
export {
  addResourceToFirestore,
  getResourcesFromFirestore,
  deleteResourceFromFirestore,
  updateResourceInFirestore,
} from "@/lib/nexus/repos/resources";
export {
  getMindMaps,
  getMindMap,
  createMindMap,
  saveMindMap,
  deleteMindMap,
} from "@/lib/nexus/repos/mindMaps";
export { getBoard, saveBoard } from "@/lib/nexus/repos/board";
