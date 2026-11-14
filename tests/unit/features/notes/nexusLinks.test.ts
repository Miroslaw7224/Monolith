import { describe, expect, it } from "vitest";
import { createNexusResolver } from "@/src/features/notes/nexusLinks";

const paths = [
  "Knowledge/alembic.md",
  "Knowledge/ai-security/foo.md",
  "Projects/nexus/nexus.md",
  "Projects/nexus/decyzja.md",
];
const resolve = createNexusResolver(paths);

describe("createNexusResolver (D5)", () => {
  it("pełna ścieżka z .md i bez", () => {
    expect(resolve("Knowledge/alembic.md")).toBe("Knowledge/alembic.md");
    expect(resolve("Knowledge/alembic")).toBe("Knowledge/alembic.md");
    expect(resolve("Knowledge/ai-security/foo")).toBe("Knowledge/ai-security/foo.md");
  });

  it("fallback: prefiks Projects/ i Knowledge/", () => {
    expect(resolve("nexus/nexus")).toBe("Projects/nexus/nexus.md");
    expect(resolve("nexus/decyzja.md")).toBe("Projects/nexus/decyzja.md");
    expect(resolve("alembic")).toBe("Knowledge/alembic.md");
    expect(resolve("ai-security/foo")).toBe("Knowledge/ai-security/foo.md");
  });

  it("brak dopasowania po samej nazwie pliku w podkatalogu", () => {
    expect(resolve("foo")).toBeNull();
    expect(resolve("decyzja")).toBeNull();
  });

  it("cel spoza listy (np. wyłączony state.md albo Notes) daje null", () => {
    expect(resolve("Projects/nexus/state")).toBeNull();
    expect(resolve("Notes/n")).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("wielkość liter ma znaczenie", () => {
    expect(resolve("knowledge/alembic")).toBeNull();
  });
});
