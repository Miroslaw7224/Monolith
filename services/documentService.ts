import * as firestoreDb from "@/lib/firestore-db";

export async function listDocuments() {
  return firestoreDb.getDocuments();
}

export async function ingestDocument(data: { name: string; content: string; type: string }) {
  const { id } = await firestoreDb.createDocument(data);
  return { id, name: data.name };
}

export async function deleteDocument(id: string) {
  return firestoreDb.deleteDocument(id);
}
