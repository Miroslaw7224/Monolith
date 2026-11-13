import type { NoteResource } from "./resourceTypes";

/** Unique tags across the list, in lexicographic order. */
export function collectResourceTags(resources: readonly NoteResource[]): string[] {
  return [...new Set(resources.flatMap((r) => r.tags || []))].sort();
}

/** Keeps resources that share at least one selected tag. An empty selection keeps the list. */
export function filterResourcesByTags(
  resources: readonly NoteResource[],
  selectedTags: readonly string[]
): NoteResource[] {
  if (selectedTags.length === 0) return [...resources];
  return resources.filter((r) => (r.tags || []).some((tag) => selectedTags.includes(tag)));
}

/** Matches a trimmed, case-insensitive query against title, description, or URL. */
export function filterResourcesBySearch(
  resources: readonly NoteResource[],
  searchQuery: string
): NoteResource[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [...resources];
  return resources.filter(
    (r) =>
      (r.title ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.url ?? "").toLowerCase().includes(q)
  );
}

/** Favorites first. Order within each group stays as given. */
export function sortResourcesByFavorite(resources: readonly NoteResource[]): NoteResource[] {
  return [...resources].sort((a, b) => {
    const aFav = a.isFavorite === true ? 1 : 0;
    const bFav = b.isFavorite === true ? 1 : 0;
    return bFav - aFav;
  });
}
