// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.join(process.cwd(), "scripts/collect-decide.py");

type Input = { collects: number; nudged: boolean; screen: string; screen_prev: string };

function decide(input: Input): string {
  const res = spawnSync("python3", ["-I", SCRIPT], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  expect(res.status).toBe(0);
  return res.stdout.trim();
}

const CALM = "linia 1\nlinia 2\n> ";
const WORKING = "linia 1\nRunning npm test\nctrl+c to stop";
const DIALOG = "x\n $  npm run lint\n Run this command?\n → Run (once) (y)";

describe("collect-decide.py", () => {
  it.each<[number, Input, string]>([
    [1, { collects: 1, nudged: false, screen: WORKING, screen_prev: WORKING }, "COLLECT"],
    [2, { collects: 3, nudged: false, screen: CALM, screen_prev: CALM }, "NUDGE"],
    [3, { collects: 4, nudged: true, screen: CALM, screen_prev: CALM }, "REPORT"],
    [4, { collects: 3, nudged: false, screen: DIALOG, screen_prev: DIALOG }, "ASK_USER"],
    [5, { collects: 3, nudged: false, screen: CALM + "x", screen_prev: CALM }, "COLLECT"],
    [6, { collects: 0, nudged: false, screen: CALM, screen_prev: CALM }, "COLLECT"],
    [7, { collects: 4, nudged: true, screen: WORKING, screen_prev: WORKING }, "COLLECT"],
  ])("#%i", (_n, input, expected) => {
    expect(decide(input)).toBe(expected);
  });

  it("niepoprawny JSON: kod 2", () => {
    const res = spawnSync("python3", ["-I", SCRIPT], { input: "nie json", encoding: "utf8" });
    expect(res.status).toBe(2);
  });
});
