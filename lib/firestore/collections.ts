import { getFirestore } from "@/lib/firebase-admin";

const COLLECTION_USERS = "users";

export function db() {
  return getFirestore();
}

function userCollection(userId: string, name: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection(name);
}

export function documentsCol(userId: string) {
  return userCollection(userId, "documents");
}

export function notesCol(userId: string) {
  return userCollection(userId, "notes");
}

export function mindMapsCol(userId: string) {
  return userCollection(userId, "mindMaps");
}

export function boardDoc(userId: string) {
  return userCollection(userId, "board").doc("main");
}

export function chunksCol(userId: string) {
  return userCollection(userId, "chunks");
}

export function calendarEventsCol(userId: string) {
  return userCollection(userId, "calendar_events");
}

export function tasksCol(userId: string) {
  return userCollection(userId, "tasks");
}
