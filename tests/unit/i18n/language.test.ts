import { afterEach, describe, expect, test, vi } from "vitest";
import i18n, { LANG_KEY, currentLang, readStoredLanguage, setLanguage } from "@/src/i18n";

afterEach(() => vi.restoreAllMocks());

describe("setLanguage / readStoredLanguage", () => {
  test("setLanguage('en') zapisuje wybór i ustawia <html lang>", async () => {
    await setLanguage("en");
    expect(window.localStorage.getItem(LANG_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(currentLang()).toBe("en");
  });

  test("zapisany 'en' jest odczytany", () => {
    window.localStorage.setItem(LANG_KEY, "en");
    expect(readStoredLanguage()).toBe("en");
  });

  test("nieznana wartość w storage → pl", () => {
    window.localStorage.setItem(LANG_KEY, "de");
    expect(readStoredLanguage()).toBe("pl");
  });

  test("brak wartości → pl", () => {
    expect(readStoredLanguage()).toBe("pl");
  });

  test("wyjątek odczytu → pl", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readStoredLanguage()).toBe("pl");
  });

  test("wyjątek zapisu nie psuje przełączenia języka", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    await setLanguage("en");
    expect(currentLang()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("plural ostrzeżeń (shell:statusbar.warnings)", () => {
  const pl = (count: number) => i18n.t("shell:statusbar.warnings", { count, lng: "pl" });
  const en = (count: number) => i18n.t("shell:statusbar.warnings", { count, lng: "en" });

  test("PL: 1 → ostrzeżenie, 2 → ostrzeżenia, 5 → ostrzeżeń, 22 → ostrzeżenia", () => {
    expect(pl(1)).toBe("1 ostrzeżenie");
    expect(pl(2)).toBe("2 ostrzeżenia");
    expect(pl(5)).toBe("5 ostrzeżeń");
    expect(pl(22)).toBe("22 ostrzeżenia");
  });

  test("EN: 1 → warning, 2 → warnings", () => {
    expect(en(1)).toBe("1 warning");
    expect(en(2)).toBe("2 warnings");
  });
});
