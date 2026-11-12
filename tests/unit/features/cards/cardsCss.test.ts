import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";
import { CARDS } from "@/src/features/cards/cards";

const root = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const appCss = read("src/features/cards/cards.css");
const tokensCss = read("docs/mockups/karty/tokens.css");

describe("spójność CSS z rejestrem kart", () => {
  test.each(CARDS.map((c) => c.id))("%s ma --c-<id> w cards.css", (id) => {
    expect(appCss).toMatch(new RegExp(`--c-${id}:\\s*#[0-9a-fA-F]{6};`));
  });

  test.each(CARDS.map((c) => c.id))("%s ma --c-<id> i blok motywu w tokens.css", (id) => {
    expect(tokensCss).toMatch(new RegExp(`--c-${id}:\\s*#[0-9a-fA-F]{6};`));
    expect(tokensCss).toContain(`[data-card="${id}"] {`);
  });

  test.each(CARDS.map((c) => c.id))("%s ma ten sam akcent w cards.css i tokens.css", (id) => {
    const pick = (css: string) =>
      new RegExp(`--c-${id}:\\s*(#[0-9a-fA-F]{6});`).exec(css)?.[1]?.toLowerCase();
    expect(pick(appCss)).toBeDefined();
    expect(pick(appCss)).toBe(pick(tokensCss));
  });

  test("Kodeks ma akcent #3ddc84 (decyzja K6)", () => {
    expect(appCss).toMatch(/--c-kodeks:\s*#3ddc84;/i);
  });
});
