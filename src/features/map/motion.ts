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

/** „Oddech” całej kuli: względna zmiana jej rozmiaru (okres ok. 5,2 s). */
export const GLOBE_BREATH_AMP = 0.02;
const GLOBE_BREATH_OMEGA = 0.0012;
/** Największe odchylenie brzegu kuli od okręgu (ułamek promienia). */
export const RIM_MAX_WOBBLE = 0.032;

/** Mnożnik rozmiaru kuli w chwili `now` (ms): 1 ± GLOBE_BREATH_AMP. */
export function globeBreath(now: number): number {
  return 1 + GLOBE_BREATH_AMP * Math.sin(now * GLOBE_BREATH_OMEGA);
}

/** Mnożnik promienia brzegu kuli dla kąta `theta`: elastyczne, wolno falujące odchylenia (3 harmoniczne). */
export function rimFactor(theta: number, now: number): number {
  return (
    1 +
    0.014 * Math.sin(2 * theta + now * 0.0009) +
    0.01 * Math.sin(3 * theta - now * 0.0013) +
    0.008 * Math.sin(5 * theta + now * 0.0017)
  );
}

/** Losowy dryf auto-obrotu: prędkości kątowe (rad/s) wokół osi pionowej (yaw) i poziomej (pitch). */
export type Spin = { yaw: number; pitch: number };
export const SPIN_YAW_MIN = 0.06;
export const SPIN_YAW_MAX = 0.16;
/** Największa prędkość pochylania; mała, żeby widok się nie przewracał. */
export const SPIN_PITCH_MAX = 0.05;
/** Auto-obrót nie pochyla kuli bardziej niż to (rad); ręczne przeciąganie ma własny, większy limit. */
export const AUTO_PITCH_LIMIT = 0.6;
/** Jak długo trzyma się wylosowany kierunek (ms). */
export const SPIN_HOLD_MIN_MS = 7000;
export const SPIN_HOLD_MAX_MS = 14000;

/** Losuje nowy kierunek: obrót w lewo lub w prawo (losowe tempo) i lekkie pochylenie w górę lub w dół. */
export function pickSpin(rand: () => number): Spin {
  const sign = rand() < 0.5 ? -1 : 1;
  const yaw = sign * (SPIN_YAW_MIN + rand() * (SPIN_YAW_MAX - SPIN_YAW_MIN));
  const pitch = (rand() * 2 - 1) * SPIN_PITCH_MAX;
  return { yaw, pitch };
}

/** Czas (ms) do kolejnego losowania kierunku. */
export function spinHoldMs(rand: () => number): number {
  return SPIN_HOLD_MIN_MS + rand() * (SPIN_HOLD_MAX_MS - SPIN_HOLD_MIN_MS);
}

/** Zawraca pochylanie, gdy kula jest już poza AUTO_PITCH_LIMIT i dalej od środka; reszta bez zmian. */
export function spinPitchGuard(pitch: number, spin: Spin): Spin {
  const outward =
    (pitch > AUTO_PITCH_LIMIT && spin.pitch > 0) || (pitch < -AUTO_PITCH_LIMIT && spin.pitch < 0);
  return outward ? { yaw: spin.yaw, pitch: -spin.pitch } : spin;
}
