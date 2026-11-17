import type { RawListener } from "./types";

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * Wyjście skryptu z `windows.ts`: tablica (lub pojedynczy obiekt) z polami
 * `LocalAddress, LocalPort, OwningProcess, Name, Path, CommandLine`. Rzuca przy niepoprawnym JSON.
 */
export function parseWindowsJson(raw: string): RawListener[] {
  const text = raw.trim();
  if (text === "") return [];
  const doc: unknown = JSON.parse(text);
  const list = Array.isArray(doc) ? doc : [doc];
  const out: RawListener[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const port = r.LocalPort;
    if (typeof port !== "number" || !Number.isInteger(port) || port < 0 || port > 65535) continue;
    out.push({
      port,
      address: str(r.LocalAddress) ?? "",
      pid:
        typeof r.OwningProcess === "number" && Number.isInteger(r.OwningProcess)
          ? r.OwningProcess
          : null,
      process: str(r.Name),
      path: str(r.Path),
      commandLine: str(r.CommandLine),
      cwd: null,
      ancestors: [],
    });
  }
  return out;
}
