import { describe, expect, it } from "vitest";
import { toIso } from "@/lib/firestore/time";

describe("toIso", () => {
  it("converts a Firestore-like Timestamp (toDate)", () => {
    const ts = { toDate: () => new Date("2026-11-12T10:00:00.000Z") };
    expect(toIso(ts)).toBe("2026-11-12T10:00:00.000Z");
  });
  it("converts a Date", () => {
    expect(toIso(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("normalizes an ISO-like string and passes through a valid ISO string", () => {
    expect(toIso("2026-11-12T10:00:00.000Z")).toBe("2026-11-12T10:00:00.000Z");
    expect(toIso("2026-11-12")).toBe("2026-11-12T00:00:00.000Z");
  });
  it("converts epoch milliseconds", () => {
    expect(toIso(1_000)).toBe("1970-01-01T00:00:01.000Z");
  });
  it("returns undefined for null, undefined, garbage and invalid dates", () => {
    expect(toIso(null)).toBeUndefined();
    expect(toIso(undefined)).toBeUndefined();
    expect(toIso("not a date")).toBeUndefined();
    expect(toIso({})).toBeUndefined();
    expect(toIso({ toDate: () => new Date("x") })).toBeUndefined();
  });
});
