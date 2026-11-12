// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeStatus, isKnownCollection } from "@/scripts/export-firestore/manifest";
import type { CollectionEntry } from "@/scripts/export-firestore/types";

function entry(over: Partial<CollectionEntry>): CollectionEntry {
  return {
    path: "users/u1/tasks",
    file: "users/u1/tasks.jsonl",
    known: true,
    before: 3,
    lines: 3,
    after: 3,
    sha256: "x",
    ...over,
  };
}

describe("isKnownCollection", () => {
  it("looks at the last path segment", () => {
    expect(isKnownCollection("users/u1/tasks")).toBe(true);
    expect(isKnownCollection("waitlist")).toBe(true);
    expect(isKnownCollection("mystery")).toBe(false);
    expect(isKnownCollection("users/u1/board/main/history")).toBe(false);
    // historyczne po usuniętym module Wiedza/RAG
    expect(isKnownCollection("users/u1/knowledgeNodes")).toBe(true);
    expect(isKnownCollection("users/u1/knowledgeEdges")).toBe(true);
  });
});

describe("computeStatus", () => {
  it("is ok when before == lines == after and nothing unknown holds data", () => {
    expect(
      computeStatus([
        entry({}),
        entry({ path: "mystery", known: false, before: 0, lines: 0, after: 0 }),
      ])
    ).toBe("ok");
  });

  it("is mismatch when any count disagrees", () => {
    expect(computeStatus([entry({ lines: 2 })])).toBe("mismatch");
    expect(computeStatus([entry({ before: 2 })])).toBe("mismatch");
    expect(computeStatus([entry({ after: 4 })])).toBe("mismatch");
  });

  it("is needs-review when an unknown collection has documents", () => {
    expect(computeStatus([entry({ path: "mystery", known: false })])).toBe("needs-review");
  });

  it("mismatch wins over needs-review", () => {
    expect(computeStatus([entry({ path: "mystery", known: false, lines: 1 })])).toBe("mismatch");
  });
});
