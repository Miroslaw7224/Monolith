import type {
  Exposure,
  PortListener,
  PortsSnapshot,
  PortWarning,
  SourceEntry,
  SourceName,
  SourceRead,
  SourceStatus,
} from "./models";
import { readWindows, readWsl } from "./repositories";

const MAX_COMMAND = 200;
const SYSTEM_PROCESSES = new Set([
  "system",
  "lsass",
  "services",
  "wininit",
  "svchost",
  "csrss",
  "smss",
]);
const SOURCE_ORDER: Record<SourceName, number> = { wsl: 0, windows: 1 };

export function classifyExposure(address: string): Exposure {
  const a = address.toLowerCase();
  if (/^127\./.test(a) || a === "::1" || a.startsWith("::ffff:127.")) return "local";
  return "network";
}

/** Komenda kill powstaje wyłącznie z całkowitego dodatniego PID-a (nigdy z nazwy ani komendy procesu). */
export function buildKillCommand(source: SourceName, pid: number | null): string | null {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) return null;
  return source === "wsl" ? `kill ${pid}` : `Stop-Process -Id ${pid}`;
}

/** D8: maskuje sekrety, potem ucina do 200 znaków. */
export function redactCommand(command: string | null): string | null {
  if (command === null) return null;
  const masked = command
    .replace(/(--(?:token|password|secret|api-key)=)\S+/gi, "$1***")
    .replace(/(\b[A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET)=)\S+/gi, "$1***")
    .replace(/(:\/\/[^\s:@/]+:)[^\s@/]+@/g, "$1***@");
  return masked.slice(0, MAX_COMMAND);
}

function warningFor(entry: SourceEntry, selfPid: number): PortWarning | null {
  if (entry.source === "wsl" && entry.pid === selfPid) return "self";
  if (entry.source === "windows" && SYSTEM_PROCESSES.has(entry.process.toLowerCase())) {
    return "system";
  }
  return null;
}

function settle(result: PromiseSettledResult<SourceRead>): SourceRead {
  return result.status === "fulfilled" ? result.value : { ok: false, reason: "error" };
}

const statusOf = (read: SourceRead): SourceStatus =>
  read.ok ? { ok: true } : { ok: false, reason: read.reason };

export interface ListPortsOptions {
  /** PID serwera Monolith (domyślnie `process.pid`); tylko do testów. */
  selfPid?: number;
  now?: () => Date;
}

export async function listPorts(options: ListPortsOptions = {}): Promise<PortsSnapshot> {
  const selfPid = options.selfPid ?? process.pid;
  const now = options.now ?? (() => new Date());
  const [wslRes, winRes] = await Promise.allSettled([readWsl(), readWindows()]);
  const wsl = settle(wslRes);
  const windows = settle(winRes);

  const seen = new Set<string>();
  const ports: PortListener[] = [];
  for (const read of [wsl, windows]) {
    if (!read.ok) continue;
    for (const e of read.entries) {
      const key = `${e.source}|${e.pid}|${e.port}|${e.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ports.push({
        ...e,
        commandLine: redactCommand(e.commandLine),
        exposure: classifyExposure(e.address),
        warning: warningFor(e, selfPid),
        killCommand: buildKillCommand(e.source, e.pid),
      });
    }
  }
  ports.sort(
    (a, b) =>
      a.port - b.port ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      a.address.localeCompare(b.address)
  );

  return {
    generatedAt: now().toISOString(),
    sources: { wsl: statusOf(wsl), windows: statusOf(windows) },
    ports,
  };
}
