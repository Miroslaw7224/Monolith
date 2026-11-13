// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  commitsByDay,
  commitsSince,
  currentBranch,
  mergedPrsByDay,
  runGit,
  snapshotRepo,
  type GitCommand,
} from "@/lib/git/project-git";
import { useTempRepos } from "../../helpers/tempGit";

const repos = useTempRepos();

describe("snapshotRepo", () => {
  it("czyste repo z jednym commitem", () => {
    const r = repos.create();
    r.write("a.txt", "a");
    r.commit("init");
    const res = snapshotRepo(r.dir);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.snapshot.status).toBe("## main");
    expect(res.snapshot.log).toMatch(/^[0-9a-f]{7,} init$/);
    expect(res.snapshot.diffStat).toBe("");
  });

  it("zmodyfikowany plik widać w status i diff --stat", () => {
    const r = repos.create();
    r.write("a.txt", "a");
    r.commit("init");
    r.write("a.txt", "zmiana");
    const res = snapshotRepo(r.dir);
    if (res.ok === false) throw new Error("git-error");
    expect(res.snapshot.status).toContain(" M a.txt");
    expect(res.snapshot.diffStat).toContain("a.txt");
  });

  it("log zwraca dokładnie 5 ostatnich commitów", () => {
    const r = repos.create();
    for (let i = 1; i <= 7; i++) {
      r.write("a.txt", String(i));
      r.commit(`c${i}`);
    }
    const res = snapshotRepo(r.dir);
    if (res.ok === false) throw new Error("git-error");
    const lines = res.snapshot.log.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(/ c7$/);
    expect(lines[4]).toMatch(/ c3$/);
  });

  it("repo bez commitów: ok, pusty log", () => {
    const r = repos.create();
    const res = snapshotRepo(r.dir);
    if (res.ok === false) throw new Error("git-error");
    expect(res.snapshot.status.startsWith("## No commits yet")).toBe(true);
    expect(res.snapshot.log).toBe("");
  });

  it("katalog bez .git (nawet w repo nadrzędnym) to git-error", () => {
    const r = repos.create();
    r.write("a.txt", "a");
    r.commit("init");
    const sub = path.join(r.dir, "sub");
    fs.mkdirSync(sub);
    expect(snapshotRepo(sub)).toEqual({ ok: false, reason: "git-error" });
  });
});

describe("runGit", () => {
  it("polecenie spoza białej listy rzuca", () => {
    const r = repos.create();
    expect(() => runGit(r.dir, "push" as GitCommand)).toThrow(/spoza białej listy/);
  });
});

describe("konfiguracja obcego repo nie wykonuje kodu", () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const d of cleanup.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  it("core.fsmonitor jest wyłączony", () => {
    const r = repos.create();
    r.write("a.txt", "a");
    r.commit("init");
    const outDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-hook-")));
    cleanup.push(outDir);
    const marker = path.join(outDir, "marker");
    const hook = path.join(outDir, "hook.sh");
    fs.writeFileSync(hook, `#!/bin/sh\ntouch "${marker}"\n`, { mode: 0o755 });
    execFileSync("git", ["config", "core.fsmonitor", hook], { cwd: r.dir });

    snapshotRepo(r.dir);

    expect(fs.existsSync(marker)).toBe(false);
  });
});

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("commitsSince", () => {
  it("liczy commity od podanego dnia (dziś: 2, od jutra: 0)", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1");
    r.write("a.txt", "2");
    r.commit("c2");
    expect(commitsSince(r.dir, localDay(new Date()))).toEqual({ ok: true, count: 2 });
    expect(commitsSince(r.dir, "2099-01-01")).toEqual({ ok: true, count: 0 });
  });

  it("uwzględnia commity z innych lokalnych gałęzi, bez podwójnego liczenia", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1");
    execFileSync("git", ["checkout", "-q", "-b", "feat/x"], { cwd: r.dir });
    r.write("a.txt", "2");
    r.commit("c2");
    execFileSync("git", ["checkout", "-q", "main"], { cwd: r.dir });
    expect(commitsSince(r.dir, localDay(new Date()))).toEqual({ ok: true, count: 2 });
  });

  it("repo bez commitów: 0; katalog bez .git: błąd", () => {
    const r = repos.create();
    expect(commitsSince(r.dir, localDay(new Date()))).toEqual({ ok: true, count: 0 });
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-plain-")));
    try {
      expect(commitsSince(plain, "2026-01-01")).toEqual({ ok: false });
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it("odrzuca datę o złym formacie (nic nie trafia do gita)", () => {
    const r = repos.create();
    expect(() => commitsSince(r.dir, "--all")).toThrow(/data/);
    expect(() => commitsSince(r.dir, "2026-13-40x")).toThrow(/data/);
  });
});

describe("currentBranch", () => {
  it("zwraca nazwę gałęzi", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1");
    expect(currentBranch(r.dir)).toBe("main");
  });

  it("odłączony HEAD i brak repo dają null", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1");
    execFileSync("git", ["checkout", "-q", "--detach"], { cwd: r.dir });
    expect(currentBranch(r.dir)).toBeNull();
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-plain-")));
    try {
      expect(currentBranch(plain)).toBeNull();
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe("commitsByDay", () => {
  it("grupuje commity po dniu (data zatwierdzenia, czas lokalny) w zakresie od–do włącznie", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1", "2026-11-10");
    r.write("a.txt", "2");
    r.commit("c2", "2026-11-12");
    r.write("a.txt", "3");
    r.commit("c3", "2026-11-12");
    r.write("a.txt", "4");
    r.commit("c4", "2026-11-14");
    expect(commitsByDay(r.dir, "2026-11-10", "2026-11-13")).toEqual({
      ok: true,
      days: { "2026-11-10": 1, "2026-11-12": 2 },
    });
    expect(commitsByDay(r.dir, "2026-11-11", "2026-11-11")).toEqual({ ok: true, days: {} });
  });

  it("liczy commity z innych lokalnych gałęzi raz i pomija merge'e", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1", "2026-11-10");
    execFileSync("git", ["checkout", "-q", "-b", "feat/x"], { cwd: r.dir });
    r.write("b.txt", "2");
    r.commit("c2", "2026-11-11");
    execFileSync("git", ["checkout", "-q", "main"], { cwd: r.dir });
    expect(commitsByDay(r.dir, "2026-11-10", "2026-11-11")).toEqual({
      ok: true,
      days: { "2026-11-10": 1, "2026-11-11": 1 },
    });
  });

  it("repo bez commitów: pusto; katalog bez .git: błąd; zła data: wyjątek", () => {
    const r = repos.create();
    expect(commitsByDay(r.dir, "2026-11-01", "2026-11-13")).toEqual({ ok: true, days: {} });
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-plain-")));
    try {
      expect(commitsByDay(plain, "2026-11-01", "2026-11-13")).toEqual({ ok: false });
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
    expect(() => commitsByDay(r.dir, "--all", "2026-11-13")).toThrow(/data/);
    expect(() => commitsByDay(r.dir, "2026-11-01", "x")).toThrow(/data/);
    expect(() => commitsByDay(r.dir, "2026-11-13", "2026-11-01")).toThrow(/zakres/);
  });
});

describe("mergedPrsByDay", () => {
  const run = (cwd: string, args: string[], day?: string) =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      {
        cwd,
        stdio: "ignore",
        env: day
          ? {
              ...process.env,
              GIT_AUTHOR_DATE: `${day}T12:00:00`,
              GIT_COMMITTER_DATE: `${day}T12:00:00`,
            }
          : process.env,
      }
    );

  it("liczy merge'e „Merge pull request #N” i squashe „(#N)”, pomija zwykłe commity i merge'e gałęzi", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("start", "2026-11-09");
    run(r.dir, ["checkout", "-q", "-b", "feat/a"]);
    r.write("b.txt", "2");
    r.commit("praca na gałęzi", "2026-11-10");
    run(r.dir, ["checkout", "-q", "main"]);
    run(
      r.dir,
      ["merge", "--no-ff", "-q", "-m", "Merge pull request #7 from u/feat/a", "feat/a"],
      "2026-11-11"
    );
    r.write("c.txt", "3");
    r.commit("Napraw coś (#9)", "2026-11-11");
    r.write("d.txt", "4");
    r.commit("Zwykły commit z (#) w środku (nie PR)", "2026-11-12");
    run(r.dir, ["checkout", "-q", "-b", "feat/b"]);
    r.write("e.txt", "5");
    r.commit("na b", "2026-11-12");
    run(r.dir, ["checkout", "-q", "main"]);
    run(r.dir, ["merge", "--no-ff", "-q", "-m", "Merge branch 'feat/b'", "feat/b"], "2026-11-12");
    expect(mergedPrsByDay(r.dir, "2026-11-09", "2026-11-13")).toEqual({
      ok: true,
      prs: { "2026-11-11": 2 },
    });
    expect(mergedPrsByDay(r.dir, "2026-11-12", "2026-11-13")).toEqual({ ok: true, prs: {} });
  });

  it("katalog bez .git: błąd; zła data: wyjątek", () => {
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-plain-")));
    try {
      expect(mergedPrsByDay(plain, "2026-11-01", "2026-11-13")).toEqual({ ok: false });
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
    const r = repos.create();
    expect(() => mergedPrsByDay(r.dir, "x", "2026-11-13")).toThrow(/data/);
  });
});
