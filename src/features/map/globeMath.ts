export type Vec3 = { x: number; y: number; z: number };
export type LayoutCluster = {
  id: string;
  group: "projects" | "knowledge" | "ai2030" | "skills";
  size: number;
  soon?: boolean;
};
export type LayoutClusterEdge = { from: string; to: string; weight: number };
export type ClusterPlacement = { center: Vec3; radius: number };
export type Projected = { x: number; y: number; z: number; scale: number };
export type ProjectedNode = { id: string; x: number; y: number; z: number; r: number };

const TAU = Math.PI * 2;
const CAMERA = 3;
const EPS = 1e-6;
export const CLICK_THRESHOLD_PX = 4;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 6;
/** Od tego zoomu pokazujemy podpisy punktów. */
export const POINT_LABEL_ZOOM = 2.5;
export const PATCH_BASE = 0.1;
export const PATCH_PER_SQRT = 0.045;
export const PATCH_GAP = 0.04;
/** Docelowa część powierzchni kuli zajmowana przez płaty (pola nie są rysowane, ale rozkładają punkty). */
export const PATCH_COVERAGE = 0.65;
const PATCH_MAX = 1.3;
/** Minimalny promień trafienia punktu (px), żeby mały punkt dało się kliknąć. */
export const MIN_HIT_RADIUS = 5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ITER_MAIN = 200;
const ITER_FINAL = 200;
const ATTRACT = 0.004;
const GROUP_ORDER = { projects: 0, knowledge: 1, ai2030: 2, skills: 3 } as const;
/** Węzły na tylnej półkuli poniżej tego `z` nie reagują na klik. */
export const HIT_MIN_Z = -0.2;

/** `lon`/`lat` w radianach; `lon=0, lat=0` leży na wprost widza (`z=1`). */
export function fromLonLat(lon: number, lat: number): Vec3 {
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

/** Kąt do przedziału (−π, π]. */
export function wrapAngle(a: number): number {
  const t = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return t === -Math.PI ? Math.PI : t;
}

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dotv = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const addScaled = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: a.x + b.x * k,
  y: a.y + b.y * k,
  z: a.z + b.z * k,
});

function tangentBasis(c: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(c.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const e1 = normalize(cross(helper, c));
  return [e1, cross(c, e1)];
}

/** Zakres zoomu 0,5–6; wartość nieliczbowa daje 1. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

export function stepZoom(z: number, factor: number): number {
  return clampZoom(z * factor);
}

/** Promień kątowy płatu (rad): Skille stały, reszta rośnie z pierwiastkiem liczby notatek. */
export function patchRadius(c: LayoutCluster): number {
  return c.soon ? PATCH_BASE : PATCH_BASE + PATCH_PER_SQRT * Math.sqrt(c.size);
}

/** Punkt w odległości kątowej `rho` od `center`, w kierunku `phi` w płaszczyźnie stycznej. */
export function capPoint(center: Vec3, rho: number, phi: number): Vec3 {
  const [e1, e2] = tangentBasis(center);
  const s = Math.sin(rho);
  const k = Math.cos(rho);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  return normalize({
    x: center.x * k + (e1.x * cp + e2.x * sp) * s,
    y: center.y * k + (e1.y * cp + e2.y * sp) * s,
    z: center.z * k + (e1.z * cp + e2.z * sp) * s,
  });
}

/** `n` punktów obwiedni płatu (okrąg o promieniu kątowym `radius` wokół `center`). */
export function capOutline(center: Vec3, radius: number, n: number): Vec3[] {
  return Array.from({ length: n }, (_, i) => capPoint(center, radius, (Math.PI * 2 * i) / n));
}

/**
 * `count` punktów w płacie na spirali Fibonacciego (kąt złoty); punkt 0 leży najbliżej środka, więc
 * wywołujący podaje notatki posortowane po liczbie powiązań malejąco.
 */
export function layoutPoints(center: Vec3, radius: number, count: number): Vec3[] {
  return Array.from({ length: count }, (_, k) =>
    capPoint(center, 0.92 * radius * Math.sqrt((k + 0.5) / count), k * GOLDEN_ANGLE)
  );
}

/** Pole czapy sferycznej o promieniu kątowym `r` (rad², kula ma 4π). */
const capArea = (r: number): number => 2 * Math.PI * (1 - Math.cos(r));

/**
 * Skaluje promienie płatów tak, żeby razem zajmowały `PATCH_COVERAGE` powierzchni kuli (wspólny
 * mnożnik, bisekcja; nigdy nie zmniejsza względem wzoru). Dzięki temu punkty rozkładają się po całym globie.
 */
function scaledRadii(raw: number[]): number[] {
  const target = PATCH_COVERAGE * 4 * Math.PI;
  const total = (k: number) => raw.reduce((sum, r) => sum + capArea(Math.min(PATCH_MAX, r * k)), 0);
  if (total(1) >= target) return raw;
  let lo = 1;
  let hi = 8;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (total(mid) < target) lo = mid;
    else hi = mid;
  }
  return raw.map((r) => Math.min(PATCH_MAX, r * hi));
}

/** Styczna w `from` skierowana od (`away`) albo ku (`!away`) punktowi `other`. */
function tangentToward(from: Vec3, other: Vec3, away: boolean, fallbackSign: number): Vec3 {
  const diff = away
    ? { x: from.x - other.x, y: from.y - other.y, z: from.z - other.z }
    : { x: other.x - from.x, y: other.y - from.y, z: other.z - from.z };
  const along = dotv(diff, from);
  const t = { x: diff.x - from.x * along, y: diff.y - from.y * along, z: diff.z - from.z * along };
  if (Math.hypot(t.x, t.y, t.z) < 1e-9) {
    const e1 = tangentBasis(from)[0];
    return { x: e1.x * fallbackSign, y: e1.y * fallbackSign, z: e1.z * fallbackSign };
  }
  return normalize(t);
}

/**
 * Deterministyczny układ płatów na kuli (bez losowości). Start: punkty spirali Fibonacciego w kolejności
 * grup (pasy szerokości odpowiadają grupom), potem relaksacja: odpychanie do `Ri + Rj + PATCH_GAP`
 * i (tylko w fazie głównej) słabe przyciąganie krawędziami.
 */
export function layoutClusters(
  clusters: LayoutCluster[],
  edges: LayoutClusterEdge[]
): Record<string, ClusterPlacement> {
  const ordered = clusters
    .map((c, index) => ({ c, index }))
    .sort((a, b) => GROUP_ORDER[a.c.group] - GROUP_ORDER[b.c.group] || a.index - b.index)
    .map(({ c }) => c);
  const n = ordered.length;
  if (n === 0) return {};
  const radius = scaledRadii(ordered.map(patchRadius));
  const indexOf = new Map(ordered.map((c, i) => [c.id, i]));
  const centers: Vec3[] = ordered.map((_, i) =>
    fromLonLat(i * GOLDEN_ANGLE, Math.asin(1 - (2 * (i + 0.5)) / n))
  );
  const weight = new Map<string, number>();
  for (const e of edges) {
    const a = indexOf.get(e.from);
    const b = indexOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    weight.set(key, (weight.get(key) ?? 0) + e.weight);
  }

  for (let it = 0; it < ITER_MAIN + ITER_FINAL; it += 1) {
    const disp: Vec3[] = centers.map(() => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const d = Math.acos(Math.max(-1, Math.min(1, dotv(centers[i], centers[j]))));
        const minD = radius[i] + radius[j] + PATCH_GAP;
        if (d < minD) {
          const push = (minD - d) / 2;
          disp[i] = addScaled(disp[i], tangentToward(centers[i], centers[j], true, 1), push);
          disp[j] = addScaled(disp[j], tangentToward(centers[j], centers[i], true, -1), push);
        } else if (it < ITER_MAIN) {
          const w = weight.get(`${i}:${j}`);
          if (w === undefined) continue;
          const pull = Math.min(ATTRACT * Math.log(1 + w), (d - minD) / 2);
          disp[i] = addScaled(disp[i], tangentToward(centers[i], centers[j], false, 1), pull);
          disp[j] = addScaled(disp[j], tangentToward(centers[j], centers[i], false, -1), pull);
        }
      }
    }
    for (let i = 0; i < n; i += 1) centers[i] = normalize(addScaled(centers[i], disp[i], 1));
  }

  const out: Record<string, ClusterPlacement> = {};
  ordered.forEach((c, i) => {
    out[c.id] = { center: centers[i], radius: radius[i] };
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

/** Promień kuli dopasowany do płótna (zoom 1×). */
export function fitRadius(w: number, h: number): number {
  return Math.min(w, h) * 0.36;
}

/** Rzut perspektywiczny; `scale` > 1 dla punktów przed kulą, < 1 za nią; `y` rośnie w dół ekranu. */
export function project(p: Vec3, w: number, h: number, zoom = 1): Projected {
  const scale = CAMERA / (CAMERA - p.z);
  const r = fitRadius(w, h) * clampZoom(zoom);
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
    if (Math.hypot(n.x - x, n.y - y) <= Math.max(n.r, MIN_HIT_RADIUS) + pad) return n.id;
  }
  return null;
}

/** Przesunięcie poniżej 4 px od wciśnięcia to klik, nie przeciągnięcie. */
export function isClick(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < CLICK_THRESHOLD_PX;
}
