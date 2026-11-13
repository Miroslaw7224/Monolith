import fs from "node:fs";
import path from "node:path";

export const REPO_FILE_MAX_BYTES = 64 * 1024;

/** Jedyny plik z repozytorium projektu, który wolno czytać (nazwa nie pochodzi od użytkownika). */
export type RepoFileName = "CLAUDE.md";

export type RepoFileResult =
  | { ok: true; text: string }
  | { ok: false; reason: "missing" | "unsafe" };

/**
 * Odczyt pliku z katalogu repo (z `resolveRepoPath`): tylko zwykły plik, do `REPO_FILE_MAX_BYTES`.
 * `O_NOFOLLOW` + `fstat` na otwartym deskryptorze zamykają okno między sprawdzeniem a odczytem
 * (podmiana pliku na symlink).
 */
export function readRepoFile(repoDir: string, name: RepoFileName): RepoFileResult {
  const file = path.join(repoDir, name);
  let fd: number;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ok: false, reason: "missing" };
    return { ok: false, reason: "unsafe" };
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > REPO_FILE_MAX_BYTES) return { ok: false, reason: "unsafe" };
    return { ok: true, text: fs.readFileSync(fd, "utf8") };
  } catch {
    return { ok: false, reason: "unsafe" };
  } finally {
    fs.closeSync(fd);
  }
}
