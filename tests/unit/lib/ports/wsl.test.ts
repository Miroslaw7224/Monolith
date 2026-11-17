// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { listWslListeners } from "@/lib/ports/wsl";

const SS =
  'LISTEN 0 511 127.0.0.1:3101 0.0.0.0:* users:(("next-server (v1",pid=2562323,fd=22))\nLISTEN 0 4096 *:5434 *:*\n';

describe("listWslListeners", () => {
  it("woła ss ze stałymi argumentami i dopisuje commandLine z /proc", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: SS });
    const readCmdline = vi.fn().mockResolvedValue("node server.js --port 3101");
    const r = await listWslListeners({
      run,
      readCmdline,
      readCwd: vi.fn().mockResolvedValue(null),
    });
    expect(run).toHaveBeenCalledWith("ss", ["-ltnpH"], 8000);
    expect(readCmdline).toHaveBeenCalledTimes(1);
    expect(readCmdline).toHaveBeenCalledWith(2562323);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.listeners[0].commandLine).toBe("node server.js --port 3101");
      expect(r.listeners[1]).toMatchObject({ pid: null, commandLine: null });
    }
  });

  it("błąd odczytu cmdline daje null, nie psuje źródła", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: SS });
    const r = await listWslListeners({
      run,
      readCmdline: vi.fn().mockResolvedValue(null),
      readCwd: vi.fn().mockResolvedValue(null),
    });
    expect(r.ok && r.listeners[0].commandLine).toBeNull();
  });

  it("dopisuje cwd z /proc/<pid>/cwd raz na PID; brak odczytu daje null", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: SS });
    const readCwd = vi.fn().mockResolvedValue("/home/u/projects/TesterAI/frontend");
    const r = await listWslListeners({
      run,
      readCmdline: vi.fn().mockResolvedValue(null),
      readCwd,
    });
    expect(readCwd).toHaveBeenCalledTimes(1);
    expect(readCwd).toHaveBeenCalledWith(2562323);
    if (!r.ok) throw new Error("oczekiwano ok");
    expect(r.listeners[0].cwd).toBe("/home/u/projects/TesterAI/frontend");
    expect(r.listeners[1].cwd).toBeNull();
  });

  it("propaguje niepowodzenie uruchomienia", async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, reason: "missing" });
    expect(await listWslListeners({ run, readCmdline: vi.fn(), readCwd: vi.fn() })).toEqual({
      ok: false,
      reason: "missing",
    });
  });
});
