// @vitest-environment node
/**
 * Granica `bc_diagnostics` → `bc_projects` (ASERCJE-3) bez atrap kontekstów: `listPorts` czyta prawdziwy
 * rejestr z tymczasowego vaulta przez `listProjects` / `isWorkProject`.
 * Atrapy tylko na podprocesach: `@/lib/ports/wsl` (`ss`) i `@/lib/ports/windows` (PowerShell).
 * `@/lib/ports/proc` zostaje prawdziwy: `listSubdirectories` to sam `readdir` na katalogach testu.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawListener } from "@/lib/ports/types";
import type * as PortsWsl from "@/lib/ports/wsl";
import type * as PortsWindows from "@/lib/ports/windows";
import { setupTempVault } from "../helpers/tempVault";

const mockWsl = vi.hoisted(() => vi.fn<typeof PortsWsl.listWslListeners>());
const mockWindows = vi.hoisted(() => vi.fn<typeof PortsWindows.listWindowsListeners>());

vi.mock(
  "@/lib/ports/wsl",
  () => ({ listWslListeners: mockWsl }) satisfies Partial<typeof PortsWsl>
);
vi.mock(
  "@/lib/ports/windows",
  () => ({ listWindowsListeners: mockWindows }) satisfies Partial<typeof PortsWindows>
);

import { listPorts } from "@/contexts/bc_diagnostics/services";
import { listProjects } from "@/contexts/bc_projects/services";

const vault = setupTempVault();

const registry = (alfaPath: string, betaPath: string): string =>
  [
    "projects:",
    "  - id: alfa",
    "    name: Alfa",
    "    status: active",
    "    priority: high",
    "    folder: Projects/alfa/",
    "    owner: personal",
    `    local_path: '${alfaPath}'`,
    "  - id: beta",
    "    name: Beta",
    "    status: active",
    "    priority: medium",
    "    folder: Projects/beta/",
    "    owner: work",
    `    local_path: '${betaPath}'`,
    "",
  ].join("\n");

const listener = (o: Partial<RawListener> = {}): RawListener => ({
  port: 3000,
  address: "127.0.0.1",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  cwd: null,
  ancestors: [],
  ...o,
});

let home = "";
let alfaDir = "";
let betaDir = "";

beforeEach(() => {
  // Katalog nad vaultem sprząta `setupTempVault` po każdym teście.
  home = path.dirname(vault.root);
  alfaDir = path.join(home, "alfa");
  betaDir = path.join(home, "beta");
  fs.mkdirSync(path.join(alfaDir, "app"), { recursive: true });
  fs.mkdirSync(path.join(betaDir, "app"), { recursive: true });
  vault.write("Projects/_registry.yaml", registry(alfaDir, betaDir));

  mockWsl.mockResolvedValue({
    ok: true,
    listeners: [
      listener({ port: 3000, pid: 100, cwd: path.join(alfaDir, "app") }),
      listener({ port: 4000, pid: 200, cwd: path.join(betaDir, "app") }),
    ],
  });
  mockWindows.mockResolvedValue({ ok: false, reason: "missing" });
});

describe("granica diagnostics ↔ projects", () => {
  it("rejestr z vaulta: projekt własny i etatowy", () => {
    expect(listProjects().projects.map((p) => [p.id, p.owner])).toEqual([
      ["alfa", "personal"],
      ["beta", "work"],
    ]);
  });

  it("port w projekcie etatowym nie dostaje projektu (D7)", async () => {
    const snap = await listPorts({ home, selfPid: 1, now: () => new Date("2026-11-20T10:00:00Z") });

    expect(snap.sources).toEqual({ wsl: { ok: true }, windows: { ok: false, reason: "missing" } });
    expect(snap.ports.map((p) => [p.port, p.project])).toEqual([
      [3000, { id: "alfa", name: "Alfa" }],
      [4000, null],
    ]);
    expect(snap.ports[0]).toMatchObject({ id: "wsl|100|3000", role: null, orphan: false });
    expect(snap.ports[1]).toMatchObject({ id: "wsl|200|4000", role: null, orphan: false });
    expect(snap.groups).toEqual([{ projectId: "alfa", launcher: null, missingRole: null }]);
  });
});
