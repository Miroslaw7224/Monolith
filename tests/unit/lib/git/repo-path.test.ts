// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRepoPath } from "@/lib/git/repo-path";

let base = "";
let home = "";

beforeEach(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-home-")));
  home = path.join(base, "home");
  fs.mkdirSync(home);
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

function repo(dir: string): string {
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  return dir;
}

describe("resolveRepoPath", () => {
  it("~/p z katalogiem .git", () => {
    const p = repo(path.join(home, "p"));
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: true, path: p });
  });

  it("ścieżka bezwzględna w domu", () => {
    const p = repo(path.join(home, "p"));
    expect(resolveRepoPath(p, { home })).toEqual({ ok: true, path: p });
  });

  it(".git jako plik (worktree) z gitdir w domu wystarcza", () => {
    const main = repo(path.join(home, "main"));
    const wt = path.join(main, ".git", "worktrees", "p");
    fs.mkdirSync(wt, { recursive: true });
    const p = path.join(home, "p");
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, ".git"), `gitdir: ${wt}\n`);
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: true, path: p });
  });

  it(".git jako plik z gitdir względnym (w domu) wystarcza", () => {
    const main = repo(path.join(home, "main"));
    fs.mkdirSync(path.join(main, ".git", "worktrees", "p"), { recursive: true });
    const p = path.join(home, "p");
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, ".git"), "gitdir: ../main/.git/worktrees/p\n");
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: true, path: p });
  });

  it.each([
    ["poza domem", (b: string) => path.join(b, "outside-gitdir")],
    ["w /mnt/", () => "/mnt/c/gitdir"],
    ["nieistniejący", (b: string) => path.join(b, "home", "nie-ma")],
  ])("plik .git z gitdir %s jest odrzucony", (_name, target) => {
    const dir = target(base);
    if (dir.startsWith(base) && !dir.endsWith("nie-ma")) fs.mkdirSync(dir);
    const p = path.join(home, "p");
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, ".git"), `gitdir: ${dir}\n`);
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: false, reason: "not-a-repo" });
  });

  it("plik .git bez linii gitdir jest odrzucony", () => {
    const p = path.join(home, "p");
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, ".git"), "cokolwiek\n");
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: false, reason: "not-a-repo" });
  });

  it.each(["E:\\x\\y", "", "   ", "p"])("nieobsługiwana ścieżka %j", (input) => {
    expect(resolveRepoPath(input, { home })).toEqual({ ok: false, reason: "unsupported-path" });
  });

  it.each(["/mnt/c/x", "~/../../../../../../mnt/c/x"])("/mnt/ odrzucone: %s", (input) => {
    expect(resolveRepoPath(input, { home })).toEqual({ ok: false, reason: "unsupported-path" });
  });

  it("~/../sibling poza domem", () => {
    repo(path.join(base, "sibling"));
    expect(resolveRepoPath("~/../sibling", { home })).toEqual({
      ok: false,
      reason: "outside-home",
    });
  });

  it("symlink w domu prowadzący poza dom", () => {
    const outside = repo(path.join(base, "outside"));
    fs.symlinkSync(outside, path.join(home, "link"));
    expect(resolveRepoPath("~/link", { home })).toEqual({ ok: false, reason: "outside-home" });
  });

  it("nieistniejący katalog", () => {
    expect(resolveRepoPath("~/nope", { home })).toEqual({ ok: false, reason: "missing" });
  });

  it("bez .git nie szuka repo wyżej", () => {
    fs.mkdirSync(path.join(home, ".git"));
    fs.mkdirSync(path.join(home, "sub"));
    expect(resolveRepoPath("~/sub", { home })).toEqual({ ok: false, reason: "not-a-repo" });
  });
  it(".git jako symlink nie wystarcza", () => {
    const p = path.join(home, "p");
    fs.mkdirSync(p);
    const elsewhere = path.join(base, "elsewhere-git");
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, path.join(p, ".git"));
    expect(resolveRepoPath("~/p", { home })).toEqual({ ok: false, reason: "not-a-repo" });
  });
});
