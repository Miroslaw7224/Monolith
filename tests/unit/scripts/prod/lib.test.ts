// @vitest-environment node
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const LIB = path.join(process.cwd(), "scripts/prod/lib.sh");
const run = promisify(execFile);

/** Woła funkcję z lib.sh: `bash -c 'source lib.sh; <fn> "$@"' bash args`. */
async function call(fn: string, ...args: string[]) {
  try {
    const { stdout } = await run("bash", ["-c", `source "${LIB}"; ${fn} "$@"`, "bash", ...args]);
    return { code: 0, stdout: stdout.trim() };
  } catch (e) {
    const err = e as { code: number; stdout?: string };
    return { code: err.code, stdout: (err.stdout ?? "").trim() };
  }
}

let dir: string;
const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();

function commit(msg: string) {
  fs.writeFileSync(path.join(dir, `f-${msg}.txt`), msg);
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-q", "-m", msg);
}

function okDist(name: string, mtimeSec: number) {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  const marker = path.join(dir, name, ".monolith-ok");
  fs.writeFileSync(marker, "");
  fs.utimesSync(marker, mtimeSec, mtimeSec);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prod-lib-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
  commit("init");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("prod_dist_name", () => {
  it("to .next- i 12 pierwszych znaków HEAD", async () => {
    const head = git("rev-parse", "HEAD");
    const r = await call("prod_dist_name", dir);
    expect(r).toEqual({ code: 0, stdout: `.next-${head.slice(0, 12)}` });
  });
});

describe("prod_needs_build", () => {
  it("kod 0, gdy brak znacznika .monolith-ok", async () => {
    expect((await call("prod_needs_build", dir)).code).toBe(0);
  });

  it("kod 1, gdy build dla bieżącego commita jest gotowy", async () => {
    const { stdout: dist } = await call("prod_dist_name", dir);
    okDist(dist, 1000);
    expect((await call("prod_needs_build", dir)).code).toBe(1);
  });

  it("kod 0 po nowym commicie (inny katalog builda)", async () => {
    const { stdout: dist } = await call("prod_dist_name", dir);
    okDist(dist, 1000);
    commit("kolejny");
    expect((await call("prod_needs_build", dir)).code).toBe(0);
  });
});

describe("prod_latest_ok_dist", () => {
  it("zwraca najnowszy udany build i pomija katalog bez znacznika", async () => {
    okDist(".next-aaa", 1000);
    okDist(".next-bbb", 2000);
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    expect(await call("prod_latest_ok_dist", dir)).toEqual({ code: 0, stdout: ".next-bbb" });
  });

  it("zwraca pusty wynik, gdy nie ma udanego builda", async () => {
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    expect(await call("prod_latest_ok_dist", dir)).toEqual({ code: 0, stdout: "" });
  });
});

describe("prod_prune_dists", () => {
  it("zostawia n najnowszych udanych, usuwa starsze i nieudane", async () => {
    okDist(".next-aaa", 1000);
    okDist(".next-bbb", 2000);
    okDist(".next-ddd", 3000);
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    await call("prod_prune_dists", dir, "2");
    const left = fs
      .readdirSync(dir)
      .filter((n) => n.startsWith(".next-"))
      .sort();
    expect(left).toEqual([".next-bbb", ".next-ddd"]);
  });
});

describe("prod_needs_install / prod_mark_installed", () => {
  it("kod 0 bez node_modules, 1 po oznaczeniu, 0 po zmianie package-lock.json", async () => {
    expect((await call("prod_needs_install", dir)).code).toBe(0);
    fs.mkdirSync(path.join(dir, "node_modules"));
    await call("prod_mark_installed", dir);
    expect((await call("prod_needs_install", dir)).code).toBe(1);
    fs.writeFileSync(path.join(dir, "package-lock.json"), '{"zmiana":1}');
    expect((await call("prod_needs_install", dir)).code).toBe(0);
  });
});

describe("prod_port_state", () => {
  function serve(html: string): Promise<{ port: number; close: () => Promise<void> }> {
    return new Promise((resolve) => {
      const server = http.createServer((_req, res) => {
        res.setHeader("content-type", "text/html");
        res.end(html);
      });
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as { port: number };
        resolve({ port, close: () => new Promise((r) => server.close(() => r())) });
      });
    });
  }

  it("free, gdy nic nie nasłuchuje", async () => {
    const s = await serve("x");
    await s.close();
    expect(await call("prod_port_state", String(s.port))).toEqual({ code: 0, stdout: "free" });
  });

  it("monolith, gdy strona ma tytuł Monolith", async () => {
    const s = await serve("<html><head><title>Monolith</title></head></html>");
    try {
      expect(await call("prod_port_state", String(s.port))).toEqual({
        code: 0,
        stdout: "monolith",
      });
    } finally {
      await s.close();
    }
  });

  it("busy, gdy port zajmuje inny program", async () => {
    const s = await serve("<html><head><title>Inny</title></head></html>");
    try {
      expect(await call("prod_port_state", String(s.port))).toEqual({ code: 0, stdout: "busy" });
    } finally {
      await s.close();
    }
  });
});
