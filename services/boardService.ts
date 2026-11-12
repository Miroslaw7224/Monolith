import * as firestoreDb from "@/lib/firestore-db";
import { EMPTY_BOARD, type Board } from "@/src/features/board/boardTypes";
import { parseBoard } from "@/src/features/board/boardSchema";

export async function getBoard(): Promise<Board> {
  const doc = await firestoreDb.getBoard();
  if (doc === null) return EMPTY_BOARD;
  return parseBoard({ tiles: doc.tiles, frames: doc.frames, edges: doc.edges });
}

export async function saveBoard(input: unknown): Promise<Board> {
  const board = parseBoard(input);
  await firestoreDb.saveBoard(board);
  return board;
}
