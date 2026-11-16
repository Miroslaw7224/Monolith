// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  commitsInRange,
  diffStatInRange,
  headSha,
  normalizeSha,
  relationToHead,
} from "@/lib/git/project-git";
import { setupTempRepos } from "../../helpers/tempGit";

const repos = setupTempRepos();

function git(dir: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd: dir, encoding: "utf8" }
  ).trim();
}

const head = (dir: string) => git(dir, "rev-parse", "HEAD");

/** Repo z commitami c1…cn; zwraca repo i sha po każdym z nich (shas[0] = po c1). */
function history(n: number) {
  const repo = repos.create();
  const shas: string[] = [];
  for (let i = 1; i <= n; i++) {
    repo.write(`f${i}.txt`, `${i}\n`);
    repo.commit(`c${i}`);
    shas.push(head(repo.dir));
  }
  return { repo, shas };
}

describe("normalizeSha", () => {
  it("małe litery i obcięcie spacji", () => {
    expect(normalizeSha(" ABCDEF1 ")).toBe("abcdef1");
  });
  it.each(["abcdef", "--help", "HEAD", "abc123g", "a".repeat(41), ""])("odrzuca %j", (raw) => {
    expect(normalizeSha(raw)).toBeNull();
  });
});

describe("headSha", () => {
  it("zwraca pełny sha HEAD", () => {
    const { repo, shas } = history(2);
    expect(headSha(repo.dir)).toEqual({ ok: true, sha: shas[1] });
  });
  it("repo bez commitów: ok false", () => {
    const repo = repos.create();
    expect(headSha(repo.dir)).toEqual({ ok: false });
  });
});

describe("relationToHead", () => {
  it("przodek: liczba commitów od sha do HEAD", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[0])).toEqual({ kind: "ancestor", ahead: 2 });
  });
  it("sha równy HEAD: ahead 0", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[2])).toEqual({ kind: "ancestor", ahead: 0 });
  });
  it("skrócony sha (7 znaków) i wielkie litery", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[0].slice(0, 7).toUpperCase())).toEqual({
      kind: "ancestor",
      ahead: 2,
    });
  });
  it("commit z innej gałęzi (nie przodek HEAD): diverged", () => {
    const { repo } = history(1);
    git(repo.dir, "checkout", "-q", "-b", "side");
    repo.write("side.txt", "s");
    repo.commit("side");
    const sideSha = head(repo.dir);
    git(repo.dir, "checkout", "-q", "main");
    repo.write("main.txt", "m");
    repo.commit("main2");
    expect(relationToHead(repo.dir, sideSha)).toEqual({ kind: "diverged" });
  });
  it("commit sprzed amend (obiekt jest w repo, nie jest przodkiem): diverged", () => {
    const { repo, shas } = history(2);
    git(repo.dir, "commit", "--amend", "-q", "-m", "c2-amended");
    expect(relationToHead(repo.dir, shas[1])).toEqual({ kind: "diverged" });
  });
  it("sha, którego nie ma w repo: missing", () => {
    const { repo } = history(1);
    expect(relationToHead(repo.dir, "deadbeef".repeat(5))).toEqual({ kind: "missing" });
  });
  it("niepoprawny sha (np. opcja gita): error, a nie missing", () => {
    const { repo } = history(1);
    expect(relationToHead(repo.dir, "--help")).toEqual({ kind: "error" });
    expect(relationToHead(repo.dir, "HEAD")).toEqual({ kind: "error" });
  });
});

describe("commitsInRange", () => {
  it("limit 30 z 32 commitów w zakresie: lines 30, total 32, najnowszy pierwszy", () => {
    const { repo, shas } = history(33);
    const res = commitsInRange(repo.dir, shas[0], 30);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.lines).toHaveLength(30);
    expect(res.total).toBe(32);
    expect(res.lines[0]).toMatch(/ c33$/);
  }, 30_000);
  it("sha null: ostatnie commity od początku historii", () => {
    const { repo } = history(3);
    const res = commitsInRange(repo.dir, null, 30);
    expect(res).toMatchObject({ ok: true, total: 3 });
  });
  it("niepoprawny sha: ok false", () => {
    const { repo } = history(1);
    expect(commitsInRange(repo.dir, "--help", 30)).toEqual({ ok: false });
  });
});

describe("diffStatInRange", () => {
  it("pliki zmienione w zakresie", () => {
    const { repo, shas } = history(3);
    const res = diffStatInRange(repo.dir, shas[0]);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.stat).toContain("f2.txt");
    expect(res.stat).toContain("f3.txt");
    expect(res.stat).not.toContain("f1.txt");
  });
  it("niepoprawny sha: ok false", () => {
    const { repo } = history(1);
    expect(diffStatInRange(repo.dir, "nie-sha")).toEqual({ ok: false });
  });
});
