/** Best-effort HTTP status from fetch errors, Google API payloads, or JSON in Error.message */
export function inferHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.status === "number") return o.status;
    if (typeof o.code === "number" && o.code >= 400 && o.code < 600) return o.code;
    const nested = o.error;
    if (nested && typeof nested === "object" && "code" in nested) {
      const c = (nested as { code?: unknown }).code;
      if (typeof c === "number" && c >= 400 && c < 600) return c;
    }
  }
  if (err instanceof Error && err.message) {
    const m = err.message.match(/"code"\s*:\s*(\d{3})/);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}
