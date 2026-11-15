import { describe, expect, it } from "vitest";
import type { ArsenalCatalog } from "@/contexts/bc_arsenal/models";
import {
  CatalogDtoSchema,
  DeployQuerySchema,
  toCatalogDto,
  toEntryDto,
} from "@/contexts/bc_arsenal/schemas";

const catalog: ArsenalCatalog = {
  entries: [
    {
      kind: "skill",
      id: "skill:tdd",
      path: "Arsenal/Skills/tdd/skill.md",
      name: "tdd",
      slug: "tdd",
      summary: "s",
      body: "b",
      deployed: [{ project: "p", mode: "full", date: "2026-11-14" }],
      templates: [{ name: "t.md", text: "x" }],
    },
    {
      kind: "prompt",
      id: "prompt:R",
      path: "Knowledge/prompty/R.md",
      name: "R",
      summary: "r",
      body: "b",
      projects: ["p"],
    },
  ],
  targets: [{ id: "p", name: "P", localPath: "~/p", owner: "personal", companyData: false }],
  skipped: 2,
};

describe("DeployQuerySchema", () => {
  it("przyjmuje project i mode", () => {
    expect(DeployQuerySchema.safeParse({ project: "p", mode: "full" }).success).toBe(true);
  });

  it("odrzuca nieznany tryb i pusty projekt", () => {
    expect(DeployQuerySchema.safeParse({ project: "p", mode: "x" }).success).toBe(false);
    expect(DeployQuerySchema.safeParse({ project: "", mode: "full" }).success).toBe(false);
    expect(DeployQuerySchema.safeParse({ project: null, mode: null }).success).toBe(false);
  });
});

describe("toCatalogDto", () => {
  it("daje DTO zgodne ze schematem", () => {
    const dto = toCatalogDto(catalog);
    expect(CatalogDtoSchema.parse(dto)).toEqual(dto);
    expect(dto.skipped).toBe(2);
    expect(dto.entries.map((e) => e.kind)).toEqual(["skill", "prompt"]);
  });

  it("nie przecieka referencjami modelu", () => {
    const dto = toEntryDto(catalog.entries[0]);
    expect(dto).not.toBe(catalog.entries[0]);
  });
});
