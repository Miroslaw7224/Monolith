import i18n, { currentLang } from "@/src/i18n";
import { formatTokens } from "./packSections";

export type ColumnKey = "blockers" | "now" | "next" | "icebox";

export function registryProjectsLabel(count: number): string {
  return i18n.t("projects:format.registryCount", { count });
}

export function columnTaskCountLabel(column: ColumnKey, n: number): string {
  if (column === "icebox") return i18n.t("projects:format.iceboxCount", { count: n });
  return i18n.t("projects:format.tasksInColumn", { count: n });
}

export function devlogEntriesLabel(count: number): string {
  return i18n.t("projects:format.devlogEntries", { count });
}

export function archiveMovedNotice(count: number): string {
  return i18n.t("projects:format.archiveMoved", { count });
}

export function archiveConfirmQuestion(count: number, noDate: number): string {
  const suffix =
    noDate > 0 ? i18n.t("projects:format.archiveConfirmNoDate", { count: noDate }) : "";
  return i18n.t("projects:format.archiveConfirm", { count, suffix });
}

export function nowLimitError(limit: number): string {
  return i18n.t("projects:format.nowLimit", { limit });
}

export function doneToNowError(): string {
  return i18n.t("projects:format.doneToNow");
}

function formatThousandsDecimal(n: number): string {
  const lang = currentLang();
  const raw = (n / 1000).toFixed(1);
  if (lang === "pl") return raw.replace(".", ",");
  return raw;
}

/** Pełna etykieta tokenów (notatka po kopiowaniu): PL „~3,2 tys. tokenów”, EN „~3.2k tokens”. */
export function tokensThousandLabel(approxTokens: number): string {
  const value = formatThousandsDecimal(approxTokens);
  const lang = currentLang();
  if (lang === "en") {
    return i18n.t("projects:format.tokensThousand", { value: `${value}k` });
  }
  return i18n.t("projects:format.tokensThousand", { value });
}

/** Skrót w nawiasie przycisku: PL „ (~3,2 tys. tok)”, EN „ (~3.2k tok)”. */
export function packButtonSizeSuffix(approxTokens: number): string {
  const value = formatThousandsDecimal(approxTokens);
  const lang = currentLang();
  const core =
    lang === "en"
      ? i18n.t("projects:format.tokensThousandShort", { value: `${value}k` })
      : i18n.t("projects:format.tokensThousandShort", { value });
  return ` (${core})`;
}

/** Wartość w kafelu paczki: PL „3 850 tok” (`formatTokens`), EN „3,850 tok”. */
export function packTileValue(approxTokens: number): string {
  const lang = currentLang();
  const formatted =
    lang === "en" ? approxTokens.toLocaleString("en-US") : formatTokens(approxTokens);
  return i18n.t("projects:format.packValue", { formatted });
}

export function packBudgetMeta(percent: number, budget: number, truncated: boolean): string {
  const lang = currentLang();
  const budgetFormatted = lang === "en" ? budget.toLocaleString("en-US") : formatTokens(budget);
  const base = i18n.t("projects:tiles.packBudget", {
    percent,
    budget: budgetFormatted,
  });
  return truncated ? base + i18n.t("projects:tiles.packTruncated") : base;
}

export function kindCountLabel(kind: "wlasny" | "biblioteka" | "etat"): string {
  return i18n.t(`projects:tiles.kindCount.${kind}`);
}
