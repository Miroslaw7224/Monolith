import React from "react";
import { beforeEach, describe, expect, test } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import i18n, { LANG_KEY } from "@/src/i18n";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { useLang } from "@/src/i18n/useLang";
import { useTranslation } from "react-i18next";

function Probe({ seen }: { seen: string[] }) {
  const { t } = useTranslation();
  const { toggleLang } = useLang();
  const label = t("shell:rail.aria");
  seen.push(label);
  return (
    <button type="button" onClick={toggleLang}>
      {label}
    </button>
  );
}

beforeEach(() => cleanup());

describe("I18nProvider", () => {
  test("zapisany 'en': dzieci nigdy nie renderują się po polsku (brak mignięcia)", async () => {
    window.localStorage.setItem(LANG_KEY, "en");
    const seen: string[] = [];
    render(
      <I18nProvider>
        <Probe seen={seen} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((label) => label === "Cards")).toBe(true);
    expect(document.documentElement.lang).toBe("en");
  });

  test("bez zapisu: renderuje po polsku", async () => {
    render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Karty" })).toBeInTheDocument();
  });

  test("przełączenie zmienia teksty bez przeładowania, a po ponownym zamontowaniu wybór zostaje", async () => {
    const { unmount } = render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    (await screen.findByRole("button", { name: "Karty" })).click();
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_KEY)).toBe("en");

    unmount();
    cleanup();
    // symulacja F5: pamięć wraca do PL, zostaje tylko storage
    await act(async () => {
      await i18n.changeLanguage("pl");
    });
    render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
  });
});
