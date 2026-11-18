/** Wspólna walidacja odpowiedzi `gh` (tylko odczyt, bez I/O). */

/** `gh` podaje daty ISO-8601 (`2026-11-16T05:58:28Z`); luźne ciągi typu „1” odrzucamy. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** `url` trafia do `href`, więc przepuszczamy tylko `https://github.com/...` (bez portu i danych logowania). */
export function isGithubUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && Number.isFinite(Date.parse(value));
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
