// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWsl = vi.hoisted(() => vi.fn());
const mockWin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ports/wsl", () => ({ listWslListeners: mockWsl }));
vi.mock("@/lib/ports/windows", () => ({ listWindowsListeners: mockWin }));
const mockDirs = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ports/proc", () => ({ listSubdirectories: mockDirs }));

import { readSubdirs, readWindows, readWsl } from "@/contexts/bc_diagnostics/repositories";

beforeEach(() => {
  mockWsl.mockReset();
  mockWin.mockReset();
});

describe("repositories", () => {
  it("mapuje RawListener na SourceEntry ze znacznikiem źródła, brak nazwy to pusty tekst", async () => {
    mockWsl.mockResolvedValue({
      ok: true,
      listeners: [
        {
          port: 80,
          address: "*",
          pid: null,
          process: null,
          path: null,
          commandLine: null,
          cwd: "/srv/app",
          ancestors: [{ pid: 1, name: "systemd" }],
        },
      ],
    });
    expect(await readWsl()).toEqual({
      ok: true,
      entries: [
        {
          source: "wsl",
          port: 80,
          address: "*",
          pid: null,
          process: "",
          path: null,
          commandLine: null,
          cwd: "/srv/app",
          ancestors: [{ pid: 1, name: "systemd" }],
        },
      ],
    });
  });

  it("niepowodzenie źródła przechodzi bez zmian", async () => {
    mockWin.mockResolvedValue({ ok: false, reason: "missing" });
    expect(await readWindows()).toEqual({ ok: false, reason: "missing" });
  });
});

describe("readSubdirs", () => {
  it("deleguje do lib/ports/proc", async () => {
    mockDirs.mockResolvedValue(["frontend", "backend"]);
    expect(await readSubdirs("/srv/app")).toEqual(["frontend", "backend"]);
    expect(mockDirs).toHaveBeenCalledWith("/srv/app");
  });
});
