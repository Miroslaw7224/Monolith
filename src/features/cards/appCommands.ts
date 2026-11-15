import type { TFn } from "@/src/i18n";
import type { PaletteCommand } from "./cards";

export interface AppCommandActions {
  lang: "en" | "pl";
  toggleLang: () => void;
  toggleTheme: () => void;
  openFeedback: () => void;
  t: TFn;
}

/** Polecenia ustawień w palecie Ctrl+K (zastępują dawny górny pasek). */
export function buildAppCommands(actions: AppCommandActions): PaletteCommand[] {
  const { t } = actions;
  return [
    {
      id: "toggle-lang",
      label: actions.lang === "pl" ? t("common:lang.switchToEn") : t("common:lang.switchToPl"),
      run: actions.toggleLang,
    },
    { id: "toggle-theme", label: t("shell:palette.toggleTheme"), run: actions.toggleTheme },
    { id: "open-feedback", label: t("shell:palette.sendFeedback"), run: actions.openFeedback },
  ];
}
