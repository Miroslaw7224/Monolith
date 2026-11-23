// @vitest-environment node
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const LIB = path.join(process.cwd(), "scripts/prod/lib.sh");
const run = promisify(execFile);

/** Woła funkcję z lib.sh: `bash -c 'source lib.sh; <fn> "$@"' bash args`. */
/** Czeka (odpytując), aż port przestanie mieć nasłuchujący proces, zamiast stałego sleepa (TDD-5). */
async function waitPortFree(port: number) {
  await expect
    .poll(async () => (await call("prod_listener_pid", String(port))).stdout, { timeout: 5000 })
    .toBe("");
}

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

describe("prod_sync_ref", () => {
  let remote: string;
  const rgit = (...a: string[]) =>
    execFileSync("git", ["-C", remote, ...a], { encoding: "utf8" }).trim();

  beforeEach(() => {
    git("branch", "-M", "main");
    remote = fs.mkdtempSync(path.join(os.tmpdir(), "prod-remote-"));
    execFileSync("git", ["clone", "-q", dir, remote]);
    rgit("config", "user.email", "t@example.com");
    rgit("config", "user.name", "t");
  });
  afterEach(() => fs.rmSync(remote, { recursive: true, force: true }));

  function remoteCommit(msg: string) {
    fs.writeFileSync(path.join(remote, `r-${msg}.txt`), msg);
    rgit("add", ".");
    rgit("-c", "commit.gpgsign=false", "commit", "-q", "-m", msg);
  }

  it("bez zdalnego origin: lokalny main", async () => {
    expect(await call("prod_sync_ref", dir)).toEqual({ code: 0, stdout: "main" });
  });

  it("origin ma nowsze commity: pobiera je i zwraca origin/main", async () => {
    git("remote", "add", "origin", remote);
    remoteCommit("po-merge");
    expect(await call("prod_sync_ref", dir)).toEqual({ code: 0, stdout: "origin/main" });
    expect(git("rev-parse", "origin/main")).toBe(rgit("rev-parse", "HEAD"));
  });

  it("lokalny main ma commit, którego nie ma zdalnie: zostaje lokalny main", async () => {
    git("remote", "add", "origin", remote);
    commit("lokalny");
    expect(await call("prod_sync_ref", dir)).toEqual({ code: 0, stdout: "main" });
  });

  it("origin niedostępny (offline): lokalny main, bez błędu", async () => {
    git("remote", "add", "origin", path.join(os.tmpdir(), "nie-ma-takiego-repo"));
    expect(await call("prod_sync_ref", dir)).toEqual({ code: 0, stdout: "main" });
  });
});

describe("zatrzymywanie nieaktualnego serwera", () => {
  const children: ChildProcess[] = [];

  /** Udaje `next-server`: nasłuchuje na losowym porcie, ma tytuł procesu, cwd i NEXT_DIST_DIR. */
  function fakeServer(opts: { cwd: string; dist: string; title?: string }) {
    return new Promise<{ pid: number; port: number }>((resolve, reject) => {
      const title = opts.title ?? "next-server (v14.2.35)";
      const code =
        `process.title=${JSON.stringify(title)};` +
        `require("http").createServer((q,r)=>r.end("x")).listen(0,"127.0.0.1",function(){` +
        `console.log(this.address().port)});` +
        `setInterval(()=>{},1e6);`;
      const child = spawn(process.execPath, ["-e", code], {
        cwd: opts.cwd,
        env: { ...process.env, NEXT_DIST_DIR: opts.dist },
        stdio: ["ignore", "pipe", "ignore"],
      });
      children.push(child);
      child.on("error", reject);
      child.stdout?.once("data", (d: Buffer) =>
        resolve({ pid: child.pid as number, port: Number(String(d).trim()) })
      );
    });
  }

  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  afterEach(() => {
    for (const c of children.splice(0)) c.kill("SIGKILL");
  });

  it("prod_listener_pid zwraca PID procesu nasłuchującego na porcie, a dla wolnego portu pusty wynik", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-a" });
    expect(await call("prod_listener_pid", String(srv.port))).toEqual({
      code: 0,
      stdout: String(srv.pid),
    });
    children[0].kill("SIGKILL");
    await waitPortFree(srv.port);
    expect((await call("prod_listener_pid", String(srv.port))).stdout).toBe("");
  });

  it("prod_running_dist czyta NEXT_DIST_DIR z środowiska procesu", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-abc123" });
    expect(await call("prod_running_dist", String(srv.pid))).toEqual({
      code: 0,
      stdout: ".next-abc123",
    });
  });

  it("prod_is_own_server: tylko next-server z cwd równym katalogowi głównemu", async () => {
    const own = await fakeServer({ cwd: dir, dist: ".next-a" });
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "prod-other-"));
    const foreignDir = await fakeServer({ cwd: other, dist: ".next-a" });
    const foreignName = await fakeServer({ cwd: dir, dist: ".next-a", title: "inny-program" });
    try {
      expect((await call("prod_is_own_server", dir, String(own.pid))).code).toBe(0);
      expect((await call("prod_is_own_server", dir, String(foreignDir.pid))).code).toBe(1);
      expect((await call("prod_is_own_server", dir, String(foreignName.pid))).code).toBe(1);
      expect((await call("prod_is_own_server", dir, "nie-pid")).code).toBe(1);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("prod_stop_stale zatrzymuje własny serwer ze starszego builda (kod 0)", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-stary" });
    const r = await call("prod_stop_stale", dir, String(srv.port), ".next-nowy");
    expect(r.code).toBe(0);
    expect(alive(srv.pid)).toBe(false);
  });

  it("prod_stop_stale nie rusza serwera z aktualnego builda (kod 1)", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-nowy" });
    const r = await call("prod_stop_stale", dir, String(srv.port), ".next-nowy");
    expect(r.code).toBe(1);
    expect(alive(srv.pid)).toBe(true);
  });

  it("prod_stop_stale nie rusza cudzego procesu na porcie (kod 1)", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-stary", title: "inny-program" });
    const r = await call("prod_stop_stale", dir, String(srv.port), ".next-nowy");
    expect(r.code).toBe(1);
    expect(alive(srv.pid)).toBe(true);
  });

  it("prod_stop_stale nie rusza serwera z innego katalogu (kod 1)", async () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "prod-other-"));
    try {
      const srv = await fakeServer({ cwd: other, dist: ".next-stary" });
      const r = await call("prod_stop_stale", dir, String(srv.port), ".next-nowy");
      expect(r.code).toBe(1);
      expect(alive(srv.pid)).toBe(true);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("prod_stop_stale na wolnym porcie nic nie robi (kod 1)", async () => {
    const srv = await fakeServer({ cwd: dir, dist: ".next-a" });
    children[0].kill("SIGKILL");
    await waitPortFree(srv.port);
    expect((await call("prod_stop_stale", dir, String(srv.port), ".next-nowy")).code).toBe(1);
  });
});
