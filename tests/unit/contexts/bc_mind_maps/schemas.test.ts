// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CreateMindMapBodySchema,
  MindMapNodeSchema,
  SaveMindMapBodySchema,
  toMindMapDto,
} from "@/contexts/bc_mind_maps/schemas";

const leaf = { id: "c1", label: "Dziecko", note: "", collapsed: false, children: [] };
const root = { id: "root", label: "Mapa", note: "<p>x</p>", collapsed: true, children: [leaf] };

describe("MindMapNodeSchema", () => {
  it("accepts a nested tree", () => {
    expect(MindMapNodeSchema.safeParse(root).success).toBe(true);
  });

  it("rejects a node without a note, with a non-boolean collapsed, and a bad nested node", () => {
    const { note: _note, ...noNote } = root;
    expect(MindMapNodeSchema.safeParse(noNote).success).toBe(false);
    expect(MindMapNodeSchema.safeParse({ ...root, collapsed: "yes" }).success).toBe(false);
    expect(
      MindMapNodeSchema.safeParse({ ...root, children: [{ ...leaf, label: 1 }] }).success
    ).toBe(false);
  });
});

describe("SaveMindMapBodySchema", () => {
  it("accepts an empty body", () => {
    expect(SaveMindMapBodySchema.safeParse({}).success).toBe(true);
  });

  it("coerces colWidths values to numbers and rejects non-numeric ones", () => {
    const ok = SaveMindMapBodySchema.safeParse({ colWidths: { "1": "200" } });
    expect(ok.success && ok.data.colWidths).toEqual({ "1": 200 });
    expect(SaveMindMapBodySchema.safeParse({ colWidths: { "1": "abc" } }).success).toBe(false);
  });
});

describe("CreateMindMapBodySchema", () => {
  it("accepts {} and a string title, rejects a non-string title", () => {
    expect(CreateMindMapBodySchema.safeParse({}).success).toBe(true);
    expect(CreateMindMapBodySchema.safeParse({ title: "X" }).success).toBe(true);
    expect(CreateMindMapBodySchema.safeParse({ title: 1 }).success).toBe(false);
  });
});

describe("toMindMapDto", () => {
  it("keeps exactly the map fields", () => {
    const dto = toMindMapDto({
      id: "a",
      title: "T",
      rootNode: root,
      colWidths: { 1: 200 },
      createdAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-12T11:00:00.000Z",
    });
    expect(Object.keys(dto).sort()).toEqual(
      ["colWidths", "createdAt", "id", "rootNode", "title", "updatedAt"].sort()
    );
  });

  it("omits the timestamps from JSON when the model has none", () => {
    const dto = toMindMapDto({ id: "a", title: "T", rootNode: root, colWidths: {} });
    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      id: "a",
      title: "T",
      rootNode: root,
      colWidths: {},
    });
  });
});
