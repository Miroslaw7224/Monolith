import { describe, expect, it } from "vitest";
import {
  ARC_LIFT,
  PEAK_HEIGHT,
  VALLEY_DEPTH,
  elevate,
  liftedArc,
  nodeHeight,
} from "@/src/features/map/relief";
import { fromLonLat } from "@/src/features/map/globeMath";

const len = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);

describe("nodeHeight", () => {
  it("węzeł bez połączeń leży w dolinie, najbardziej połączony na szczycie", () => {
    expect(nodeHeight(0, 10)).toBeCloseTo(-VALLEY_DEPTH);
    expect(nodeHeight(10, 10)).toBeCloseTo(PEAK_HEIGHT);
  });
  it("rośnie monotonicznie z liczbą połączeń", () => {
    let prev = -Infinity;
    for (let l = 0; l <= 10; l += 1) {
      const h = nodeHeight(l, 10);
      expect(h).toBeGreaterThan(prev);
      prev = h;
    }
  });
  it("brak połączeń w całych danych daje płasko (0)", () => {
    expect(nodeHeight(0, 0)).toBe(0);
  });
  it("liczba większa od maksimum jest przycinana do szczytu", () => {
    expect(nodeHeight(50, 10)).toBeCloseTo(PEAK_HEIGHT);
  });
});

describe("elevate", () => {
  it("skaluje promień punktu o 1 + h", () => {
    const p = elevate(fromLonLat(0.5, 0.3), 0.1);
    expect(len(p)).toBeCloseTo(1.1);
  });
});

describe("liftedArc", () => {
  const a = fromLonLat(0, 0);
  const b = fromLonLat(1.4, 0.2);
  it("ma n+1 punktów, a końce leżą na wzniesionych węzłach", () => {
    const pts = liftedArc(a, b, 0.05, -0.01, 8, null);
    expect(pts).toHaveLength(9);
    expect(len(pts[0])).toBeCloseTo(1.05);
    expect(len(pts[8])).toBeCloseTo(0.99);
  });
  it("środek łuku wznosi się nad końce, a dłuższy łuk wyżej niż krótszy", () => {
    const long = liftedArc(a, fromLonLat(2.6, 0), 0, 0, 8, null);
    const short = liftedArc(a, fromLonLat(0.35, 0), 0, 0, 8, null);
    expect(len(long[4])).toBeGreaterThan(1 + ARC_LIFT * 0.5 * 0.8);
    expect(len(long[4])).toBeGreaterThan(len(short[4]));
    expect(len(short[4])).toBeGreaterThan(1);
  });
  it("falowanie zmienia środek, ale nie końce", () => {
    const still = liftedArc(a, b, 0, 0, 8, null);
    const rippled = liftedArc(a, b, 0, 0, 8, Math.PI / 2);
    expect(len(rippled[0])).toBeCloseTo(len(still[0]));
    expect(len(rippled[8])).toBeCloseTo(len(still[8]));
    expect(len(rippled[3])).not.toBeCloseTo(len(still[3]), 4);
  });
  it("łuk między tym samym punktem nie daje NaN", () => {
    for (const p of liftedArc(a, a, 0.02, 0.02, 4, 1)) expect(Number.isFinite(len(p))).toBe(true);
  });
});
