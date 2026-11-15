import i18n from "@/src/i18n";
import type { InboxItemDto } from "@/contexts/bc_inbox/schemas";

/**
 * Etykieta typu wpisu Inboxu w bieżącym języku. Wartość w vaulcie (`myśl`, `link`, `bug`, `snippet`)
 * zostaje bez zmian (J1); tłumaczony jest tylko napis w UI. Komponent wołający musi mieć `useT()`.
 */
export function inboxTypeLabel(type: InboxItemDto["type"]): string {
  switch (type) {
    case "myśl":
      return i18n.t("home:inbox.type.thought");
    case "link":
      return i18n.t("home:inbox.type.link");
    case "bug":
      return i18n.t("home:inbox.type.bug");
    case "snippet":
      return i18n.t("home:inbox.type.snippet");
    default:
      return String(type);
  }
}
