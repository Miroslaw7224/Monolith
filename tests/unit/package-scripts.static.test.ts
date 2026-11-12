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

describe("0d-2: pakiety i skrypty po odpięciu Firebase i Vercela", () => {
  it("nie ma klienckiego pakietu firebase ani vercel", () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all).not.toHaveProperty("firebase");
    expect(all).not.toHaveProperty("vercel");
  });

  it.each(["vercel", "vercel:prod"])("nie ma skryptu %s", (name) => {
    expect(pkg.scripts).not.toHaveProperty(name);
  });

  it("firebase-admin zostaje do etapu 0e (eksport i weryfikacja zrzutu)", () => {
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).toHaveProperty("firebase-admin");
  });
});
