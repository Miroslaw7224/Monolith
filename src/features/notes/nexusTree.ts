import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";

export type NexusFolder = { key: string; label: string; docs: NexusDocSummaryDto[] };

/** Filtr tekstowy (tytuł i ścieżka) połączony z filtrem tagu. */
export function filterNexusDocs(
  docs: NexusDocSummaryDto[],
  query: string,
  tag: string | null
): NexusDocSummaryDto[] {
  const q = query.trim().toLowerCase();
  return docs.filter((doc) => {
    if (q !== "" && !`${doc.title}\n${doc.path}`.toLowerCase().includes(q)) return false;
    return tag === null || doc.tags.includes(tag);
  });
}

/** Foldery w kolejności wejścia (API zwraca posortowane po obszarze, grupie i tytule). */
export function groupNexusDocs(docs: NexusDocSummaryDto[]): NexusFolder[] {
  const folders = new Map<string, NexusFolder>();
  for (const doc of docs) {
    const key = doc.group === "" ? doc.area : `${doc.area}/${doc.group}`;
    let folder = folders.get(key);
    if (!folder) {
      folder = { key, label: `${key}/`, docs: [] };
      folders.set(key, folder);
    }
    folder.docs.push(doc);
  }
  return [...folders.values()];
}

/** Najpopularniejsze tagi (malejąco po liczbie, remis alfabetycznie). */
export function collectNexusTags(docs: NexusDocSummaryDto[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const doc of docs) for (const tag of doc.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .slice(0, limit)
    .map(([tag]) => tag);
}
