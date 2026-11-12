// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN =
  /\.(set|update|delete|add|create|batch|bulkWriter|runTransaction|recursiveDelete|createUser|deleteUser|updateUser)\s*\(/;

function exportSources(): string[] {
  const root = path.join(process.cwd(), "scripts");
  const files = [path.join(root, "export-firestore.ts")];
  const dir = path.join(root, "export-firestore");
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".ts")) files.push(path.join(dir, name));
  }
  return files;
}

describe("export script is read-only", () => {
  it("has sources to check", () => {
    const files = exportSources();
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) expect(fs.existsSync(file)).toBe(true);
  });

  it("contains no Firestore or Auth write calls", () => {
    for (const file of exportSources()) {
      // createHash(...).update(...) to funkcja skrótu z node:crypto, a nie zapis do Firestore.
      const text = fs
        .readFileSync(file, "utf8")
        .replace(/createHash\([^)]*\)\.update\(/g, "createHash(...).feed(");
      const hit = text.split("\n").findIndex((line) => FORBIDDEN.test(line));
      expect(
        hit,
        `${path.relative(process.cwd(), file)}:${hit + 1} zawiera wywołanie zapisujące`
      ).toBe(-1);
    }
  });
});
