const ALLOWED_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface GuardInput {
  method: string;
  /** Surowy nagłówek `Host` (z portem). */
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  /** Wartość nagłówka `X-Nexus-Client`. */
  clientHeader: string | null;
}

export type GuardResult = { ok: true } | { ok: false; status: 403; reason: "host" | "origin" };

export function isAllowedHost(host: string | null): boolean {
  return ALLOWED_HOST.test((host ?? "").trim().toLowerCase());
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host.trim().toLowerCase();
  } catch {
    return false;
  }
}

const reject = (reason: "host" | "origin"): GuardResult => ({ ok: false, status: 403, reason });

/**
 * Strażnik lokalnego serwera bez auth: odrzuca obcy `Host` (DNS rebinding) oraz żądania
 * zmieniające stan, które nie pochodzą z tej samej aplikacji (zapis z cudzej strony).
 */
export function checkRequest(input: GuardInput): GuardResult {
  if (!isAllowedHost(input.host)) return reject("host");
  if (SAFE_METHODS.has(input.method.toUpperCase())) return { ok: true };
  if (input.secFetchSite !== null) {
    return input.secFetchSite === "same-origin" ? { ok: true } : reject("origin");
  }
  if (input.origin !== null) {
    return sameHost(input.origin, input.host as string) ? { ok: true } : reject("origin");
  }
  return input.clientHeader === "1" ? { ok: true } : reject("origin");
}
