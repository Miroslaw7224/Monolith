import type { ArsenalEntryDto, SkillCategoryDto } from "@/contexts/bc_arsenal/schemas";

export type KindFilter = "all" | "skill" | "prompt";

export type ArsenalFilters = {
  query: string;
  kind: KindFilter;
  /** `id` projektu z rejestru. */
  project: string | null;
  /** Model promptu. */
  model: string | null;
  /** Kategoria skilla; prompty i skille bez kategorii odpadają. */
  category: SkillCategoryDto | null;
  undeployedOnly: boolean;
};

export const EMPTY_FILTERS: ArsenalFilters = {
  query: "",
  kind: "all",
  project: null,
  model: null,
  category: null,
  undeployedOnly: false,
};

const fold = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

/** Projekty powiązane z wpisem: wdrożenia skilla albo pole `projects` promptu. */
export function entryProjects(entry: ArsenalEntryDto): string[] {
  return entry.kind === "skill" ? entry.deployed.map((d) => d.project) : entry.projects;
}

export function filterEntries(
  entries: ArsenalEntryDto[],
  filters: ArsenalFilters
): ArsenalEntryDto[] {
  const query = fold(filters.query.trim());
  return entries.filter((entry) => {
    if (filters.kind !== "all" && entry.kind !== filters.kind) return false;
    if (filters.project !== null && !entryProjects(entry).includes(filters.project)) return false;
    if (filters.model !== null && !(entry.kind === "prompt" && entry.model === filters.model)) {
      return false;
    }
    if (
      filters.category !== null &&
      !(entry.kind === "skill" && entry.category === filters.category)
    ) {
      return false;
    }
    if (filters.undeployedOnly && !(entry.kind === "skill" && entry.deployed.length === 0)) {
      return false;
    }
    return query === "" || fold(`${entry.name} ${entry.summary}`).includes(query);
  });
}

export function promptModels(entries: ArsenalEntryDto[]): string[] {
  const models = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === "prompt" && entry.model !== undefined) models.add(entry.model);
  }
  return [...models].sort((a, b) => a.localeCompare(b, "pl"));
}

export type CatalogStats = { skills: number; prompts: number; undeployed: number };

/** Liczniki do kafelków: skille, prompty i skille bez żadnego wpisu `deployed`. */
export function catalogStats(entries: ArsenalEntryDto[]): CatalogStats {
  let skills = 0;
  let prompts = 0;
  let undeployed = 0;
  for (const entry of entries) {
    if (entry.kind === "prompt") {
      prompts += 1;
    } else {
      skills += 1;
      if (entry.deployed.length === 0) undeployed += 1;
    }
  }
  return { skills, prompts, undeployed };
}

export function isFiltered(filters: ArsenalFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.kind !== "all" ||
    filters.project !== null ||
    filters.model !== null ||
    filters.category !== null ||
    filters.undeployedOnly
  );
}
