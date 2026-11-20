// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.join(process.cwd(), "scripts/helpers-check.py");

const MIN = 60_000;
/** 12:00:00 dowolnego dnia, w ms. */
const NOW = 1_795_104_000_000;
const ago = (min: number) => NOW - min * MIN;

type Term = {
  address: string;
  name: string | null;
  state: string;
  status: string | null;
  idle_since_ms: number;
  screen_changed_ms: number;
  screen: string;
  watched?: boolean;
};

function term(over: Partial<Term> = {}): Term {
  return {
    address: "t5m",
    name: "agy-monolith",
    state: "live",
    status: "idle",
    idle_since_ms: ago(11),
    screen_changed_ms: ago(30),
    screen: "",
    ...over,
  };
}

type Input = { terminals: Term[]; force?: boolean; idle_min?: number };

function build(input: Input): string {
  return JSON.stringify({
    now_ms: NOW,
    idle_min: input.idle_min ?? 10,
    force: input.force ?? false,
    slug: "monolith",
    terminals: input.terminals,
  });
}

function run(input: Input) {
  const res = spawnSync("python3", ["-I", SCRIPT], { input: build(input), encoding: "utf8" });
  return { status: res.status, lines: res.stdout.split("\n").filter(Boolean), stderr: res.stderr };
}

function one(t: Term, force = false): string {
  const res = run({ terminals: [t], force });
  expect(res.status).toBe(0);
  expect(res.lines).toHaveLength(1);
  return res.lines[0];
}

const CURSOR = { name: "cursor-monolith", address: "t5n", status: null } as const;

describe("helpers-check.py: podpięty przez open-agent (watched)", () => {
  it("bez --force: SKIP mimo przekroczonego progu", () => {
    expect(one(term({ watched: true }))).toBe("SKIP agy-monolith: podpięty w panelu (open-agent)");
  });

  it("z --force: KILL", () => {
    expect(one(term({ watched: true }), true)).toBe("KILL agy-monolith");
  });
});

describe("helpers-check.py: decyzje KILL/SKIP", () => {
  it.each<[number, Term, boolean, string]>([
    [1, term(), false, "KILL agy-monolith"],
    [
      2,
      term({ ...CURSOR, idle_since_ms: ago(9), screen_changed_ms: ago(9) }),
      false,
      "SKIP cursor-monolith: bezczynny 9 min < 10",
    ],
    [
      3,
      term({ name: "agy-career-guide", idle_since_ms: ago(60) }),
      false,
      "SKIP agy-career-guide: inny projekt",
    ],
    [
      4,
      term({ name: "claude-monolith", idle_since_ms: ago(60) }),
      false,
      "SKIP claude-monolith: nie pomocnik",
    ],
    [5, term({ ...CURSOR, status: "working" }), false, "SKIP cursor-monolith: pracuje"],
    [
      6,
      term({ ...CURSOR, idle_since_ms: ago(60), screen: "x\n Run this command?\n y" }),
      false,
      "SKIP cursor-monolith: czeka na zgodę",
    ],
    [7, term({ name: null, address: "t40", idle_since_ms: ago(60) }), false, "SKIP t40: bez nazwy"],
    [8, term({ state: "finished" }), false, "SKIP agy-monolith: nie działa"],
    [9, term({ status: "done", idle_since_ms: ago(30) }), false, "KILL agy-monolith"],
    [10, term({ idle_since_ms: ago(1) }), true, "KILL agy-monolith"],
    [
      11,
      term({ name: "agy-career-guide", idle_since_ms: ago(60) }),
      true,
      "SKIP agy-career-guide: inny projekt",
    ],
    [
      12,
      term({ ...CURSOR, screen: "x\n Run this command?\n y" }),
      true,
      "SKIP cursor-monolith: czeka na zgodę",
    ],
    [13, term({ idle_since_ms: ago(10) }), false, "KILL agy-monolith"],
    [14, term({ status: "working" }), true, "SKIP agy-monolith: pracuje"],
    [
      15,
      term({ status: "blocked", idle_since_ms: ago(60) }),
      false,
      "SKIP agy-monolith: czeka na zgodę",
    ],
    [
      16,
      term({ ...CURSOR, idle_since_ms: ago(60), screen: "ekran\nAllow this\n" }),
      false,
      "SKIP cursor-monolith: czeka na zgodę",
    ],
    [
      17,
      term({ ...CURSOR, idle_since_ms: ago(20), screen_changed_ms: ago(20), screen: "spokój" }),
      false,
      "KILL cursor-monolith",
    ],
    [
      18,
      term({ idle_since_ms: ago(60), screen_changed_ms: NOW - 30_000 }),
      false,
      "SKIP agy-monolith: ekran zmienił się w ostatniej minucie",
    ],
    [
      19,
      term({ ...CURSOR, idle_since_ms: ago(60), screen: "praca\nRunning npm\n" }),
      false,
      "SKIP cursor-monolith: pracuje",
    ],
    [
      20,
      term({ ...CURSOR, idle_since_ms: NOW, screen_changed_ms: NOW }),
      false,
      "SKIP cursor-monolith: bezczynny 0 min < 10",
    ],
  ])("#%i", (_n, t, force, expected) => {
    // przypadki 2, 17 i 19 mają własne czasy; 17 ma screen_changed starszy niż minuta
    expect(one(t, force)).toBe(expected);
  });

  it("nieznany status (np. starting) traktowany jak praca, nawet z --force", () => {
    expect(one(term({ status: "starting", idle_since_ms: ago(60) }), true)).toBe(
      "SKIP agy-monolith: pracuje"
    );
  });

  it("wiele terminali: linie w kolejności wejścia", () => {
    const res = run({
      terminals: [
        term(),
        term({ name: "agy-career-guide", address: "t5k" }),
        term({ name: "claude-monolith", address: "t4p" }),
      ],
    });
    expect(res.status).toBe(0);
    expect(res.lines).toEqual([
      "KILL agy-monolith",
      "SKIP agy-career-guide: inny projekt",
      "SKIP claude-monolith: nie pomocnik",
    ]);
  });

  it("niepoprawny JSON: status 2 i komunikat na stderr", () => {
    const res = spawnSync("python3", ["-I", SCRIPT], { input: "{nie json", encoding: "utf8" });
    expect(res.status).toBe(2);
    expect(res.stderr.length).toBeGreaterThan(0);
  });
});
