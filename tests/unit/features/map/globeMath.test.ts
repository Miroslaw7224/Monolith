import { describe, expect, it } from "vitest";
import {
  arcPoints,
  capOutline,
  clampZoom,
  fitRadius,
  fromLonLat,
  hitTest,
  isClick,
  layoutClusters,
  layoutPoints,
  PATCH_COVERAGE,
  patchRadius,
  project,
  rotate,
  rotationTo,
  stepZoom,
  wrapAngle,
  type LayoutCluster,
  type Vec3,
} from "@/src/features/map/globeMath";

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const KNOWLEDGE_SIZES = [55, 36, 34, 21, 20, 15, 8, 7, 6, 5, 5, 3];
const realistic = (): LayoutCluster[] => [
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `p${i}`,
    group: "projects" as const,
    size: 4,
  })),
  ...KNOWLEDGE_SIZES.map((size, i) => ({ id: `k${i}`, group: "knowledge" as const, size })),
  { id: "ai", group: "ai2030" as const, size: 4 },
  { id: "skille", group: "skills" as const, size: 0, soon: true },
];
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

describe("layoutClusters", () => {
  const edges = [
    { from: "k0", to: "p0", weight: 6 },
    { from: "k1", to: "p1", weight: 2 },
  ];
  it("puste wejście daje pusty układ", () => {
    expect(layoutClusters([], [])).toEqual({});
  });
  it("jest deterministyczny", () => {
    expect(JSON.stringify(layoutClusters(realistic(), edges))).toBe(
      JSON.stringify(layoutClusters(realistic(), edges))
    );
  });
  it("środki leżą na sferze jednostkowej, promienie proporcjonalne do wzoru", () => {
    const input = realistic();
    const lay = layoutClusters(input, edges);
    for (const { center } of Object.values(lay)) expect(len(center)).toBeCloseTo(1, 9);
    const byId = Object.fromEntries(input.map((c) => [c.id, c]));
    const ratio = (id: string) => lay[id].radius / patchRadius(byId[id]);
    expect(ratio("p0")).toBeGreaterThan(1);
    expect(ratio("k0")).toBeCloseTo(ratio("p0"), 9);
    expect(ratio("skille")).toBeCloseTo(ratio("p0"), 9);
  });
  it("płaty pokrywają ustalony ułamek kuli (punkty są rozłożone po całym globie)", () => {
    const lay = layoutClusters(realistic(), edges);
    const area = Object.values(lay).reduce(
      (sum, { radius }) => sum + 2 * Math.PI * (1 - Math.cos(radius)),
      0
    );
    expect(area / (4 * Math.PI)).toBeCloseTo(PATCH_COVERAGE, 3);
  });
  it("płaty 21 skupisk się nie nakładają", () => {
    const lay = layoutClusters(realistic(), edges);
    const ids = Object.keys(lay);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = lay[ids[i]];
        const b = lay[ids[j]];
        expect(angle(a.center, b.center)).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
      }
    }
  });
  it("dwa skupiska startujące w tym samym miejscu nie dają NaN", () => {
    const lay = layoutClusters(
      [
        { id: "a", group: "projects", size: 1 },
        { id: "b", group: "projects", size: 1 },
      ],
      []
    );
    for (const { center } of Object.values(lay)) {
      expect(Number.isNaN(center.x + center.y + center.z)).toBe(false);
    }
  });
});

describe("patchRadius", () => {
  it("rośnie z pierwiastkiem liczby notatek, Skille ma stały", () => {
    expect(patchRadius({ id: "x", group: "projects", size: 0 })).toBeCloseTo(0.1, 9);
    expect(patchRadius({ id: "x", group: "knowledge", size: 36 })).toBeCloseTo(0.1 + 0.045 * 6, 9);
    expect(patchRadius({ id: "s", group: "skills", size: 99, soon: true })).toBeCloseTo(0.1, 9);
  });
});

describe("layoutPoints / capOutline", () => {
  const center = fromLonLat(0.7, 0.3);
  it("zwraca n punktów na sferze, w czapie 0,92·R, deterministycznie", () => {
    const pts = layoutPoints(center, 0.4, 55);
    expect(pts).toHaveLength(55);
    for (const p of pts) {
      expect(len(p)).toBeCloseTo(1, 9);
      expect(angle(p, center)).toBeLessThanOrEqual(0.4 * 0.92 + 1e-9);
    }
    expect(JSON.stringify(layoutPoints(center, 0.4, 55))).toBe(JSON.stringify(pts));
  });
  it("pierwszy punkt jest najbliżej środka, a punkty są różne", () => {
    const pts = layoutPoints(center, 0.4, 20);
    const d0 = angle(pts[0], center);
    for (const p of pts.slice(1)) expect(angle(p, center)).toBeGreaterThan(d0);
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        expect(dist(pts[i], pts[j])).toBeGreaterThan(1e-3);
      }
    }
  });
  it("zero notatek daje pustą listę; obwiednia leży w stałej odległości od środka", () => {
    expect(layoutPoints(center, 0.4, 0)).toEqual([]);
    for (const p of capOutline(center, 0.4, 24)) {
      expect(dot(p, center)).toBeCloseTo(Math.cos(0.4), 9);
    }
  });
  it("działa też przy środku na biegunie", () => {
    const pole = { x: 0, y: 1, z: 0 };
    for (const p of layoutPoints(pole, 0.3, 10)) expect(len(p)).toBeCloseTo(1, 9);
  });
});

describe("zoom", () => {
  it("clampZoom przycina do 0,5–6, NaN daje 1", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(99)).toBe(6);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
  it("stepZoom mnoży i przycina", () => {
    expect(stepZoom(1, 1.25)).toBeCloseTo(1.25, 9);
    expect(stepZoom(5, 1.25)).toBe(6);
    expect(stepZoom(0.55, 0.8)).toBe(0.5);
  });
  it("project skaluje promień kuli przez zoom, a fitRadius zależy od krótszego boku", () => {
    expect(fitRadius(400, 300)).toBeCloseTo(300 * 0.36, 9);
    const x1 = project({ x: 1, y: 0, z: 0 }, 400, 300).x - 200;
    const x2 = project({ x: 1, y: 0, z: 0 }, 400, 300, 2).x - 200;
    expect(x2).toBeCloseTo(2 * x1, 9);
  });
});

describe("rotate / rotationTo", () => {
  it("rotationTo sprowadza punkt na wprost widza", () => {
    for (const [lon, lat] of [
      [0.3, 0.4],
      [2.5, -0.7],
      [-1.9, 0.1],
    ]) {
      const p = fromLonLat(lon, lat);
      const { yaw, pitch } = rotationTo(p);
      const r = rotate(p, yaw, pitch);
      expect(r.x).toBeCloseTo(0, 9);
      expect(r.y).toBeCloseTo(0, 9);
      expect(r.z).toBeCloseTo(1, 9);
    }
  });

  it("rotate zachowuje długość", () => {
    expect(len(rotate({ x: 0.2, y: 0.5, z: 0.84 }, 1.1, -0.4))).toBeCloseTo(
      len({ x: 0.2, y: 0.5, z: 0.84 }),
      9
    );
  });
});

describe("project", () => {
  it("punkt przed kulą jest większy niż za kulą", () => {
    const front = project({ x: 0, y: 0, z: 1 }, 400, 400);
    const back = project({ x: 0, y: 0, z: -1 }, 400, 400);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.z).toBe(1);
  });

  it("środek kuli ląduje na środku płótna, y rośnie w dół ekranu", () => {
    const c = project({ x: 0, y: 0, z: 0 }, 400, 300);
    expect(c.x).toBeCloseTo(200, 9);
    expect(c.y).toBeCloseTo(150, 9);
    expect(project({ x: 0, y: 1, z: 0 }, 400, 300).y).toBeLessThan(150);
  });
});

describe("arcPoints", () => {
  it("zaczyna i kończy w węzłach, wszystkie punkty na sferze", () => {
    const a = fromLonLat(0.2, 0.3);
    const b = fromLonLat(2.0, -0.4);
    const pts = arcPoints(a, b, 20);
    expect(pts).toHaveLength(21);
    expect(dist(pts[0], a)).toBeCloseTo(0, 9);
    expect(dist(pts[20], b)).toBeCloseTo(0, 9);
    for (const p of pts) expect(len(p)).toBeCloseTo(1, 9);
  });

  it("punkty antypodalne nie dają NaN i omijają środek kuli", () => {
    const a = { x: 0, y: 0, z: 1 };
    const b = { x: 0, y: 0, z: -1 };
    const pts = arcPoints(a, b, 16);
    for (const p of pts) {
      expect(Number.isNaN(p.x + p.y + p.z)).toBe(false);
      expect(len(p)).toBeCloseTo(1, 6);
    }
    expect(dist(pts[0], a)).toBeCloseTo(0, 6);
    expect(dist(pts[16], b)).toBeCloseTo(0, 6);
  });

  it("ten sam punkt daje stały łuk bez NaN", () => {
    const a = fromLonLat(1, 0.2);
    for (const p of arcPoints(a, a, 4)) expect(dist(p, a)).toBeCloseTo(0, 9);
  });
});

describe("hitTest / isClick / wrapAngle", () => {
  const nodes = [
    { id: "back", x: 100, y: 100, z: -0.5, r: 10 },
    { id: "near", x: 100, y: 100, z: 0.8, r: 10 },
    { id: "far", x: 300, y: 300, z: 0.1, r: 10 },
  ];
  it("wybiera najbliższy widzowi węzeł (z malejąco), ignoruje tylną półkulę", () => {
    expect(hitTest(nodes, 102, 101)).toBe("near");
    expect(hitTest([nodes[0]], 100, 100)).toBeNull();
  });
  it("trafienie w promieniu + margines, pudło daje null", () => {
    expect(hitTest(nodes, 300 + 13, 300)).toBe("far");
    expect(hitTest(nodes, 300 + 20, 300)).toBeNull();
  });
  it("mały punkt da się trafić w granicach 5 px + pad", () => {
    const tiny = [{ id: "p", x: 100, y: 100, z: 0.5, r: 1 }];
    expect(hitTest(tiny, 108, 100)).toBe("p");
    expect(hitTest(tiny, 110, 100)).toBeNull();
  });
  it("próg kliknięcia to 4 px", () => {
    expect(isClick(3, 0)).toBe(true);
    expect(isClick(2.9, 2.9)).toBe(false);
    expect(isClick(4, 0)).toBe(false);
  });
  it("wrapAngle sprowadza do (−π, π]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5, 9);
  });
});
