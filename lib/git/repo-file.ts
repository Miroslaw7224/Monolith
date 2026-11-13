import fs from "node:fs";
import path from "node:path";

export const REPO_FILE_MAX_BYTES = 64 * 1024;

/** Jedyny plik z repozytorium projektu, który wolno czytać (nazwa nie pochodzi od użytkownika). */
export type RepoFileName = "CLAUDE.md";

export type RepoFileResult =
  | { ok: true; text: string }
  | { ok: false; reason: "missing" | "unsafe" };

/**
 * Odczyt pliku z katalogu repo (z `resolveRepoPath`): tylko zwykły plik (bez symlinków),
 * do `REPO_FILE_MAX_BYTES`.
 */
export function readRepoFile(repoDir: string, name: RepoFileName): RepoFileResult {
  const file = path.join(repoDir, name);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ok: false, reason: "missing" };
    return { ok: false, reason: "unsafe" };
  }
  if (!stat.isFile() || stat.size > REPO_FILE_MAX_BYTES) return { ok: false, reason: "unsafe" };
  try {
    return { ok: true, text: fs.readFileSync(file, "utf8") };
  } catch {
    return { ok: false, reason: "unsafe" };
  }
}
