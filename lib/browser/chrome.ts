import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/** Typowe ścieżki Chrome w Windows widziane z WSL. */
const CHROME_PATHS = [
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

export type OpenResult = { ok: true } | { ok: false; reason: "missing" | "error" };

export function findChrome(exists: (p: string) => boolean = existsSync): string | null {
  return CHROME_PATHS.find((p) => exists(p)) ?? null;
}

/**
 * Otwiera `url` w zwykłym Chrome użytkownika (profil domyślny; działający Chrome otwiera nową kartę).
 * Bez powłoki: `url` trafia do `chrome.exe` jako jeden argument. Wołający musi wcześniej
 * sprawdzić, że to `http(s)`, a nie opcja ani inny schemat. Nigdy nie rzuca.
 */
export function openInChrome(url: string): Promise<OpenResult> {
  const chrome = findChrome();
  if (chrome === null) return Promise.resolve({ ok: false, reason: "missing" });
  return new Promise((resolve) => {
    try {
      const child = spawn(chrome, [url], { detached: true, stdio: "ignore", windowsHide: true });
      child.once("error", () => resolve({ ok: false, reason: "error" }));
      child.once("spawn", () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch {
      resolve({ ok: false, reason: "error" });
    }
  });
}
