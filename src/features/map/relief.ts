import { arcPoints, type Vec3 } from "./globeMath";

/** Wysokość najbardziej połączonego węzła (szczyt) i głębokość węzła bez połączeń (dolina), w promieniach kuli. */
export const PEAK_HEIGHT = 0.09;
export const VALLEY_DEPTH = 0.02;
/** O ile wznosi się środek łuku między antypodami; krótsze łuki wznoszą się proporcjonalnie mniej. */
export const ARC_LIFT = 0.16;
/** Amplituda fali przebiegającej po łuku (w promieniach kuli). */
export const RIPPLE_AMP = 0.012;
const RIPPLE_WAVES = 5;

/** Wysokość węzła nad powierzchnią kuli wg liczby połączeń: dolina → szczyt, rośnie jak pierwiastek. */
export function nodeHeight(links: number, maxLinks: number): number {
  if (maxLinks <= 0) return 0;
  const f = Math.sqrt(Math.max(0, Math.min(1, links / maxLinks)));
  return -VALLEY_DEPTH + (PEAK_HEIGHT + VALLEY_DEPTH) * f;
}

/** Punkt jednostkowy `p` przeniesiony na wysokość `h` nad kulą (promień 1 + h). */
export function elevate(p: Vec3, h: number): Vec3 {
  const k = 1 + h;
  return { x: p.x * k, y: p.y * k, z: p.z * k };
}

/**
 * `n + 1` punktów łuku między węzłami o wysokościach `ha` i `hb`: łuk wielkiego koła, którego promień
 * płynnie przechodzi od jednego węzła do drugiego i dodatkowo wznosi się w środku (proporcjonalnie
 * do kąta między końcami). `ripple` (rad) przesuwa falę biegnącą po łuku; `null` wyłącza falowanie.
 */
export function liftedArc(
  a: Vec3,
  b: Vec3,
  ha: number,
  hb: number,
  n: number,
  ripple: number | null
): Vec3[] {
  const base = arcPoints(a, b, n);
  const last = base.length - 1;
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const lift = (ARC_LIFT * Math.acos(dot)) / Math.PI;
  return base.map((p, i) => {
    const t = last === 0 ? 0 : i / last;
    const bump = Math.sin(Math.PI * t);
    let r = 1 + ha + (hb - ha) * t + lift * bump;
    if (ripple !== null) r += RIPPLE_AMP * bump * Math.sin(ripple - RIPPLE_WAVES * t);
    return { x: p.x * r, y: p.y * r, z: p.z * r };
  });
}
