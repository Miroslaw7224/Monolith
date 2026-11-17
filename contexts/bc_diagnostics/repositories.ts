import { listWindowsListeners } from "@/lib/ports/windows";
import { listWslListeners } from "@/lib/ports/wsl";
import type { SourceResult } from "@/lib/ports/types";
import type { SourceName, SourceRead } from "./models";

function toRead(source: SourceName, result: SourceResult): SourceRead {
  if (result.ok === false) return { ok: false, reason: result.reason };
  return {
    ok: true,
    entries: result.listeners.map((l) => ({
      source,
      port: l.port,
      address: l.address,
      pid: l.pid,
      process: l.process ?? "",
      path: l.path,
      commandLine: l.commandLine,
    })),
  };
}

export async function readWsl(): Promise<SourceRead> {
  return toRead("wsl", await listWslListeners());
}

export async function readWindows(): Promise<SourceRead> {
  return toRead("windows", await listWindowsListeners());
}
