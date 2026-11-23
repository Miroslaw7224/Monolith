// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseWindowsJson } from "@/lib/ports/parse-windows";

const ROW = {
  LocalAddress: "::1",
  LocalPort: 42050,
  OwningProcess: 59140,
  Name: "OneDrive.Sync.Service",
  Path: "C:\\Users\\u\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.Sync.Service.exe",
  CommandLine: null,
};

describe("parseWindowsJson", () => {
  it("czyta tablicę obiektów, null w CommandLine zostaje null", () => {
    expect(parseWindowsJson(JSON.stringify([ROW]))).toEqual([
      {
        port: 42050,
        address: "::1",
        pid: 59140,
        process: "OneDrive.Sync.Service",
        path: ROW.Path,
        commandLine: null,
        cwd: null,
        ancestors: [],
      },
    ]);
  });

  it("pojedynczy obiekt traktuje jak tablicę jednoelementową", () => {
    expect(parseWindowsJson(JSON.stringify(ROW))).toHaveLength(1);
  });

  it("pusty tekst i [] dają []", () => {
    expect(parseWindowsJson("")).toEqual([]);
    expect(parseWindowsJson("  \n")).toEqual([]);
    expect(parseWindowsJson("[]")).toEqual([]);
  });

  it("pomija wpisy bez poprawnego portu, braki nazwy i PID daje null", () => {
    const rows = [
      { LocalAddress: "0.0.0.0", LocalPort: "x" },
      { LocalAddress: "0.0.0.0", LocalPort: 80 },
    ];
    expect(parseWindowsJson(JSON.stringify(rows))).toEqual([
      {
        port: 80,
        address: "0.0.0.0",
        pid: null,
        process: null,
        path: null,
        commandLine: null,
        cwd: null,
        ancestors: [],
      },
    ]);
  });

  it("niepoprawny JSON rzuca wyjątek (źródło oznaczy go jako error)", () => {
    expect(() => parseWindowsJson("{nie json")).toThrow(SyntaxError);
  });
});
