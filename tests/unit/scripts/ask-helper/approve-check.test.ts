// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/approve-check.py");

/** Ekran panelu z dialogiem zgody (kształt jak w `hc read` cursora). */
function dialog(commandLines: string[], extra = ""): string {
  return [
    "  Uruchamiam polecenie.",
    "",
    "  $ cd /x && npx tsc --noEmit Waiting for approval...",
    "",
    "──────────────────────────────────────────────────────────────",
    ` $  ${commandLines[0]}`,
    ...commandLines.slice(1).map((l) => `    ${l}`),
    "",
    " Run this command?",
    ` Not in allowlist: ${extra || "cd, npx"}`,
    "  → Run (once) (y)",
    "    Add Shell(cd) to allowlist? (tab)",
    "    Run Everything (shift+tab)",
    "    Skip & tell the agent what to do instead (esc or n)",
  ].join("\n");
}

function check(screen: string): string {
  const res = spawnSync("python3", ["-I", SCRIPT, ROOT], { input: screen, encoding: "utf8" });
  expect(res.status).toBe(0);
  return res.stdout.trim();
}

const cd = `cd ${ROOT} &&`;

describe("approve-check.py: polecenia dozwolone (CLAUDE.md)", () => {
  it.each([
    [`${cd} npx tsc --noEmit in .`],
    [`${cd} npm run lint in .`],
    [`${cd} npm run build in .`],
    [`${cd} npx vitest run in .`],
    [`${cd} npx vitest run tests/unit/contexts/bc_board in .`],
    [`${cd} npx vitest run tests/unit/a.test.ts tests/unit/[id]/b.test.tsx in .`],
    [`${cd} npx tsc --noEmit 2>&1 in .`],
    [`npx tsc --noEmit in .`],
    [`npx vitest run tests/unit/contexts/bc_board in .`],
  ])("ALLOW: %s", (line) => {
    expect(check(dialog([line]))).toMatch(/^ALLOW /);
  });

  it("składa polecenie zawinięte w panelu na kilka linii", () => {
    const out = check(dialog([`${cd} npx vitest run tests/unit/contexts/bc_board in`, "."]));
    expect(out).toBe(`ALLOW cd ${ROOT} && npx vitest run tests/unit/contexts/bc_board`);
  });
});

describe("approve-check.py: polecenia odrzucane", () => {
  it.each([
    ["npx vitest run -u", "flaga"],
    ["npx vitest run --update", "flaga"],
    ["npx vitest", "bez run"],
    ["npx vitest run > out.txt", "przekierowanie"],
    ["npx vitest run tests | tee x", "pipe"],
    ["npx vitest run $(whoami)", "podstawienie"],
    ["npx vitest run; rm -rf /", "średnik"],
    ["npx tsc --noEmit && rm -rf x", "łańcuch"],
    ["npx tsc", "bez --noEmit"],
    ["npm run lint -- --fix", "--fix"],
    ["npm run lint --fix", "--fix"],
    ["npm run dev", "inny skrypt"],
    ["npm install", "install"],
    ["npx prettier --write .", "prettier"],
    ["npx eslint --fix .", "eslint --fix"],
    ["rm -rf node_modules", "rm"],
    ["git commit -m x", "git commit"],
    ["cd /tmp && npx tsc --noEmit", "inny katalog"],
    ["cd /home/miro7224/projects/Brain_7224/NEXUS && npx tsc --noEmit", "inny katalog"],
  ])("DENY: %s (%s)", (line) => {
    expect(check(dialog([line + " in ."]))).toMatch(/^DENY /);
  });
});

describe("approve-check.py: brak dialogu polecenia", () => {
  it("NONE bez 'Run this command?'", () => {
    expect(check("  zwykły tekst\n  $ npx tsc --noEmit 6ms\n")).toBe("NONE");
  });

  it("NONE dla dialogu pobrania z sieci (to nie dialog polecenia)", () => {
    const screen = " 🌐 Web Fetch: https://example.com\n Allow this web fetch?\n  → Fetch (y)\n";
    expect(check(screen)).toBe("NONE");
  });

  it("DENY, gdy w dialogu nie ma linii z poleceniem", () => {
    expect(check(" Run this command?\n  → Run (once) (y)\n")).toMatch(/^DENY /);
  });
});
