import type { Owner, ProjectType } from "@/contexts/bc_projects/models";

/** [owner, type, oczekiwany kind, oczekiwane companyData]: ta sama tabela pilnuje `services` i `toSummaryDto`. */
export const PROJECT_KIND_CASES: [Owner, ProjectType | undefined, ProjectType, boolean][] = [
  ["personal", undefined, "wlasny", false],
  ["work", undefined, "etat", true],
  ["personal", "etat", "etat", true],
  ["personal", "wlasny", "wlasny", false],
  ["personal", "biblioteka", "biblioteka", false],
  ["work", "wlasny", "wlasny", true],
  ["work", "biblioteka", "biblioteka", true],
];
