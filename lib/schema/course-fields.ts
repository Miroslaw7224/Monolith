/** Czyste reguły pól kursu Arsenału; wspólne dla `schemas` (UI i API) i `repositories`. */

/** Tylko `http:` i `https:`: adresy trafiają do `<a href>`. */
export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Ścieżka względna bez wyjścia poza `Documents/` (K2). */
export function isSafeCertificatePath(path: string): boolean {
  if (path === "" || path.length > 200) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
