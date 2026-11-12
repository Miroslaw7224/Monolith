// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
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
