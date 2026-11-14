import { describe, expect, it } from "vitest";
import {
  BREATH_AMP,
  GLOBE_BREATH_AMP,
  RIM_MAX_WOBBLE,
  approach,
  breathScale,
  globeBreath,
  idPhase,
  rimFactor,
  slowPulse,
} from "@/src/features/map/motion";

describe("idPhase", () => {
  it("jest stały dla tego samego id i leży w [0, 2π)", () => {
    expect(idPhase("note:a")).toBe(idPhase("note:a"));
    for (const id of ["a", "b", "knowledge/x.md", ""]) {
      expect(idPhase(id)).toBeGreaterThanOrEqual(0);
      expect(idPhase(id)).toBeLessThan(2 * Math.PI);
    }
  });
  it("różne id dają różne fazy", () => {
    const phases = new Set(["a", "b", "c", "d", "e", "f"].map(idPhase));
    expect(phases.size).toBe(6);
  });
});

describe("breathScale", () => {
  it("mieści się w 1 ± BREATH_AMP", () => {
    for (let t = 0; t < 20000; t += 137) {
      const s = breathScale(t, "x");
      expect(s).toBeGreaterThanOrEqual(1 - BREATH_AMP - 1e-9);
      expect(s).toBeLessThanOrEqual(1 + BREATH_AMP + 1e-9);
    }
  });
  it("węzły oddychają w różnych fazach", () => {
    expect(breathScale(1000, "a")).not.toBeCloseTo(breathScale(1000, "b"), 3);
  });
  it("faktycznie się zmienia w czasie", () => {
    const values = new Set([0, 500, 1000, 1500, 2000].map((t) => breathScale(t, "a").toFixed(4)));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe("slowPulse", () => {
  it("zwraca wartości z [0,1] i się zmienia", () => {
    const vals: number[] = [];
    for (let t = 0; t < 12000; t += 250) vals.push(slowPulse(t));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.8);
  });
});

describe("approach", () => {
  it("przybliża się do celu bez przeskoku", () => {
    const v = approach(0, 1, 0.05, 10);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
    expect(approach(v, 1, 0.05, 10)).toBeGreaterThan(v);
  });
  it("dt=0 nie zmienia wartości", () => {
    expect(approach(0.3, 1, 0, 10)).toBe(0.3);
  });
  it("duże dt dochodzi do celu, bliski cel jest przyciągany", () => {
    expect(approach(0, 1, 5, 10)).toBe(1);
    expect(approach(0.998, 1, 0.001, 10)).toBe(1);
    expect(approach(1, 0, 5, 10)).toBe(0);
  });
});

describe("globeBreath / rimFactor", () => {
  it("globeBreath mieści się w 1 ± GLOBE_BREATH_AMP i się zmienia", () => {
    const vals: number[] = [];
    for (let t = 0; t < 12000; t += 200) vals.push(globeBreath(t));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(1 - GLOBE_BREATH_AMP - 1e-9);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1 + GLOBE_BREATH_AMP + 1e-9);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(GLOBE_BREATH_AMP);
  });
  it("rimFactor jest okresowy po kącie i ograniczony", () => {
    for (const t of [0, 1234, 9000]) {
      for (let a = 0; a < 2 * Math.PI; a += 0.3) {
        const f = rimFactor(a, t);
        expect(f).toBeGreaterThan(1 - RIM_MAX_WOBBLE - 1e-9);
        expect(f).toBeLessThan(1 + RIM_MAX_WOBBLE + 1e-9);
        expect(rimFactor(a + 2 * Math.PI, t)).toBeCloseTo(f);
      }
    }
  });
  it("brzeg nie jest idealnym okręgiem i faluje w czasie", () => {
    const at = (t: number) => [0, 1, 2, 3, 4, 5].map((a) => rimFactor(a, t).toFixed(5));
    expect(new Set(at(500)).size).toBeGreaterThan(1);
    expect(at(500)).not.toEqual(at(4000));
  });
});
