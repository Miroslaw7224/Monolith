import { describe, expect, it } from "vitest";
import {
  CORE_MAX_ALPHA,
  DUST_MAX_RADIUS,
  DUST_MIN_RADIUS,
  axonPulse,
  coreAlphas,
  dustPosition,
  makeDust,
  withAlpha,
} from "@/src/features/map/core";

describe("withAlpha", () => {
  it("zamienia #rrggbb i #rgb na rgba", () => {
    expect(withAlpha("#3d95ff", 0.5)).toBe("rgba(61, 149, 255, 0.5)");
    expect(withAlpha("#fa0", 0.25)).toBe("rgba(255, 170, 0, 0.25)");
  });
  it("zamienia rgb() i rgba() zachowując kanały", () => {
    expect(withAlpha("rgb(10, 20, 30)", 0.4)).toBe("rgba(10, 20, 30, 0.4)");
    expect(withAlpha("rgba(10,20,30,0.9)", 0.4)).toBe("rgba(10, 20, 30, 0.4)");
  });
  it("nieznany format daje kolor zapasowy", () => {
    expect(withAlpha("hsl(10 20% 30%)", 0.5, "#000000")).toBe("rgba(0, 0, 0, 0.5)");
  });
  it("przycina alfę do 0..1", () => {
    expect(withAlpha("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
  });
});

describe("coreAlphas", () => {
  it("jądro nie przekracza CORE_MAX_ALPHA, a brzeg jest ciemniejszy niż środek jądra", () => {
    for (const pulse of [0, 0.5, 1]) {
      const a = coreAlphas(pulse);
      expect(a.core).toBeGreaterThan(0);
      expect(a.core).toBeLessThanOrEqual(CORE_MAX_ALPHA);
      expect(a.edge).toBeGreaterThan(a.core * 0);
    }
  });
  it("puls zmienia jasność jądra", () => {
    expect(coreAlphas(1).core).toBeGreaterThan(coreAlphas(0).core);
  });
});

describe("makeDust / dustPosition", () => {
  it("jest deterministyczny i ma żądaną liczbę ziaren", () => {
    expect(makeDust(40)).toEqual(makeDust(40));
    expect(makeDust(40)).toHaveLength(40);
  });
  it("ziarna zostają wewnątrz kuli, w zadanym przedziale promieni, i się ruszają", () => {
    const dust = makeDust(50);
    for (const d of dust) {
      for (const t of [0, 3000, 17000, 90000]) {
        const p = dustPosition(d, t);
        const r = Math.hypot(p.x, p.y, p.z);
        expect(r).toBeGreaterThanOrEqual(DUST_MIN_RADIUS - 0.05);
        expect(r).toBeLessThanOrEqual(DUST_MAX_RADIUS + 0.05);
      }
    }
    const a = dustPosition(dust[0], 0);
    const b = dustPosition(dust[0], 5000);
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.01);
  });
});

describe("axonPulse", () => {
  it("zwraca postęp z [0,1), stały dla id i przesuwający się w czasie", () => {
    for (let t = 0; t < 30000; t += 997) {
      const v = axonPulse(t, "c1");
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(axonPulse(1000, "c1")).toBe(axonPulse(1000, "c1"));
    expect(axonPulse(1000, "c1")).not.toBe(axonPulse(2000, "c1"));
  });
  it("różne skupiska mają różne fazy", () => {
    expect(axonPulse(500, "a")).not.toBeCloseTo(axonPulse(500, "b"), 3);
  });
});
