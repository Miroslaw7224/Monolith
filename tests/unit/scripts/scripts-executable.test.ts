// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Skrypty wołane wprost (`scripts/helpers.sh up`, `open-agent`) muszą mieć bit wykonywalny w INDEKSIE gita.
 * W tym repo `core.fileMode=false`, więc `git add` ignoruje `chmod +x`: tryb ustawia się przez
 * `git update-index --chmod=+x <plik>`, a testy wołające `bash skrypt` tego nie wykryją.
 */
const EXECUTABLE = [
  "scripts/ask-helper.sh",
  "scripts/helpers.sh",
  "scripts/helpers-check.py",
  "scripts/collect-decide.py",
  "scripts/open-agent",
];

describe("skrypty pomocników w indeksie gita", () => {
  it.each(EXECUTABLE)("%s ma tryb 100755", (file) => {
    const res = spawnSync("git", ["ls-files", "-s", file], { encoding: "utf8" });
    expect(res.status).toBe(0);
    expect(res.stdout.split(/\s+/)[0]).toBe("100755");
  });
});
