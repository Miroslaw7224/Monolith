/**
 * Reguły dat archiwizacji zadań (spec archiwizacji §4.1). Czyste funkcje wspólne dla serwera
 * (`repositories/tasks-file`) i UI (przez re-eksport w `schemas.ts`); bez zależności od `Date` lokalnego,
 * poza `localIsoDate`.
 */

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Pierwsze „— RRRR-MM-DD” w tekście linii, po którym jest koniec linii albo ` ` `;` `:` `,` `.` `)`. */
const NOTE_DATE_RE = /\s—\s(\d{4}-\d{2}-\d{2})(?=$|[ ;:,.)])/;
const DAY_MS = 86_400_000;

export function isIsoDay(value: string): boolean {
  const m = ISO_DAY_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, month - 1, d));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === d
  );
}

function utcDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Liczba dni kalendarzowych od `from` do `to` (obie `RRRR-MM-DD`), z samych dat, więc DST nie przesuwa wyniku. */
export function daysBetween(from: string, to: string): number {
  return (utcDay(to) - utcDay(from)) / DAY_MS;
}

/** Dzień lokalny `RRRR-MM-DD` (to samo co `localDate` w serwisie). */
export function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Data ukończenia do archiwizacji: `doneDate` z parsera, a gdy go brak, pierwsze „— RRRR-MM-DD” z tekstu
 * (dopisek po dacie, np. „— 2026-11-13; sprawdzone”, wyklucza parser). `null`: brak poprawnej daty.
 */
export function archiveDateOf(task: { text: string; doneDate?: string }): string | null {
  const raw = task.doneDate ?? NOTE_DATE_RE.exec(task.text)?.[1];
  return raw !== undefined && isIsoDay(raw) ? raw : null;
}

/**
 * Ukończone zadanie do archiwizacji: bez żadnej daty zawsze; z datą, gdy wiek (dni od ukończenia do `today`)
 * jest większy niż `olderThanDays`. Otwarte nigdy.
 */
export function isArchivable(
  task: { done: boolean; text: string; doneDate?: string },
  today: string,
  olderThanDays: number
): boolean {
  if (!task.done) return false;
  const date = archiveDateOf(task);
  return date === null || daysBetween(date, today) > olderThanDays;
}
