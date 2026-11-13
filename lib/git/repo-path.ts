import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type RepoPathReason = "unsupported-path" | "outside-home" | "missing" | "not-a-repo";
export type RepoPathResult = { ok: true; path: string } | { ok: false; reason: RepoPathReason };

const MNT = "/mnt/";

const inMnt = (p: string) => p === "/mnt" || p.startsWith(MNT);

const within = (p: string, dir: string) => p === dir || p.startsWith(dir.replace(/\/?$/, "/"));

/** `gitdir: <ścieżka>` z pliku `.git` worktree (względna liczona od katalogu projektu) musi istnieć w domu. */
function worktreeGitDirInsideHome(dotGitFile: string, repoDir: string, realHome: string): boolean {
  try {
    const match = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotGitFile, "utf8").slice(0, 4096));
    if (!match) return false;
    const target = fs.realpathSync(path.resolve(repoDir, match[1]));
    return !inMnt(target) && within(target, realHome);
  } catch {
    return false;
  }
}

/**
 * `local_path` z rejestru → bezpieczny katalog repozytorium (tylko WSL, w katalogu domowym).
 * `E:\…`, `/mnt/…`, ścieżki względne i wszystko poza domem (także przez `..` i symlinki) jest odrzucane.
 * `home` tylko dla testów; domyślnie `os.homedir()`.
 */
export function resolveRepoPath(localPath: string, opts: { home?: string } = {}): RepoPathResult {
  const raw = localPath.trim();
  if (raw === "") return { ok: false, reason: "unsupported-path" };

  const home = opts.home ?? os.homedir();
  let candidate: string;
  if (raw === "~" || raw.startsWith("~/")) {
    candidate = path.posix.normalize(path.posix.join(home, raw.slice(1)));
  } else if (raw.startsWith("/")) {
    candidate = path.posix.normalize(raw);
  } else {
    return { ok: false, reason: "unsupported-path" };
  }
  if (inMnt(candidate)) return { ok: false, reason: "unsupported-path" };

  let real: string;
  let realHome: string;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    return { ok: false, reason: "missing" };
  }
  try {
    realHome = fs.realpathSync(home);
  } catch {
    return { ok: false, reason: "outside-home" };
  }
  if (inMnt(real) || !within(real, realHome)) return { ok: false, reason: "outside-home" };

  // `.git` musi leżeć bezpośrednio w katalogu projektu: git nie może „znaleźć” repozytorium
  // w katalogu nadrzędnym. Symlink `.git` nie wystarcza (mógłby wskazywać repozytorium poza domem).
  const dotGitPath = path.join(real, ".git");
  let dotGit: fs.Stats;
  try {
    dotGit = fs.lstatSync(dotGitPath);
  } catch {
    return { ok: false, reason: "not-a-repo" };
  }
  if (dotGit.isFile()) {
    // Worktree: `.git` to plik `gitdir: <ścieżka>`; cel też musi leżeć w domu (poza /mnt/).
    if (!worktreeGitDirInsideHome(dotGitPath, real, realHome)) {
      return { ok: false, reason: "not-a-repo" };
    }
  } else if (!dotGit.isDirectory()) {
    return { ok: false, reason: "not-a-repo" };
  }
  return { ok: true, path: real };
}
