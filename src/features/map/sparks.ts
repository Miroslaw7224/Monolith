import type { Vec3 } from "./globeMath";

/** Iskra płynąca po łuku: `t` = postęp 0..1 wzdłuż krawędzi, `speed` w łukach na sekundę. */
export type Spark<E> = { edge: E; t: number; speed: number };

export const SPARK_SPEED_MIN = 0.14;
export const SPARK_SPEED_MAX = 0.32;

function newSpeed(rand: () => number): number {
  return SPARK_SPEED_MIN + rand() * (SPARK_SPEED_MAX - SPARK_SPEED_MIN);
}

/** Punkt w odległości `t` (0..1, wg indeksu próbek) wzdłuż łamanej `points`, rzutowany z powrotem na kulę. */
export function pointAlong(points: Vec3[], t: number): Vec3 {
  const last = points.length - 1;
  if (last <= 0) return { ...points[0] };
  const pos = Math.max(0, Math.min(1, t)) * last;
  const i = Math.min(last - 1, Math.floor(pos));
  const f = pos - i;
  const a = points[i];
  const b = points[i + 1];
  if (f === 0) return { ...a };
  const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
  const len = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / len, y: p.y / len, z: p.z / len };
}

/**
 * Przesuwa iskry (w miejscu): utrzymuje `min(count, pula)` iskier, dopisuje brakujące w losowym
 * miejscu łuku, a te, które dotarły do końca, przenosi na nową krawędź z puli.
 */
export function stepSparks<E>(
  sparks: Spark<E>[],
  dt: number,
  pool: readonly E[],
  count: number,
  speedMul: number,
  rand: () => number
): void {
  const want = pool.length === 0 ? 0 : Math.min(Math.max(0, count), pool.length);
  if (sparks.length > want) sparks.length = want;
  while (sparks.length < want) {
    sparks.push({
      edge: pool[Math.floor(rand() * pool.length)],
      t: rand() * 0.999,
      speed: newSpeed(rand),
    });
  }
  for (const s of sparks) {
    s.t += s.speed * speedMul * dt;
    if (s.t >= 1) {
      s.edge = pool[Math.floor(rand() * pool.length)];
      s.speed = newSpeed(rand);
      s.t = (s.t - 1) % 1;
    }
  }
}

/** Po zmianie puli krawędzi (np. zaznaczenie) przypisuje iskrom nowe krawędzie, zachowując ich postęp. */
export function retargetSparks<E>(
  sparks: Spark<E>[],
  pool: readonly E[],
  rand: () => number
): void {
  if (pool.length === 0) {
    sparks.length = 0;
    return;
  }
  for (const s of sparks) s.edge = pool[Math.floor(rand() * pool.length)];
}
