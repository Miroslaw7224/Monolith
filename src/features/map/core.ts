import type { Vec3 } from "./globeMath";
import { idPhase } from "./motion";

/** Największa alfa świecącego jądra: wyżej tylne łuki przestają być czytelne. */
export const CORE_MAX_ALPHA = 0.25;
/** Zakres promieni (w promieniach kuli), w którym dryfuje pył. */
export const DUST_MIN_RADIUS = 0.2;
export const DUST_MAX_RADIUS = 0.75;
/** Okres sygnału biegnącego po aksonie z jądra do skupiska (ms). */
const AXON_PERIOD = 4200;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Kolor CSS (#rgb, #rrggbb, rgb(), rgba()) z nową alfą; nieznany format zastępuje kolorem `fallback`. */
export function withAlpha(color: string, alpha: number, fallback = "#ffffff"): string {
  const a = clamp01(alpha);
  const parse = (c: string): [number, number, number] | null => {
    const s = c.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (hex) {
      const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    }
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(s);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
  };
  const [r, g, b] = parse(color) ?? parse(fallback) ?? [255, 255, 255];
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Alfy gradientu wnętrza kuli dla pulsu 0..1: jasność jądra i krycie ciemnego brzegu. */
export function coreAlphas(pulse: number): { core: number; edge: number } {
  const p = clamp01(pulse);
  return { core: CORE_MAX_ALPHA * (0.7 + 0.3 * p), edge: 0.34 + 0.08 * p };
}

export type Dust = { dir: Vec3; radius: number; phase: number; spin: number };

/** Deterministyczny generator (mulberry32), żeby pył wyglądał tak samo po każdym odświeżeniu. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` ziaren pyłu: losowe kierunki, promienie z [DUST_MIN_RADIUS, DUST_MAX_RADIUS], własne fazy i prędkości. */
export function makeDust(count: number): Dust[] {
  const rand = rng(7224);
  return Array.from({ length: count }, () => {
    const z = rand() * 2 - 1;
    const a = rand() * 2 * Math.PI;
    const s = Math.sqrt(1 - z * z);
    return {
      dir: { x: s * Math.cos(a), y: z, z: s * Math.sin(a) },
      radius: DUST_MIN_RADIUS + 0.05 + rand() * (DUST_MAX_RADIUS - DUST_MIN_RADIUS - 0.1),
      phase: rand() * 2 * Math.PI,
      spin: (rand() < 0.5 ? -1 : 1) * (0.00005 + rand() * 0.00008),
    };
  });
}

/** Pozycja ziarna w chwili `now` (ms): powolne krążenie wokół osi pionowej i delikatne pływanie promienia. */
export function dustPosition(d: Dust, now: number): Vec3 {
  const theta = now * d.spin + d.phase;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const r = d.radius + 0.04 * Math.sin(now * 0.0005 + d.phase);
  return {
    x: (d.dir.x * c + d.dir.z * s) * r,
    y: d.dir.y * r + 0.03 * Math.sin(now * 0.0007 + d.phase * 2),
    z: (-d.dir.x * s + d.dir.z * c) * r,
  };
}

/** Postęp 0..1 sygnału biegnącego od jądra do skupiska `id`; każde skupisko ma stałe przesunięcie fazy. */
export function axonPulse(now: number, id: string): number {
  const f = (now / AXON_PERIOD + idPhase(id) / (2 * Math.PI)) % 1;
  return f < 0 ? f + 1 : f;
}

/**
 * Siatka wewnętrznej kuli o promieniu `radius`: `parallels` równoleżników (równo między biegunami,
 * bez samych biegunów) i `meridians` pełnych południków (okręgów przez bieguny), po `segments` odcinków.
 * Zwraca łamane (równoleżniki najpierw).
 */
export function innerSphere(
  radius: number,
  parallels: number,
  meridians: number,
  segments: number
): Vec3[][] {
  const out: Vec3[][] = [];
  const ring = (f: (a: number) => Vec3) =>
    Array.from({ length: segments + 1 }, (_, i) => f((i / segments) * 2 * Math.PI));
  for (let k = 1; k <= parallels; k += 1) {
    const lat = -Math.PI / 2 + (k * Math.PI) / (parallels + 1);
    const y = Math.sin(lat) * radius;
    const rr = Math.cos(lat) * radius;
    out.push(ring((a) => ({ x: rr * Math.cos(a), y, z: rr * Math.sin(a) })));
  }
  for (let k = 0; k < meridians; k += 1) {
    const lon = (k * Math.PI) / meridians;
    const cx = Math.cos(lon);
    const cz = Math.sin(lon);
    out.push(
      ring((a) => ({
        x: radius * Math.cos(a) * cx,
        y: radius * Math.sin(a),
        z: radius * Math.cos(a) * cz,
      }))
    );
  }
  return out;
}
