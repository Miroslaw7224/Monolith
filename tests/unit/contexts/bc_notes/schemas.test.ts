// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NoteBodySchema, toNoteDto } from "@/contexts/bc_notes/schemas";

describe("toNoteDto", () => {
  it("pomija updated_at (kształt odpowiedzi GET)", () => {
    expect(
      toNoteDto({
        id: "n1",
        title: "T",
        content: "C",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      })
    ).toEqual({ id: "n1", title: "T", content: "C", created_at: "2026-01-01T00:00:00.000Z" });
  });
});

describe("NoteBodySchema", () => {
  it("nie odrzuca nieznanych pól, tylko je pomija (strip)", () => {
    const parsed = NoteBodySchema.safeParse({ title: "T", content: "C", extra: 1 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ title: "T", content: "C" });
  });

  it("traktuje nie-obiekt jako puste body", () => {
    const parsed = NoteBodySchema.safeParse([1, 2]);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({});
  });
});
