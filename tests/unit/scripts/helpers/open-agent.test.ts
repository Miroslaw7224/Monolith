// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type HcFixtures, makeHcStub } from "./hc-stub";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/open-agent");

function run(fixtures: HcFixtures, args: string[]) {
  const stub = makeHcStub(fixtures);
  const res = spawnSync("bash", [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8", env: stub.env });
  return { stub, status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe("open-agent z podpięciem", () => {
  it("--dry-run, pomocnik nie działa: pokazuje helpers.sh up i hc attach", () => {
    const res = run({}, ["cursor", "--dry-run", ROOT]);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/\[dry-run\] .*helpers\.sh up cursor --dir /);
    expect(res.stdout).toMatch(/\[dry-run\] hc attach cursor-/);
  });

  it("--dry-run, pomocnik już działa: tylko podpięcie", () => {
    const slug = path.basename(ROOT).toLowerCase();
    const res = run({ get: { [`agy-${slug}`]: { name: `agy-${slug}`, state: "live" } } }, [
      "agy",
      "--dry-run",
      ROOT,
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("już działa");
    expect(res.stdout).not.toContain("helpers.sh up");
    expect(res.stdout).toMatch(/\[dry-run\] hc attach agy-/);
  });

  it("start: uruchamia pomocnika i watchera przez helpers.sh, potem hc attach", () => {
    const res = run({}, ["cursor", ROOT]);
    expect(res.status).toBe(0);
    const calls = res.stub.calls();
    const names = calls.filter((c) => c[0] === "run").map((c) => c[c.indexOf("--name") + 1]);
    expect(names).toEqual([expect.stringMatching(/^cursor-/), expect.stringMatching(/^watch-/)]);
    expect(calls.at(-1)).toEqual(["attach", names[0]]);
  });

  it("rola helpers: up all bez podpinania", () => {
    const res = run({}, ["helpers", ROOT]);
    expect(res.status).toBe(0);
    expect(res.stub.calls().some((c) => c[0] === "attach")).toBe(false);
    expect(res.stub.calls().filter((c) => c[0] === "run").length).toBe(3);
  });

  it("nieznana rola: kod 1", () => {
    expect(run({}, ["bogus"]).status).toBe(1);
  });
});
