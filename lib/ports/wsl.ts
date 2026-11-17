import { readFile, readlink } from "node:fs/promises";
import { parseSs } from "./parse-ss";
import { runCommand, type RunFn } from "./run";
import type { SourceResult } from "./types";

export interface WslDeps {
  run: RunFn;
  readCmdline: (pid: number) => Promise<string | null>;
  readCwd: (pid: number) => Promise<string | null>;
}

async function readProcCmdline(pid: number): Promise<string | null> {
  try {
    const raw = await readFile(`/proc/${pid}/cmdline`, "utf8");
    const text = raw
      .split("\0")
      .filter((p) => p !== "")
      .join(" ");
    return text === "" ? null : text;
  } catch {
    return null;
  }
}

async function readProcCwd(pid: number): Promise<string | null> {
  try {
    const target = await readlink(`/proc/${pid}/cwd`);
    return target === "" ? null : target;
  } catch {
    return null;
  }
}

const DEFAULT_DEPS: WslDeps = {
  run: runCommand,
  readCmdline: readProcCmdline,
  readCwd: readProcCwd,
};

/** Porty LISTEN w WSL: `ss -ltnpH` + `/proc/<pid>/cmdline`. Nigdy nie rzuca. */
export async function listWslListeners(deps: WslDeps = DEFAULT_DEPS): Promise<SourceResult> {
  const res = await deps.run("ss", ["-ltnpH"], 8000);
  if (res.ok === false) return { ok: false, reason: res.reason };
  const listeners = parseSs(res.stdout);
  const pids = [...new Set(listeners.flatMap((l) => (l.pid === null ? [] : [l.pid])))];
  const details = new Map<number, { commandLine: string | null; cwd: string | null }>(
    await Promise.all(
      pids.map(
        async (pid) =>
          [pid, { commandLine: await deps.readCmdline(pid), cwd: await deps.readCwd(pid) }] as const
      )
    )
  );
  return {
    ok: true,
    listeners: listeners.map((l) => ({
      ...l,
      commandLine: l.pid === null ? null : (details.get(l.pid)?.commandLine ?? null),
      cwd: l.pid === null ? null : (details.get(l.pid)?.cwd ?? null),
    })),
  };
}
