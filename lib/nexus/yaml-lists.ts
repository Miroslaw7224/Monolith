import YAML from "yaml";

/** Znacznik w plikach tworzonych przez import (krok 0b); pliki bez niego uznajemy za ręczne. */
export const GENERATED_BY_IMPORT = "import-to-vault";

export type YamlRecord = Record<string, unknown>;

/**
 * Plik z listą rekordów: `version`, opcjonalnie `generated_by`, potem lista pod kluczem `listKey`.
 * Wartości `undefined` są pomijane. Wersja 1.1 wymusza cudzysłowy przy wartościach, które
 * parsery YAML 1.1 (np. Obsidian) czytałyby jako liczby, daty lub booleany.
 */
export function formatYamlList(listKey: string, items: YamlRecord[], generatedBy?: string): string {
  const doc: Record<string, unknown> = { version: 1 };
  if (generatedBy) doc.generated_by = generatedBy;
  doc[listKey] = items;
  return YAML.stringify(doc, { lineWidth: 0, version: "1.1" });
}

export function parseYamlList(
  text: string,
  listKey: string
): { generatedBy: string | null; items: YamlRecord[] } {
  const doc = YAML.parse(text);
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("plik YAML nie jest mapą z listą");
  }
  const record = doc as Record<string, unknown>;
  const raw = record[listKey];
  if (raw !== undefined && !Array.isArray(raw)) {
    throw new Error(`klucz "${listKey}" nie jest listą`);
  }
  const items = (raw ?? []) as unknown[];
  for (const item of items) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`element listy "${listKey}" nie jest mapą`);
    }
  }
  return {
    generatedBy: typeof record.generated_by === "string" ? record.generated_by : null,
    items: items as YamlRecord[],
  };
}
