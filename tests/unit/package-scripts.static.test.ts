// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("package.json scripts bind to loopback only", () => {
  it("dev uses port 3100 on 127.0.0.1", () => {
    expect(pkg.scripts.dev).toContain("-p 3100");
    expect(pkg.scripts.dev).toContain("-H 127.0.0.1");
  });

  it.each(["start", "preview"])("%s binds to 127.0.0.1", (name) => {
    expect(pkg.scripts[name]).toContain("-H 127.0.0.1");
  });
});

describe("0e: pakiety i skrypty po usunięciu Firebase, Firestore i emulatora", () => {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };

  it.each([
    "firebase",
    "firebase-admin",
    "vercel",
    "better-sqlite3",
    "dotenv",
    "wait-on",
    "cross-env",
  ])("nie ma pakietu %s", (name) => {
    expect(all).not.toHaveProperty(name);
  });

  it("zostaje tsx (uruchamia scripts/import-to-vault.ts)", () => {
    expect(all).toHaveProperty("tsx");
  });

  it.each([
    "vercel",
    "vercel:prod",
    "migrate:sqlite-to-firestore",
    "emulator:docker",
    "test:integration",
    "test:integration:local",
    "test:integration:docker",
  ])("nie ma skryptu %s", (name) => {
    expect(pkg.scripts).not.toHaveProperty(name);
  });
});
