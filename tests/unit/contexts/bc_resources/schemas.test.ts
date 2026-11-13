// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CreateResourceBodySchema,
  UpdateResourceBodySchema,
  toDocumentDto,
  toResourceDto,
} from "@/contexts/bc_resources/schemas";

describe("toResourceDto", () => {
  it("copies all fields and drops undefined optionals from JSON", () => {
    const dto = toResourceDto({
      id: "r1",
      description: "d",
      url: "https://a.com",
      title: "A",
      tags: ["x"],
      isFavorite: true,
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      id: "r1",
      description: "d",
      url: "https://a.com",
      title: "A",
      tags: ["x"],
      isFavorite: true,
    });
  });
});

describe("toDocumentDto", () => {
  it("returns id, name, content, type, created_at", () => {
    expect(
      toDocumentDto({
        id: "d1",
        name: "n",
        content: "c",
        type: "t",
        created_at: "2026-01-01T00:00:00.000Z",
      })
    ).toEqual({
      id: "d1",
      name: "n",
      content: "c",
      type: "t",
      created_at: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("CreateResourceBodySchema", () => {
  it("defaults tags to []", () => {
    expect(CreateResourceBodySchema.parse({ description: "d", url: "https://a.com" }).tags).toEqual(
      []
    );
  });
  it("rejects an invalid url and an empty description", () => {
    expect(CreateResourceBodySchema.safeParse({ description: "d", url: "x" }).success).toBe(false);
    expect(
      CreateResourceBodySchema.safeParse({ description: "", url: "https://a.com" }).success
    ).toBe(false);
  });
});

describe("UpdateResourceBodySchema", () => {
  it("rejects an empty object and accepts a single field", () => {
    expect(UpdateResourceBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateResourceBodySchema.safeParse({ isFavorite: false }).success).toBe(true);
  });
});
