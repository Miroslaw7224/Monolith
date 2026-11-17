// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceEntry, SourceRead } from "@/contexts/bc_diagnostics/models";

const mockWsl = vi.hoisted(() => vi.fn());
const mockWin = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_diagnostics/repositories", () => ({
  readWsl: mockWsl,
  readWindows: mockWin,
}));

import {
  buildKillCommand,
  classifyExposure,
  listPorts,
  redactCommand,
} from "@/contexts/bc_diagnostics/services";

const entry = (o: Partial<SourceEntry> = {}): SourceEntry => ({
  source: "wsl",
  port: 3000,
  address: "127.0.0.1",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  ...o,
});
const ok = (...entries: SourceEntry[]): SourceRead => ({ ok: true, entries });
const NOW = () => new Date("2026-11-17T10:00:00.000Z");

beforeEach(() => {
  mockWsl.mockReset().mockResolvedValue(ok());
  mockWin.mockReset().mockResolvedValue(ok());
});

describe("classifyExposure", () => {
  it.each(["127.0.0.1", "127.0.0.53", "::1", "::ffff:127.0.0.1"])("%s to local", (a) => {
    expect(classifyExposure(a)).toBe("local");
  });
  it.each(["0.0.0.0", "::", "*", "10.255.255.254", "192.168.1.5"])("%s to network", (a) => {
    expect(classifyExposure(a)).toBe("network");
  });
});

describe("buildKillCommand", () => {
  it("składa komendę wyłącznie z PID", () => {
    expect(buildKillCommand("wsl", 2562323)).toBe("kill 2562323");
    expect(buildKillCommand("windows", 2562323)).toBe("Stop-Process -Id 2562323");
  });
  it.each([null, 0, -5, 1.5, Number.NaN])("PID %s daje null", (pid) => {
    expect(buildKillCommand("wsl", pid)).toBeNull();
  });
});

describe("redactCommand", () => {
  it("maskuje tokeny, hasła i sekrety", () => {
    expect(redactCommand("node app.js --token=abc123 --port 80")).toBe(
      "node app.js --token=*** --port 80"
    );
    expect(redactCommand("x --password=p --secret=s --api-key=k")).toBe(
      "x --password=*** --secret=*** --api-key=***"
    );
    expect(redactCommand("API_TOKEN=abc DB_PASSWORD=zzz node a.js")).toBe(
      "API_TOKEN=*** DB_PASSWORD=*** node a.js"
    );
  });
  it("maskuje flagi z wartością po spacji (cmdline z /proc jest łączony spacją)", () => {
    expect(redactCommand("srv --token abc --port 80")).toBe("srv --token *** --port 80");
    expect(redactCommand("srv --password hunter2 --pwd x --auth y")).toBe(
      "srv --password *** --pwd *** --auth ***"
    );
  });
  it("maskuje flagi złożone (--auth-token, --access-token)", () => {
    expect(redactCommand("srv --auth-token=abc --access-token xyz --port 80")).toBe(
      "srv --auth-token=*** --access-token *** --port 80"
    );
  });
  it("nie zjada kolejnej flagi ani zwykłych portów", () => {
    expect(redactCommand("srv --password --port 80")).toBe("srv --password --port 80");
    expect(redactCommand("srv -p 3000 --port 3000 --passport x")).toBe(
      "srv -p 3000 --port 3000 --passport x"
    );
  });
  it("maskuje zmienne *KEY= i sekrety w query URL", () => {
    expect(redactCommand("API_KEY=abc node a.js")).toBe("API_KEY=*** node a.js");
    expect(redactCommand("curl https://h/x?api_key=abc&a=1&token=t")).toBe(
      "curl https://h/x?api_key=***&a=1&token=***"
    );
  });
  it("maskuje hasło w URL bez loginu", () => {
    expect(redactCommand("redis://:haslo@host:6379")).toBe("redis://:***@host:6379");
  });
  it("maskuje hasło w URL", () => {
    expect(redactCommand("x postgres://user:haslo@host/db")).toBe("x postgres://user:***@host/db");
  });
  it("ucina do 200 znaków po redakcji", () => {
    expect(redactCommand("a".repeat(500))).toHaveLength(200);
  });
  it("null zostaje null", () => {
    expect(redactCommand(null)).toBeNull();
  });
});

describe("listPorts", () => {
  it("awaria Windows nie psuje listy WSL", async () => {
    mockWsl.mockResolvedValue(ok(entry()));
    mockWin.mockResolvedValue({ ok: false, reason: "missing" });
    const r = await listPorts({ now: NOW });
    expect(r.ports).toHaveLength(1);
    expect(r.sources).toEqual({ wsl: { ok: true }, windows: { ok: false, reason: "missing" } });
    expect(r.generatedAt).toBe("2026-11-17T10:00:00.000Z");
  });

  it("odrzucona obietnica źródła to reason error", async () => {
    mockWsl.mockRejectedValue(new Error("boom"));
    const r = await listPorts({ now: NOW });
    expect(r.sources.wsl).toEqual({ ok: false, reason: "error" });
  });

  it("ten sam port z różnymi PID w WSL i Windows to dwa wiersze", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 1 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 2 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(2);
  });

  it("deduplikuje po (source, pid, port, address)", async () => {
    mockWsl.mockResolvedValue(ok(entry(), entry()));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(1);
  });

  it("sortuje po porcie, potem źródle (wsl przed windows)", async () => {
    mockWsl.mockResolvedValue(ok(entry({ port: 8080 }), entry({ port: 22 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", port: 22, pid: 9 })));
    const r = await listPorts({ now: NOW });
    expect(r.ports.map((p) => `${p.port}/${p.source}`)).toEqual([
      "22/wsl",
      "22/windows",
      "8080/wsl",
    ]);
  });

  it("PID serwera Monolith w WSL to self; ten sam numer w Windows to null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 777, port: 3100 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 777, port: 3101 })));
    const r = await listPorts({ selfPid: 777, now: NOW });
    expect(r.ports.find((p) => p.source === "wsl")?.warning).toBe("self");
    expect(r.ports.find((p) => p.source === "windows")?.warning).toBeNull();
  });

  it("pomija procesy systemowe Windows (bez rozróżniania wielkości liter)", async () => {
    mockWin.mockResolvedValue(
      ok(
        ...["System", "LSASS", "services", "wininit", "svchost", "csrss", "smss"].map(
          (process, i) => entry({ source: "windows", process, pid: i + 1, port: 100 + i })
        ),
        entry({ source: "windows", process: "Discord", pid: 99, port: 6463 })
      )
    );
    const r = await listPorts({ now: NOW });
    expect(r.ports.map((p) => p.process)).toEqual(["Discord"]);
  });

  it("proces o nazwie systemowej w WSL nie jest pomijany", async () => {
    mockWsl.mockResolvedValue(ok(entry({ process: "svchost", pid: 7 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(1);
  });

  it("buduje killCommand, redaguje commandLine i nie bierze nic z nazwy procesu", async () => {
    mockWsl.mockResolvedValue(
      ok(entry({ process: "x; rm -rf ~", pid: 42, commandLine: "srv --token=abc" }))
    );
    const [p] = (await listPorts({ now: NOW })).ports;
    expect(p.killCommand).toBe("kill 42");
    expect(p.killCommand).not.toContain("rm");
    expect(p.commandLine).toBe("srv --token=***");
  });

  it("wiersz bez PID ma killCommand null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: null })));
    expect((await listPorts({ now: NOW })).ports[0].killCommand).toBeNull();
  });
});
