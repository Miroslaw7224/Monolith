import { describe, expect, test, vi } from "vitest";
import { buildAppCommands } from "@/src/features/cards/appCommands";
import { filterCommands } from "@/src/features/cards/cards";

const make = (lang: "pl" | "en") => {
  const actions = { lang, toggleLang: vi.fn(), toggleTheme: vi.fn(), openFeedback: vi.fn() };
  return { actions, commands: buildAppCommands(actions) };
};

describe("buildAppCommands", () => {
  test("trzy polecenia ustawień wołają odpowiednie akcje", () => {
    const { actions, commands } = make("pl");
    expect(commands.map((c) => c.id)).toEqual(["toggle-lang", "toggle-theme", "open-feedback"]);
    commands.forEach((c) => c.run());
    expect(actions.toggleLang).toHaveBeenCalledTimes(1);
    expect(actions.toggleTheme).toHaveBeenCalledTimes(1);
    expect(actions.openFeedback).toHaveBeenCalledTimes(1);
  });

  test("etykieta języka zależy od bieżącego języka", () => {
    expect(make("pl").commands[0].label).toContain("angielski");
    expect(make("en").commands[0].label).toContain("polski");
  });

  test("da się je znaleźć w palecie po słowie kluczowym", () => {
    const { commands } = make("pl");
    expect(filterCommands(commands, "motyw").map((c) => c.id)).toEqual(["toggle-theme"]);
    expect(filterCommands(commands, "feedback").map((c) => c.id)).toEqual(["open-feedback"]);
  });
});
