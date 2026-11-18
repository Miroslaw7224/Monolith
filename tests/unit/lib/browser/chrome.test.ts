// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findChrome } from "@/lib/browser/chrome";

describe("findChrome", () => {
  it("zwraca pierwszą istniejącą ścieżkę", () => {
    expect(findChrome((p) => p.includes("(x86)"))).toContain("Program Files (x86)");
  });
  it("brak Chrome → null", () => {
    expect(findChrome(() => false)).toBeNull();
  });
});
