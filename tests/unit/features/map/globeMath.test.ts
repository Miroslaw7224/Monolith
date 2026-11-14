import { describe, expect, it } from "vitest";
import {
  arcPoints,
  fromLonLat,
  globeRadius,
  hitTest,
  isClick,
  layoutNodes,
  project,
  rotate,
  rotationTo,
  wrapAngle,
  type Vec3,
} from "@/src/features/map/globeMath";

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const CONT = [
  { id: "@a", kind: "continent" as const },
  { id: "@b", kind: "continent" as const },
  { id: "@c", kind: "continent" as const },
];

describe("layoutNodes", () => {
  const nodes = [
    ...CONT,
    ...["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, kind: "project" as const })),
    { id: "free", kind: "project" as const },
  ];
  const edges = ["p1", "p2", "p3", "p4", "p5", "p6"].map((p) => ({ from: p, to: "@a", weight: 1 }));

  it("jest deterministyczny", () => {
    expect(layoutNodes(nodes, edges)).toEqual(
      layoutNodes([...nodes].reverse(), [...edges].reverse())
    );
  });

  it("wszystkie punkty leżą na sferze jednostkowej", () => {
    for (const v of Object.values(layoutNodes(nodes, edges))) expect(len(v)).toBeCloseTo(1, 9);
  });

  it("kotwice kontynentów są rozłożone (cięciwa 120° ≈ 1,73)", () => {
    const pos = layoutNodes(nodes, edges);
    expect(dist(pos["@a"], pos["@b"])).toBeGreaterThan(1.5);
    expect(dist(pos["@b"], pos["@c"])).toBeGreaterThan(1.5);
    expect(dist(pos["@a"], pos["@c"])).toBeGreaterThan(1.5);
  });

  it("projekty z jednego sektora nie nakładają się", () => {
    const pos = layoutNodes(nodes, edges);
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        expect(dist(pos[ids[i]], pos[ids[j]])).toBeGreaterThan(0.2);
      }
    }
  });

  it("projekt leży bliżej kontynentu o największej wadze; remis: pierwszy alfabetycznie", () => {
    const pos = layoutNodes(
      [...CONT, { id: "x", kind: "project" }, { id: "y", kind: "project" }],
      [
        { from: "x", to: "@a", weight: 1 },
        { from: "x", to: "@b", weight: 3 },
        { from: "y", to: "@c", weight: 2 },
        { from: "y", to: "@b", weight: 2 },
      ]
    );
    expect(dot(pos.x, pos["@b"])).toBeGreaterThan(dot(pos.x, pos["@a"]));
    expect(dot(pos.y, pos["@b"])).toBeGreaterThan(dot(pos.y, pos["@c"]));
  });

  it("projekt bez krawędzi też dostaje punkt na sferze", () => {
    expect(len(layoutNodes(nodes, edges).free)).toBeCloseTo(1, 9);
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

  it("globeRadius zależy od krótszego boku", () => {
    expect(globeRadius(400, 300)).toBeCloseTo(300 * 0.36, 9);
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
