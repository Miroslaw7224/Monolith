// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseCliArgs } from "@/scripts/export-firestore/args";

describe("parseCliArgs", () => {
  it("defaults to a full export", () => {
    expect(parseCliArgs([])).toEqual({
      mode: "export",
      out: undefined,
      resume: false,
      skipAuth: false,
      pageSize: 500,
    });
  });

  it("parses --count-only", () => {
    expect(parseCliArgs(["--count-only"])).toEqual({ mode: "count-only" });
  });

  it("parses --verify <dir>", () => {
    expect(parseCliArgs(["--verify", "/tmp/dump"])).toEqual({ mode: "verify", dir: "/tmp/dump" });
  });

  it("parses --out, --skip-auth and --page-size", () => {
    expect(parseCliArgs(["--out", "/tmp/d", "--skip-auth", "--page-size", "100"])).toEqual({
      mode: "export",
      out: "/tmp/d",
      resume: false,
      skipAuth: true,
      pageSize: 100,
    });
  });

  it("requires --out together with --resume", () => {
    expect(() => parseCliArgs(["--resume"])).toThrow(/--resume wymaga --out/);
    expect(parseCliArgs(["--resume", "--out", "/tmp/d"])).toMatchObject({ resume: true });
  });

  it("rejects mixing --count-only or --verify with other flags", () => {
    expect(() => parseCliArgs(["--count-only", "--out", "/tmp/d"])).toThrow(/osobno/);
    expect(() => parseCliArgs(["--verify", "/tmp/d", "--resume"])).toThrow(/osobno/);
    expect(() => parseCliArgs(["--count-only", "--verify", "/tmp/d"])).toThrow(/osobno/);
  });

  it("validates --page-size", () => {
    expect(() => parseCliArgs(["--page-size", "0"])).toThrow(/--page-size/);
    expect(() => parseCliArgs(["--page-size", "abc"])).toThrow(/--page-size/);
    expect(() => parseCliArgs(["--page-size", "5000"])).toThrow(/--page-size/);
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow();
  });
});
