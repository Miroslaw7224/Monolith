import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

export type TempRepo = {
  /** Katalog repo (po `realpath`). */
  readonly dir: string;
  write(rel: string, text: string): void;
  /** `git add -A && git commit` z lokalną tożsamością, bez podpisu gpg. */
  commit(message: string): void;
};

const IDENTITY = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"];

function git(cwd: string, args: string[]): void {
  execFileSync("git", [...IDENTITY, ...args], { cwd, stdio: "ignore" });
}

/** Tymczasowe repozytoria git; sprzątane po każdym teście. */
export function useTempRepos(): { create(): TempRepo } {
  const created: string[] = [];

  afterEach(() => {
    for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  return {
    create() {
      const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-repo-")));
      created.push(dir);
      git(dir, ["init", "-q", "-b", "main"]);
      return {
        dir,
        write(rel, text) {
          const abs = path.join(dir, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, text, "utf8");
        },
        commit(message) {
          git(dir, ["add", "-A"]);
          git(dir, ["commit", "-q", "-m", message]);
        },
      };
    },
  };
}
