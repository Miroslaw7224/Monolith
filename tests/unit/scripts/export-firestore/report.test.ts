// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatCountReport, type CountReport } from "@/scripts/export-firestore/run";

const base: CountReport = {
  rows: [
    { path: "users/u1/tasks", count: 3, known: true },
    { path: "mystery", count: 1, known: false },
  ],
  ghosts: ["users/ghost"],
  total: 4,
  estimatedReads: 8,
};

describe("formatCountReport", () => {
  it("lists collections, ghosts, totals and flags unknown collections", () => {
    const text = formatCountReport(base);
    expect(text).toContain("users/u1/tasks");
    expect(text).toContain("3");
    expect(text).toMatch(/mystery.*NIEZNANA/);
    expect(text).toContain("users/ghost");
    expect(text).toMatch(/Razem dokumentów: 4/);
    expect(text).toMatch(/odczytów.*8/);
  });

  it("warns when estimated reads exceed 40k", () => {
    const text = formatCountReport({ ...base, total: 25000, estimatedReads: 50000 });
    expect(text).toMatch(/UWAGA.*limit/);
  });

  it("does not warn for small datasets", () => {
    expect(formatCountReport(base)).not.toMatch(/UWAGA/);
  });
});
