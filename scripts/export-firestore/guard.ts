import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultOutDir(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(":", "");
  return path.join(os.homedir(), "backups", "monolith-firestore", stamp);
}

function nearestExistingDir(target: string): string {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fs.realpathSync(current);
}

/**
 * Zrzut zawiera pełną treść notatek i dokumentów, a repozytoria projektu są śledzone przez git.
 * Odmawiamy zapisu w jakimkolwiek drzewie roboczym gita.
 */
export function assertOutsideGitWorkTree(outDir: string): void {
  const dir = nearestExistingDir(outDir);
  let inside: string;
  try {
    inside = execFileSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return; // nie jest repozytorium (albo brak gita): bezpiecznie
  }
  if (inside === "true") {
    throw new Error(
      `Katalog wyjściowy ${outDir} leży w drzewie roboczym gita. ` +
        `Wskaż katalog poza repozytoriami, np. ~/backups/monolith-firestore/...`
    );
  }
}

export function prepareOutDir(outDir: string, opts: { resume: boolean }): void {
  assertOutsideGitWorkTree(outDir);
  if (fs.existsSync(outDir)) {
    if (!opts.resume && fs.readdirSync(outDir).length > 0) {
      throw new Error(`Katalog ${outDir} jest niepusty. Użyj --resume albo wskaż nowy katalog.`);
    }
  } else {
    fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(outDir, 0o700);
}
