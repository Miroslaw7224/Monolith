// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  NexusDocDtoSchema,
  NexusDocPathParamsSchema,
  toDocDto,
  toSummaryDto,
} from "@/contexts/bc_nexus_docs/schemas";

const summary = {
  path: "Knowledge/a.md",
  area: "Knowledge" as const,
  group: "",
  title: "A",
  tags: ["x"],
};

describe("schemas bc_nexus_docs", () => {
  it("toSummaryDto kopiuje pola i tagi", () => {
    const dto = toSummaryDto(summary);
    expect(dto).toEqual(summary);
    expect(dto.tags).not.toBe(summary.tags);
  });

  it("toDocDto dodaje frontmatter i treść i przechodzi zod", () => {
    const dto = toDocDto({
      ...summary,
      frontmatter: [{ key: "title", value: "A" }],
      body: "treść",
    });
    expect(NexusDocDtoSchema.parse(dto)).toEqual(dto);
    expect(dto.body).toBe("treść");
  });

  it("parametr ścieżki: niepusta tablica napisów", () => {
    expect(NexusDocPathParamsSchema.safeParse({ path: ["Knowledge", "a.md"] }).success).toBe(true);
    expect(NexusDocPathParamsSchema.safeParse({ path: [] }).success).toBe(false);
    expect(NexusDocPathParamsSchema.safeParse({ path: "Knowledge/a.md" }).success).toBe(false);
    expect(NexusDocPathParamsSchema.safeParse({}).success).toBe(false);
  });
});
