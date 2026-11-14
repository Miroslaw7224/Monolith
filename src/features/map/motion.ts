/** Amplituda „oddechu” węzłów (względna zmiana promienia) i jego pulsacja w rad/ms (okres ok. 3,9 s). */
export const BREATH_AMP = 0.07;
const BREATH_OMEGA = 0.0016;
/** Puls tła kuli: okres ok. 6,3 s. */
const PULSE_OMEGA = 0.001;
/** Poniżej tej odległości od celu wartość jest przyciągana do celu. */
const SNAP = 0.005;

/** Stała faza z id (hash FNV-1a) w [0, 2π), żeby węzły nie oddychały zgodnie. */
export function idPhase(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * 2 * Math.PI;
}

/** Mnożnik promienia węzła w chwili `now` (ms): 1 ± BREATH_AMP. */
export function breathScale(now: number, id: string): number {
  return 1 + BREATH_AMP * Math.sin(now * BREATH_OMEGA + idPhase(id));
}

/** Powolny puls 0..1 do tła kuli. */
export function slowPulse(now: number): number {
  return 0.5 + 0.5 * Math.sin(now * PULSE_OMEGA);
}

/** Wygładzanie wykładnicze niezależne od liczby klatek: zbliża `current` do `target` z tempem `rate` (1/s). */
export function approach(current: number, target: number, dt: number, rate: number): number {
  const next = current + (target - current) * (1 - Math.exp(-rate * dt));
  return Math.abs(target - next) < SNAP ? target : next;
}
