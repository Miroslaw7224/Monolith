import i18n from "@/src/i18n";
import type { PROJECT_KIND_LABELS } from "@/contexts/bc_projects/schemas";

type ProjectKind = keyof typeof PROJECT_KIND_LABELS;

/**
 * Etykieta rodzaju projektu w bieżącym języku. Zastępuje `PROJECT_KIND_LABELS`
 * (stała polska) w kartach, które już są przetłumaczone; komponent wołający musi mieć `useT()`.
 */
export function projectKindLabel(kind: ProjectKind): string {
  switch (kind) {
    case "etat":
      return i18n.t("common:projectKind.etat");
    case "wlasny":
      return i18n.t("common:projectKind.wlasny");
    case "biblioteka":
      return i18n.t("common:projectKind.biblioteka");
  }
}
