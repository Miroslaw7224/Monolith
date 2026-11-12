import type { BoardDoc } from "@/types/records";
import { readVaultFile, updateVaultFile } from "../vault-fs";
import { nowIso } from "./common";

const FILE = "Board/board.json";

export async function getBoard(): Promise<BoardDoc | null> {
  const file = readVaultFile(FILE);
  if (file === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(file.text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Nie można odczytać pliku ${FILE}: ${reason}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Nie można odczytać pliku ${FILE}: oczekiwano obiektu JSON`);
  }
  const { tiles, frames, edges } = data as Record<string, unknown>;
  return { tiles, frames, edges };
}

/** Zawsze nadpisuje (jak `set` w Firestore); poprawny zapis naprawia uszkodzony plik. */
export async function saveBoard(board: {
  tiles: unknown;
  frames: unknown;
  edges: unknown;
}): Promise<void> {
  const { tiles, frames, edges } = board;
  await updateVaultFile(
    FILE,
    () => JSON.stringify({ tiles, frames, edges, updatedAt: nowIso() }, null, 2) + "\n"
  );
}
