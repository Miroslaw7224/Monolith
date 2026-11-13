import { describe, expect, it } from "vitest";
import { isHttpUrl } from "@/src/features/projects/isHttpUrl";

describe("isHttpUrl", () => {
  it.each([
    ["https://a", true],
    ["HTTP://a", true],
    ["javascript:alert(1)", false],
    ["ftp://a", false],
    ["", false],
  ])("%s → %s", (url, expected) => {
    expect(isHttpUrl(url)).toBe(expected);
  });
});
