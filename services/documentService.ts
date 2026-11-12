import * as firestoreDb from "@/lib/firestore-db";

export async function listDocuments(userId: string) {
  return firestoreDb.getDocuments(userId);
}

export async function ingestDocument(
  userId: string,
  data: { name: string; content: string; type: string }
) {
  const { id } = await firestoreDb.createDocument(userId, data);
  return { id, name: data.name };
}

export async function deleteDocument(userId: string, id: string) {
  return firestoreDb.deleteDocument(userId, id);
}
