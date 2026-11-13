import type { PaletteCommand } from "./cards";

export interface AppCommandActions {
  lang: "en" | "pl";
  toggleLang: () => void;
  toggleTheme: () => void;
  openFeedback: () => void;
}

/** Polecenia ustawień w palecie Ctrl+K (zastępują dawny górny pasek). */
export function buildAppCommands(actions: AppCommandActions): PaletteCommand[] {
  return [
    {
      id: "toggle-lang",
      label: actions.lang === "pl" ? "Zmień język na angielski (EN)" : "Zmień język na polski (PL)",
      run: actions.toggleLang,
    },
    { id: "toggle-theme", label: "Przełącz motyw jasny / ciemny", run: actions.toggleTheme },
    { id: "open-feedback", label: "Wyślij feedback", run: actions.openFeedback },
  ];
}
