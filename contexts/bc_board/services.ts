import * as repositories from "./repositories";
import type { Board, StoredBoard } from "./models";

/** Surowy dokument z pliku albo `null`; walidacja przy odczycie jest w `schemas.storedBoardToDto`. */
export async function getBoard(): Promise<StoredBoard | null> {
  return repositories.getBoard();
}

/** Zapisuje już zwalidowaną i znormalizowaną tablicę (walidacja wejścia w `router`). */
export async function saveBoard(board: Board): Promise<Board> {
  await repositories.saveBoard(board);
  return board;
}
