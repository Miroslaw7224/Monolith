export type Vec3 = { x: number; y: number; z: number };
export type LayoutNode = { id: string; kind: "project" | "continent" };
export type LayoutEdge = { from: string; to: string; weight: number };
export type Projected = { x: number; y: number; z: number; scale: number };
export type ProjectedNode = { id: string; x: number; y: number; z: number; r: number };

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const CAMERA = 3;
const EPS = 1e-6;
export const CLICK_THRESHOLD_PX = 4;
/** Węzły na tylnej półkuli poniżej tego `z` nie reagują na klik. */
export const HIT_MIN_Z = -0.2;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `lon`/`lat` w radianach; `lon=0, lat=0` leży na wprost widza (`z=1`). */
export function fromLonLat(lon: number, lat: number): Vec3 {
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

/** Kąt do przedziału (−π, π]. */
export function wrapAngle(a: number): number {
  const t = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return t === -Math.PI ? Math.PI : t;
}

/**
 * Deterministyczny układ na kuli (zależy tylko od danych). Kontynenty: równomiernie na równiku (kolejność
 * po `id`). Projekt: blisko kontynentu o największej wadze krawędzi (remis: pierwszy alfabetycznie),
 * na szerokości ±38° (naprzemiennie), rozsunięty po długości w sektorze kontynentu. Bez krawędzi:
 * równomiernie po długości, szerokość ±62°.
 */
export function layoutNodes(nodes: LayoutNode[], edges: LayoutEdge[]): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  const continents = nodes
    .filter((n) => n.kind === "continent")
    .map((n) => n.id)
    .sort(cmp);
  const projects = nodes
    .filter((n) => n.kind === "project")
    .map((n) => n.id)
    .sort(cmp);
  const sector = continents.length > 0 ? TAU / continents.length : TAU;
  const lonOf = new Map<string, number>();
  continents.forEach((id, i) => {
    lonOf.set(id, sector * i);
    out[id] = fromLonLat(sector * i, 0);
  });

  const groups = new Map<string, string[]>();
  const free: string[] = [];
  for (const p of projects) {
    let best: string | null = null;
    let bestWeight = 0;
    for (const e of edges) {
      const other = e.from === p ? e.to : e.to === p ? e.from : null;
      if (other === null || !lonOf.has(other)) continue;
      if (e.weight > bestWeight || (e.weight === bestWeight && best !== null && other < best)) {
        best = other;
        bestWeight = e.weight;
      }
    }
    if (best === null) free.push(p);
    else groups.set(best, [...(groups.get(best) ?? []), p]);
  }

  for (const [continent, ids] of groups) {
    const width = sector * 0.8;
    ids.forEach((id, j) => {
      const lon = (lonOf.get(continent) ?? 0) + width * ((j + 0.5) / ids.length - 0.5);
      out[id] = fromLonLat(lon, (j % 2 === 0 ? 1 : -1) * 38 * DEG);
    });
  }
  free.forEach((id, m) => {
    out[id] = fromLonLat((TAU * (m + 0.5)) / free.length, (m % 2 === 0 ? 1 : -1) * 62 * DEG);
  });
  return out;
}

/** Obrót wokół osi `y` o `yaw`, potem wokół `x` o `pitch`. */
export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

/** Kąty, po których `rotate` ustawia punkt dokładnie na wprost widza. */
export function rotationTo(p: Vec3): { yaw: number; pitch: number } {
  return { yaw: -Math.atan2(p.x, p.z), pitch: Math.atan2(p.y, Math.hypot(p.x, p.z)) };
}

export function globeRadius(w: number, h: number): number {
  return Math.min(w, h) * 0.36;
}

/** Rzut perspektywiczny; `scale` > 1 dla punktów przed kulą, < 1 za nią; `y` rośnie w dół ekranu. */
export function project(p: Vec3, w: number, h: number): Projected {
  const scale = CAMERA / (CAMERA - p.z);
  const r = globeRadius(w, h);
  return { x: w / 2 + p.x * r * scale, y: h / 2 - p.y * r * scale, z: p.z, scale };
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const theta = Math.acos(d);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, z: wa * a.z + wb * b.z };
}

/**
 * `n + 1` punktów łuku wielkiego koła od `a` do `b` (slerp). Dla punktów prawie antypodalnych
 * (`sin θ ≈ 0`) łuk przechodzi przez punkt pośredni prostopadły do obu; dla tego samego punktu
 * wszystkie punkty są równe `a`.
 */
export function arcPoints(a: Vec3, b: Vec3, n: number): Vec3[] {
  const count = Math.max(1, Math.floor(n));
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const out: Vec3[] = [];
  if (Math.sin(Math.acos(d)) < EPS) {
    if (d > 0) return Array.from({ length: count + 1 }, () => ({ ...a }));
    const helper: Vec3 = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const cx = a.y * helper.z - a.z * helper.y;
    const cy = a.z * helper.x - a.x * helper.z;
    const cz = a.x * helper.y - a.y * helper.x;
    const l = Math.hypot(cx, cy, cz);
    const mid: Vec3 = { x: cx / l, y: cy / l, z: cz / l };
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      out.push(t <= 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, (t - 0.5) * 2));
    }
    return out;
  }
  for (let i = 0; i <= count; i += 1) out.push(slerp(a, b, i / count));
  return out;
}

/** Najbliższy widzowi węzeł w promieniu `r + pad`; węzły z `z < HIT_MIN_Z` (tylna półkula) są ignorowane. */
export function hitTest(nodes: ProjectedNode[], x: number, y: number, pad = 4): string | null {
  const sorted = [...nodes].sort((a, b) => b.z - a.z);
  for (const n of sorted) {
    if (n.z < HIT_MIN_Z) continue;
    if (Math.hypot(n.x - x, n.y - y) <= n.r + pad) return n.id;
  }
  return null;
}

/** Przesunięcie poniżej 4 px od wciśnięcia to klik, nie przeciągnięcie. */
export function isClick(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < CLICK_THRESHOLD_PX;
}
