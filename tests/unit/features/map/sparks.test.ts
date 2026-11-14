import { describe, expect, it } from "vitest";
import {
  SPARK_SPEED_MAX,
  SPARK_SPEED_MIN,
  pointAlong,
  retargetSparks,
  stepSparks,
  type Spark,
} from "@/src/features/map/sparks";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("pointAlong", () => {
  const pts = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: -1, y: 0, z: 0 },
  ];
  it("t=0 i t=1 dają końce łuku", () => {
    expect(pointAlong(pts, 0)).toEqual(pts[0]);
    const end = pointAlong(pts, 1);
    expect(end.x).toBeCloseTo(-1);
    expect(end.y).toBeCloseTo(0);
  });
  it("punkt pośredni leży na kuli jednostkowej", () => {
    const p = pointAlong(pts, 0.25);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1);
    expect(p.x).toBeCloseTo(Math.SQRT1_2);
    expect(p.y).toBeCloseTo(Math.SQRT1_2);
  });
  it("zachowuje wysokość nad kulą (promień interpolowany między próbkami)", () => {
    const up = [
      { x: 1.2, y: 0, z: 0 },
      { x: 0, y: 1.4, z: 0 },
    ];
    const p = pointAlong(up, 0.5);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1.3);
    expect(p.x / p.y).toBeCloseTo(0.6 / 0.7);
  });
  it("t poza zakresem jest przycinane", () => {
    expect(pointAlong(pts, -3)).toEqual(pts[0]);
    expect(pointAlong(pts, 9).x).toBeCloseTo(-1);
  });
});

describe("stepSparks", () => {
  const pool = ["a", "b", "c"];
  it("tworzy min(count, pool) iskier z t w [0,1) i prędkością z zakresu", () => {
    const sparks: Spark<string>[] = [];
    stepSparks(sparks, 0, pool, 10, 1, Math.random);
    expect(sparks).toHaveLength(3);
    for (const s of sparks) {
      expect(pool).toContain(s.edge);
      expect(s.t).toBeGreaterThanOrEqual(0);
      expect(s.t).toBeLessThan(1);
      expect(s.speed).toBeGreaterThanOrEqual(SPARK_SPEED_MIN);
      expect(s.speed).toBeLessThanOrEqual(SPARK_SPEED_MAX);
    }
  });
  it("pusta pula usuwa iskry", () => {
    const sparks: Spark<string>[] = [{ edge: "a", t: 0.5, speed: 0.2 }];
    stepSparks(sparks, 0.1, [], 10, 1, Math.random);
    expect(sparks).toHaveLength(0);
  });
  it("zmniejszony count obcina listę", () => {
    const sparks: Spark<string>[] = [];
    stepSparks(sparks, 0, pool, 3, 1, Math.random);
    stepSparks(sparks, 0, pool, 1, 1, Math.random);
    expect(sparks).toHaveLength(1);
  });
  it("przesuwa t o speed*dt*speedMul", () => {
    const sparks: Spark<string>[] = [{ edge: "a", t: 0.1, speed: 0.2 }];
    stepSparks(sparks, 0.5, ["a"], 1, 2, Math.random);
    expect(sparks[0].t).toBeCloseTo(0.3);
  });
  it("po dojściu do końca losuje nową krawędź i zaczyna od początku", () => {
    const sparks: Spark<string>[] = [{ edge: "a", t: 0.95, speed: 0.2 }];
    stepSparks(sparks, 1, pool, 1, 1, seq(0.99, 0.5));
    expect(sparks[0].edge).toBe("c");
    expect(sparks[0].t).toBeGreaterThanOrEqual(0);
    expect(sparks[0].t).toBeLessThan(0.2);
  });
});

describe("retargetSparks", () => {
  it("przypisuje krawędzie z nowej puli, zachowując t i prędkość", () => {
    const sparks: Spark<string>[] = [
      { edge: "old", t: 0.4, speed: 0.25 },
      { edge: "old", t: 0.8, speed: 0.15 },
    ];
    retargetSparks(sparks, ["x", "y"], Math.random);
    for (const s of sparks) expect(["x", "y"]).toContain(s.edge);
    expect(sparks[0].t).toBe(0.4);
    expect(sparks[1].speed).toBe(0.15);
  });
  it("pusta pula opróżnia listę", () => {
    const sparks: Spark<string>[] = [{ edge: "a", t: 0, speed: 0.2 }];
    retargetSparks(sparks, [], Math.random);
    expect(sparks).toHaveLength(0);
  });
});
