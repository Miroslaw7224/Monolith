// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const REMOVED_PATHS = [
  "lib/firebase-admin.ts",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "docker-compose-test.yml",
  "vitest.integration.config.ts",
  "scripts/export-firestore.ts",
  "scripts/export-firestore",
  "scripts/migrate-sqlite-to-firestore.ts",
  "scripts/cleanup-knowledge-collections.ts",
  "tests/integration",
  "tests/unit/scripts/export-firestore",
  ".vercel",
];

describe("0e: po usunięciu projektów Firebase i Vercel", () => {
  it.each(REMOVED_PATHS)("nie istnieje %s", (rel) => {
    expect(exists(rel)).toBe(false);
  });

  it("zostają narzędzia importu ze zrzutu", () => {
    expect(exists("scripts/import-to-vault.ts")).toBe(true);
    expect(exists("tests/unit/scripts/import-to-vault")).toBe(true);
  });

  it(".env.example nie ma zmiennych Firebase", () => {
    expect(read(".env.example")).not.toMatch(/FIREBASE|FIRESTORE/i);
  });

  it("package-lock.json nie zawiera pakietów Firebase ani Firestore", () => {
    const lock = read("package-lock.json");
    expect(lock).not.toMatch(/"node_modules\/firebase(-admin)?"/);
    expect(lock).not.toMatch(/"node_modules\/@google-cloud\/firestore"/);
    expect(lock).not.toMatch(/"node_modules\/@firebase\//);
  });
});
