import type { StoredBoard } from "./models";
import { readVaultFile, updateVaultFile } from "@/lib/nexus/vault-fs";
import { nowIso } from "@/lib/nexus/record-helpers";

const FILE = "Board/board.json";

export async function getBoard(): Promise<StoredBoard | null> {
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
export async function saveBoard(board: StoredBoard): Promise<void> {
  const { tiles, frames, edges } = board;
  await updateVaultFile(
    FILE,
    () => JSON.stringify({ tiles, frames, edges, updatedAt: nowIso() }, null, 2) + "\n"
  );
}
