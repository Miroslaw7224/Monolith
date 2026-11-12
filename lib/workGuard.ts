import { execFileSync } from "node:child_process";
import { DomainError } from "@/lib/errors";
import type { VaultFsOptions } from "@/lib/nexus/vault-fs";
import { getVaultRoot } from "@/lib/nexus/vault-path";

export type GitResult = { status: number; stdout: string };
/** Uruchamia `git <args>` w katalogu `cwd`; status -1 oznacza brak gita, limit czasu lub inny błąd uruchomienia. */
export type GitRunner = (args: string[], cwd: string) => GitResult;

export type WorkAccess =
  | { ok: true }
  | { ok: false; reason: "no-git" | "not-ignored" | "tracked"; message: string };

export class WorkAccessBlockedError extends DomainError {
  constructor(message: string) {
    super(message, 403);
    this.name = "WorkAccessBlockedError";
  }
}

/** Ścieżka sondy względem korzenia vaulta; plik nie musi istnieć. Bez kropki na początku: reguła `.*` nie może dać fałszywego "ignorowany". */
const PROBE = "Work/probe.yaml";

export const defaultGitRunner: GitRunner = (args, cwd) => {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { status: 0, stdout };
  } catch (err) {
    const status = (err as { status?: number | null }).status;
    return { status: typeof status === "number" ? status : -1, stdout: "" };
  }
};

function blocked(reason: "no-git" | "not-ignored" | "tracked", detail: string): WorkAccess {
  return { ok: false, reason, message: `Dane etatu (Work/) zablokowane: ${detail}` };
}

/**
 * Czy `Work/` w vaulcie jest bezpieczne dla danych etatu: vault w repo git, folder ignorowany
 * i żaden plik z niego nie jest śledzony. Każda niepewność (brak gita, błąd) blokuje.
 */
export function checkWorkIgnored(vaultRoot: string, run: GitRunner = defaultGitRunner): WorkAccess {
  const inside = run(["rev-parse", "--is-inside-work-tree"], vaultRoot);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return blocked("no-git", "vault nie jest w repozytorium git albo git jest niedostępny.");
  }
  const ignored = run(["check-ignore", "-q", "--no-index", "--", PROBE], vaultRoot).status;
  if (ignored === 1) {
    return blocked(
      "not-ignored",
      "folder Work/ nie jest ignorowany przez git. Dodaj `/Vault/Work/` do .gitignore repozytorium NEXUS."
    );
  }
  if (ignored !== 0) return blocked("no-git", "nie udało się sprawdzić reguł .gitignore.");
  const tracked = run(["ls-files", "--", ":(icase)Work"], vaultRoot);
  if (tracked.status !== 0) return blocked("no-git", "nie udało się sprawdzić śledzonych plików.");
  if (tracked.stdout.trim() !== "") {
    return blocked(
      "tracked",
      "git śledzi już pliki z Work/ (usuń je z indeksu: `git rm --cached`)."
    );
  }
  return { ok: true };
}

/**
 * Jedyna droga do `Work/`: po pozytywnym sprawdzeniu zwraca opcje dla funkcji `vault-fs`
 * z `allowWork: true`; w przeciwnym razie rzuca `WorkAccessBlockedError` (403).
 */
export function assertWorkAccess(
  options: { root?: string; run?: GitRunner } = {}
): VaultFsOptions & { root: string; allowWork: true } {
  const root = options.root ?? getVaultRoot();
  const result = checkWorkIgnored(root, options.run);
  if ("message" in result) throw new WorkAccessBlockedError(result.message);
  return { root, allowWork: true };
}
