import { FieldValue } from "firebase-admin/firestore";
import type { BoardDoc } from "@/types/records";
import { boardDoc } from "./collections";

export async function getBoard(userId: string): Promise<BoardDoc | null> {
  const snap = await boardDoc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data() as BoardDoc;
  return { tiles: data.tiles, frames: data.frames, edges: data.edges };
}

export async function saveBoard(
  userId: string,
  board: { tiles: unknown; frames: unknown; edges: unknown }
): Promise<void> {
  await boardDoc(userId).set({
    tiles: board.tiles,
    frames: board.frames,
    edges: board.edges,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
