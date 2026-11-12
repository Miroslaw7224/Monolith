import { FieldValue } from "firebase-admin/firestore";
import { boardDoc } from "@/lib/firestore-db";
import { EMPTY_BOARD, type Board } from "@/src/features/board/boardTypes";
import { parseBoard } from "@/src/features/board/boardSchema";

export async function getBoard(userId: string): Promise<Board> {
  const snap = await boardDoc(userId).get();
  if (!snap.exists) return EMPTY_BOARD;
  const data = snap.data() as { tiles: unknown; frames: unknown; edges: unknown };
  return parseBoard({ tiles: data.tiles, frames: data.frames, edges: data.edges });
}

export async function saveBoard(userId: string, input: unknown): Promise<Board> {
  const board = parseBoard(input);
  await boardDoc(userId).set({
    tiles: board.tiles,
    frames: board.frames,
    edges: board.edges,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return board;
}
