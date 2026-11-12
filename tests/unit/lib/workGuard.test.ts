// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkAccessBlockedError,
  assertWorkAccess,
  checkWorkIgnored,
  defaultGitRunner,
  type GitRunner,
} from "@/lib/workGuard";

/** Atrapa gita: odpowiedzi wg pierwszego argumentu polecenia. */
function fakeGit(answers: Record<string, { status: number; stdout?: string }>): GitRunner {
  return (args) => {
    const answer = answers[args[0]] ?? { status: -1 };
    return { status: answer.status, stdout: answer.stdout ?? "" };
  };
}

const ALL_OK = {
  "rev-parse": { status: 0, stdout: "true\n" },
  "check-ignore": { status: 0 },
  "ls-files": { status: 0, stdout: "" },
};

describe("checkWorkIgnored (atrapa gita)", () => {
  it("ok, gdy vault w repo, Work/ ignorowany i nic nie jest śledzone", () => {
    expect(checkWorkIgnored("/v", fakeGit(ALL_OK))).toEqual({ ok: true });
  });

  it("no-git, gdy vault nie jest w repozytorium", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "rev-parse": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("no-git, gdy rev-parse wypisuje false (wnętrze katalogu .git)", () => {
    const r = checkWorkIgnored(
      "/v",
      fakeGit({ ...ALL_OK, "rev-parse": { status: 0, stdout: "false\n" } })
    );
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("no-git, gdy git jest niedostępny (kod -1)", () => {
    expect(checkWorkIgnored("/v", fakeGit({}))).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("not-ignored, gdy check-ignore zwraca 1", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "check-ignore": { status: 1 } }));
    expect(r).toMatchObject({ ok: false, reason: "not-ignored" });
    expect((r as { message: string }).message).toContain("/Vault/Work/");
  });

  it("no-git (niepewność), gdy check-ignore zwraca błąd 128", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "check-ignore": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("tracked, gdy w repo są śledzone pliki z Work/", () => {
    const r = checkWorkIgnored(
      "/v",
      fakeGit({ ...ALL_OK, "ls-files": { status: 0, stdout: "Work/x.yaml\n" } })
    );
    expect(r).toMatchObject({ ok: false, reason: "tracked" });
  });

  it("no-git (niepewność), gdy ls-files kończy się błędem", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "ls-files": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });
});

describe("assertWorkAccess", () => {
  it("zwraca opcje z allowWork i rootem po pozytywnym sprawdzeniu", () => {
    expect(assertWorkAccess({ root: "/v", run: fakeGit(ALL_OK) })).toEqual({
      root: "/v",
      allowWork: true,
    });
  });

  it("rzuca WorkAccessBlockedError (403) po negatywnym", () => {
    try {
      assertWorkAccess({ root: "/v", run: fakeGit({ ...ALL_OK, "check-ignore": { status: 1 } }) });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(WorkAccessBlockedError);
      expect((err as WorkAccessBlockedError).statusCode).toBe(403);
    }
  });
});

describe("defaultGitRunner", () => {
  it("zwraca -1 dla nieistniejącego katalogu roboczego", () => {
    expect(defaultGitRunner(["status"], "/nie/ma/takiego/katalogu").status).toBe(-1);
  });
});

const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasGit)("checkWorkIgnored (prawdziwy git w katalogu tymczasowym)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "work-guard-"));
    // Wynik nie może zależeć od globalnej konfiguracji gita użytkownika ani od repo nad /tmp.
    vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
    vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
    // Domyślny globalny plik ignorowania gita (~/.config/git/ignore) też nie może wpływać na wynik.
    vi.stubEnv("HOME", tmp);
    vi.stubEnv("XDG_CONFIG_HOME", tmp);
    vi.stubEnv("GIT_CEILING_DIRECTORIES", os.tmpdir());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Repo w `tmp`, vault w `tmp/Vault` (jak NEXUS), `.gitignore` o podanej treści. */
  function makeRepo(gitignore: string | null): string {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    if (gitignore !== null) fs.writeFileSync(path.join(tmp, ".gitignore"), gitignore);
    fs.mkdirSync(path.join(tmp, "Vault"));
    return path.join(tmp, "Vault");
  }

  it("ok przy regule /Vault/Work/", () => {
    expect(checkWorkIgnored(makeRepo("/Vault/Work/\n"))).toEqual({ ok: true });
  });

  it("not-ignored bez reguły", () => {
    expect(checkWorkIgnored(makeRepo(null))).toMatchObject({ ok: false, reason: "not-ignored" });
  });

  it("not-ignored, gdy reguła dotyczy innego katalogu", () => {
    expect(checkWorkIgnored(makeRepo("/Vault/Other/\n"))).toMatchObject({
      ok: false,
      reason: "not-ignored",
    });
  });

  it("tracked, gdy plik z Work/ został dodany do indeksu mimo reguły", () => {
    const vault = makeRepo("/Vault/Work/\n");
    fs.mkdirSync(path.join(vault, "Work"));
    fs.writeFileSync(path.join(vault, "Work", "x.yaml"), "a: 1\n");
    execFileSync("git", ["add", "-f", "Vault/Work/x.yaml"], { cwd: tmp });
    expect(checkWorkIgnored(vault)).toMatchObject({ ok: false, reason: "tracked" });
  });

  it("not-ignored, gdy .gitignore ma tylko regułę na pliki ukryte (.*)", () => {
    expect(checkWorkIgnored(makeRepo(".*\n"))).toMatchObject({ ok: false, reason: "not-ignored" });
  });

  it("tracked, gdy śledzony jest folder o innej wielkości liter (work/)", () => {
    const vault = makeRepo("/Vault/Work/\n");
    fs.mkdirSync(path.join(vault, "work"));
    fs.writeFileSync(path.join(vault, "work", "x.yaml"), "a: 1\n");
    execFileSync("git", ["add", "-f", "Vault/work/x.yaml"], { cwd: tmp });
    expect(checkWorkIgnored(vault)).toMatchObject({ ok: false, reason: "tracked" });
  });

  it("no-git, gdy vault leży poza repozytorium", () => {
    const vault = path.join(tmp, "Vault");
    fs.mkdirSync(vault);
    expect(checkWorkIgnored(vault)).toMatchObject({ ok: false, reason: "no-git" });
  });
});
