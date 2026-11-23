import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });
const TEST_FILE = "tests/unit/lint/__sample__.test.ts";
const SOURCE_FILE = "src/lint-sample.ts";
const VITEST_RULES = new Set([
  "@vitest/no-focused-tests",
  "@vitest/no-disabled-tests",
  "@vitest/no-commented-out-tests",
  "@vitest/valid-expect",
  "@vitest/no-conditional-expect",
]);

async function vitestRuleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .map((m) => m.ruleId ?? "")
    .filter((id) => VITEST_RULES.has(id))
    .sort();
}

const header = `import { describe, expect, it } from "vitest";\n`;

describe("lint plików testów (Kodeks TDD-7, ASERCJE-1, ASERCJE-6)", () => {
  it.each([
    ["it.only", `it.only("a", () => { expect(1).toBe(1); });`, ["@vitest/no-focused-tests"]],
    [
      "describe.only",
      `describe.only("a", () => { it("b", () => { expect(1).toBe(1); }); });`,
      ["@vitest/no-focused-tests"],
    ],
    ["it.skip", `it.skip("a", () => { expect(1).toBe(1); });`, ["@vitest/no-disabled-tests"]],
    [
      "zakomentowany test",
      `// it("a", () => { expect(1).toBe(1); });\nit("b", () => { expect(1).toBe(1); });`,
      ["@vitest/no-commented-out-tests"],
    ],
    [
      "resolves bez await",
      `it("a", async () => { expect(Promise.resolve(1)).resolves.toBe(1); });`,
      ["@vitest/valid-expect"],
    ],
    [
      "expect w if",
      `it("a", () => { const x = 1; if (x) { expect(x).toBe(1); } });`,
      ["@vitest/no-conditional-expect"],
    ],
    [
      "expect tylko w catch",
      `it("a", () => { try { JSON.parse("{"); } catch (e) { expect(e).toBeInstanceOf(SyntaxError); } });`,
      ["@vitest/no-conditional-expect"],
    ],
  ])("zgłasza: %s", async (_name, body, expected) => {
    expect(await vitestRuleIds(header + body, TEST_FILE)).toEqual(expected);
  });

  it.each([
    ["zwykły it", `it("a", () => { expect(1).toBe(1); });`],
    ["expect z komunikatem", `it("a", () => { const opis = "x"; expect(1, opis).toBe(1); });`],
    [
      "resolves z await",
      `it("a", async () => { await expect(Promise.resolve(1)).resolves.toBe(1); });`,
    ],
    [
      "rejects z await",
      `it("a", async () => { await expect(Promise.reject(new Error("x"))).rejects.toThrow("x"); });`,
    ],
  ])("nie zgłasza poprawnego testu: %s", async (_name, body) => {
    expect(await vitestRuleIds(header + body, TEST_FILE)).toEqual([]);
  });

  it("reguły Vitest nie obejmują kodu spoza tests/", async () => {
    expect(
      await vitestRuleIds(header + `it.only("a", () => { expect(1).toBe(1); });`, SOURCE_FILE)
    ).toEqual([]);
  });
});
