// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type HcFixtures, makeHcStub } from "./hc-stub";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/helpers.sh");

const MIN = 60_000;
/** 12:00:00 dowolnego dnia, w ms. */
const NOW = 1_795_104_000_000;

function runHelpers(
  stub: ReturnType<typeof makeHcStub>,
  args: string[],
  extraEnv: Record<string, string> = {}
) {
  const res = spawnSync("bash", [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...stub.env,
      HELPERS_ROOT: "/x/Monolith",
      HELPERS_NOW_MS: String(NOW),
      ...extraEnv,
    },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

/** Pomocnik agy (raportuje status) albo cursor (status: null). */
function helper(
  address: string,
  name: string,
  opts: { status?: string | null; statusMs?: number | null; agent?: string } = {}
) {
  const status = opts.status ?? null;
  return {
    ls: {
      address,
      name,
      agent: opts.agent ?? (name.startsWith("agy") ? "antigravity" : "cursor-agent"),
      state: "live",
      ...(status ? { status } : {}),
    },
    get: {
      address,
      name,
      state: "live",
      status: status ? { state: status } : null,
      status_ms: opts.statusMs ?? null,
    },
  };
}

function fixtures(
  helpers: ReturnType<typeof helper>[],
  screens: Record<string, string> = {},
  extra: Partial<HcFixtures> = {}
): HcFixtures {
  const get: Record<string, unknown> = {};
  const read: Record<string, string> = {};
  for (const h of helpers) {
    get[h.ls.address] = h.get;
    get[h.ls.name] = h.get;
    read[h.ls.address] = screens[h.ls.address] ?? "spokój";
    read[h.ls.name] = read[h.ls.address];
  }
  return { ls: { terminals: helpers.map((h) => h.ls) }, get, read, ...extra };
}

const agyMon = () => helper("t5m", "agy-monolith", { status: "idle", statusMs: NOW - 11 * MIN });
const agyCg = () => helper("t5k", "agy-career-guide", { status: "idle", statusMs: NOW - 60 * MIN });
const claudeMon = () => helper("t4p", "claude-monolith", { status: "idle", agent: "claude-code" });

describe("helpers.sh down", () => {
  it("--dry-run drukuje decyzje i nic nie zabija", () => {
    const stub = makeHcStub(fixtures([agyMon(), agyCg(), claudeMon()]));
    const res = runHelpers(stub, ["down", "--dry-run"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("KILL agy-monolith");
    expect(res.stdout).toContain("SKIP agy-career-guide: inny projekt");
    expect(res.stdout).not.toContain("claude-monolith");
    expect(stub.calls().filter((c) => c[0] === "kill")).toEqual([]);
  });

  it("zabija i usuwa tylko pomocnika bieżącego projektu", () => {
    const stub = makeHcStub(fixtures([agyMon(), agyCg(), claudeMon()]));
    const res = runHelpers(stub, ["down"]);
    expect(res.status).toBe(0);
    const calls = stub.calls();
    expect(calls).toContainEqual(["kill", "agy-monolith"]);
    expect(calls).toContainEqual(["rm", "agy-monolith"]);
    expect(calls.flat().join(" ")).not.toContain("career-guide");
    expect(calls.flat().join(" ")).not.toContain("claude");
  });

  it("cursor bez statusu: pierwszy odczyt nie zabija, po 11 min z tym samym ekranem tak, przy zmianie ekranu nie", () => {
    const cursor = () => helper("t5n", "cursor-monolith");
    const stub = makeHcStub(fixtures([cursor()], { t5n: "ekran A" }));

    const first = runHelpers(stub, ["down"]);
    expect(first.stdout).toContain("SKIP cursor-monolith: bezczynny 0 min < 10");
    const stateFile = path.join(
      stub.env.XDG_STATE_HOME as string,
      "ask-helper",
      "helpers-monolith.json"
    );
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(state["cursor-monolith"].changed_ms).toBe(NOW);
    expect(stub.calls().filter((c) => c[0] === "kill")).toEqual([]);

    const later = { HELPERS_NOW_MS: String(NOW + 11 * MIN) };
    const second = runHelpers(stub, ["down"], later);
    expect(second.stdout).toContain("KILL cursor-monolith");
    expect(stub.calls()).toContainEqual(["kill", "cursor-monolith"]);

    // zmieniony ekran: licznik zaczyna od nowa
    const stub2 = makeHcStub(fixtures([cursor()], { t5n: "ekran A" }));
    runHelpers(stub2, ["down"]);
    stub2.setFixtures(fixtures([cursor()], { t5n: "ekran B" }));
    const changed = runHelpers(stub2, ["down"], later);
    expect(changed.stdout).toContain("SKIP cursor-monolith: bezczynny 0 min < 10");
    expect(stub2.calls().filter((c) => c[0] === "kill")).toEqual([]);
  });

  it("--force pomija próg czasu, ale nie osłonę ekranu ani pracy", () => {
    const stub = makeHcStub(
      fixtures([helper("t5m", "agy-monolith", { status: "idle", statusMs: NOW - MIN })])
    );
    expect(runHelpers(stub, ["down", "--dry-run"]).stdout).toContain(
      "SKIP agy-monolith: bezczynny 1 min < 10"
    );
    expect(runHelpers(stub, ["down", "--dry-run", "--force"]).stdout).toContain(
      "KILL agy-monolith"
    );
  });

  it("rola ogranicza kandydatów", () => {
    const cursor = helper("t5n", "cursor-monolith", { status: "idle", statusMs: NOW - 30 * MIN });
    const stub = makeHcStub(fixtures([agyMon(), cursor]));
    const res = runHelpers(stub, ["down", "cursor"]);
    expect(res.status).toBe(0);
    expect(stub.calls()).toContainEqual(["kill", "cursor-monolith"]);
    expect(stub.calls()).not.toContainEqual(["kill", "agy-monolith"]);
  });

  it("nieznana opcja: kod 1 i komunikat na stderr", () => {
    const stub = makeHcStub(fixtures([agyMon()]));
    const res = runHelpers(stub, ["down", "--nie-ma"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Nieznana opcja");
  });
});

describe("helpers.sh status", () => {
  it("wypisuje pomocników projektu: nazwa, adres, status, minuty; pomija claude i cudze projekty", () => {
    const cursor = helper("t5n", "cursor-monolith");
    const stub = makeHcStub(fixtures([agyMon(), cursor, agyCg(), claudeMon()]));
    const res = runHelpers(stub, ["status"]);
    expect(res.status).toBe(0);
    const agyRow = res.stdout.split("\n").find((l) => l.includes("agy-monolith"));
    expect(agyRow).toMatch(/t5m\s+idle\s+11/);
    const cursorRow = res.stdout.split("\n").find((l) => l.includes("cursor-monolith"));
    expect(cursorRow).toMatch(/t5n\s+-\s+0/);
    expect(res.stdout).not.toContain("claude-monolith");
    expect(res.stdout).not.toContain("career-guide");
  });
});

describe("helpers.sh up", () => {
  const live = (name: string) => ({ name, state: "live" });

  it("pomocnik już działa: bez hc run, komunikat „już działa”", () => {
    const stub = makeHcStub({
      get: { "cursor-monolith": live("cursor-monolith"), "watch-monolith": live("watch-monolith") },
    });
    const res = runHelpers(stub, ["up", "cursor"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("już działa");
    expect(stub.calls().filter((c) => c[0] === "run")).toEqual([]);
  });

  it("start cursora: hc run z pełną ścieżką programu, potem watcher", () => {
    const stub = makeHcStub({});
    const res = runHelpers(stub, ["up", "cursor"]);
    expect(res.status).toBe(0);
    const runs = stub.calls().filter((c) => c[0] === "run");
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual([
      "run",
      "--bg",
      "--name",
      "cursor-monolith",
      "--outlive-parent",
      "--cwd",
      "/x/Monolith",
      path.join(stub.binDir, "cursor-agent"),
    ]);
    expect(runs[1].slice(0, 7)).toEqual([
      "run",
      "--bg",
      "--name",
      "watch-monolith",
      "--outlive-parent",
      "--cwd",
      "/x/Monolith",
    ]);
    expect(runs[1].slice(7)).toEqual(["bash", SCRIPT, "watch"]);
  });

  it("up all: dwóch pomocników i jeden watcher", () => {
    const stub = makeHcStub({});
    const res = runHelpers(stub, ["up", "all"]);
    expect(res.status).toBe(0);
    const names = stub
      .calls()
      .filter((c) => c[0] === "run")
      .map((c) => c[c.indexOf("--name") + 1]);
    expect(names).toEqual(["agy-monolith", "cursor-monolith", "watch-monolith"]);
  });

  it("pomocnik działa, watchera brak: startuje tylko watchera", () => {
    const stub = makeHcStub({ get: { "agy-monolith": live("agy-monolith") } });
    const res = runHelpers(stub, ["up", "agy"]);
    expect(res.status).toBe(0);
    const names = stub
      .calls()
      .filter((c) => c[0] === "run")
      .map((c) => c[c.indexOf("--name") + 1]);
    expect(names).toEqual(["watch-monolith"]);
  });

  it("błąd hc run przy watcherze (nazwa zajęta) jest ignorowany", () => {
    const stub = makeHcStub({ failRun: "name already in use", failRunFor: "watch-monolith" });
    const res = runHelpers(stub, ["up", "cursor"]);
    expect(res.status).toBe(0);
  });

  it("błąd hc run przy pomocniku: kod 1 i bez watchera", () => {
    const stub = makeHcStub({ failRun: "boom", failRunFor: "cursor-monolith" });
    const res = runHelpers(stub, ["up", "cursor"]);
    expect(res.status).toBe(1);
    expect(stub.calls().some((c) => c.includes("watch-monolith"))).toBe(false);
  });

  it("nieznana rola: kod 1", () => {
    const res = runHelpers(makeHcStub({}), ["up", "bogus"]);
    expect(res.status).toBe(1);
  });
});

describe("helpers.sh watch", () => {
  it("jedna iteracja: wywołuje down (zabija spełniającego warunki)", () => {
    const stub = makeHcStub(fixtures([agyMon()]));
    const res = runHelpers(stub, ["watch"], { HELPERS_WATCH_ONCE: "1" });
    expect(res.status).toBe(0);
    expect(stub.calls()).toContainEqual(["kill", "agy-monolith"]);
  });

  it("brak pomocników projektu: kończy się od razu kodem 0", () => {
    const stub = makeHcStub({ ls: { terminals: [] } });
    const started = Date.now();
    const res = runHelpers(stub, ["watch"], {
      HELPERS_WATCH_SEC: "30",
      HELPERS_WATCH_RECHECK_SEC: "0",
    });
    expect(res.status).toBe(0);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
