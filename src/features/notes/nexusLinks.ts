/**
 * Resolver wikilinków dokumentów NEXUS (spec D5). Czysta funkcja nad listą widocznych ścieżek.
 * Kolejność prób: cel jak podano, potem z prefiksem `Projects/`, potem `Knowledge/`; każda z `.md`
 * i bez. Dopasowanie tylko do ścieżki z listy (wielkość liter ma znaczenie), bez dopasowania po samej
 * nazwie pliku.
 */
export function createNexusResolver(paths: readonly string[]): (target: string) => string | null {
  const known = new Set(paths);
  return (target) => {
    const base = target.trim();
    if (base === "") return null;
    for (const prefix of ["", "Projects/", "Knowledge/"]) {
      const candidate = `${prefix}${base}`;
      const withExt = candidate.endsWith(".md") ? candidate : `${candidate}.md`;
      if (known.has(withExt)) return withExt;
    }
    return null;
  };
}
