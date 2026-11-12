import { readVaultFile, updateVaultFile, type VaultFsOptions } from "./vault-fs";
import { formatYamlList, parseYamlList, type YamlRecord } from "./yaml-lists";

/** Wartownik: `fn` nic nie zmieniło, więc `updateList` nie zapisuje pliku. */
class NoChange extends Error {}

/** Brak pliku, pusty tekst i same białe znaki to pusta lista (parser odrzuca `null`). */
function parseItems(text: string | null, rel: string, listKey: string): YamlRecord[] {
  if (text === null || text.trim() === "") return [];
  try {
    return parseYamlList(text, listKey).items;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Nie można odczytać pliku ${rel}: ${reason}`);
  }
}

export function readList(rel: string, listKey: string, opts?: VaultFsOptions): YamlRecord[] {
  return parseItems(readVaultFile(rel, opts)?.text ?? null, rel, listKey);
}

/**
 * Odczyt, zmiana listy i zapis przez `updateVaultFile` (ponawianie przy zmianie zewnętrznej:
 * `fn` jest wtedy wywoływane od nowa na świeżej liście). `fn` zwraca nową listę albo `null`,
 * gdy nic się nie zmieniło. Zwraca `true`, gdy plik zapisano.
 * Plik, który się nie parsuje, nigdy nie jest nadpisywany. Zapis nie dodaje `generated_by`.
 */
export async function updateList(
  rel: string,
  listKey: string,
  fn: (items: YamlRecord[]) => YamlRecord[] | null,
  opts: VaultFsOptions & { retries?: number } = {}
): Promise<boolean> {
  try {
    await updateVaultFile(
      rel,
      (current) => {
        const next = fn(parseItems(current, rel, listKey));
        if (next === null) throw new NoChange();
        return formatYamlList(listKey, next, undefined);
      },
      opts
    );
    return true;
  } catch (err) {
    if (err instanceof NoChange) return false;
    throw err;
  }
}
