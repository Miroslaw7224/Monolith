import { execFile } from "node:child_process";

export type GhFailure = { ok: false; reason: "gh-missing" | "gh-error" };
export type GhRun = { ok: true; stdout: string } | GhFailure;

const TIMEOUT_MS = 8000;
const DEFAULT_MAX_BUFFER = 256 * 1024;

/**
 * Uruchamia `gh` bez powłoki i bez blokowania pętli zdarzeń; nigdy nie rzuca.
 * `args` mają pochodzić z białej listy danej funkcji (stałe), nie od użytkownika.
 */
export function runGh(
  args: readonly string[],
  maxBuffer: number = DEFAULT_MAX_BUFFER
): Promise<GhRun> {
  return new Promise((resolve) => {
    try {
      execFile(
        "gh",
        [...args],
        {
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          maxBuffer,
          env: {
            ...process.env,
            GH_PROMPT_DISABLED: "1",
            GH_PAGER: "cat",
            NO_COLOR: "1",
            GH_NO_UPDATE_NOTIFIER: "1",
          },
        },
        (err, stdout) => {
          if (err) {
            const code = (err as NodeJS.ErrnoException).code;
            resolve({ ok: false, reason: code === "ENOENT" ? "gh-missing" : "gh-error" });
            return;
          }
          resolve({ ok: true, stdout: String(stdout) });
        }
      );
    } catch {
      resolve({ ok: false, reason: "gh-error" });
    }
  });
}
