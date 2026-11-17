import { execFile } from "node:child_process";
import type { SourceFailureReason } from "./types";

export type RunResult = { ok: true; stdout: string } | { ok: false; reason: SourceFailureReason };

export type RunFn = (
  file: string,
  args: readonly string[],
  timeoutMs?: number
) => Promise<RunResult>;

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BUFFER = 2 * 1024 * 1024;

/**
 * Uruchamia program bez powłoki i bez blokowania pętli zdarzeń; nigdy nie rzuca.
 * `file` i `args` muszą być stałymi (nigdy danymi od użytkownika).
 */
export const runCommand: RunFn = (file, args, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve) => {
    try {
      execFile(
        file,
        [...args],
        { encoding: "utf8", timeout: timeoutMs, maxBuffer: MAX_BUFFER, windowsHide: true },
        (err, stdout) => {
          if (err) {
            const e = err as NodeJS.ErrnoException & { killed?: boolean };
            if (e.code === "ENOENT") resolve({ ok: false, reason: "missing" });
            else if (e.killed === true) resolve({ ok: false, reason: "timeout" });
            else resolve({ ok: false, reason: "error" });
            return;
          }
          resolve({ ok: true, stdout: String(stdout) });
        }
      );
    } catch {
      resolve({ ok: false, reason: "error" });
    }
  });
