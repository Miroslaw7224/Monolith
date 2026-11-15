import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import i18n, { LANG_KEY } from "@/src/i18n";

// Każdy test startuje po polsku i bez zapisanego wyboru (część testów działa w środowisku node).
beforeEach(async () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LANG_KEY);
    document.documentElement.lang = "pl";
  }
  if (i18n.language !== "pl") await i18n.changeLanguage("pl");
});
