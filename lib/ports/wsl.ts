import { readFile, readlink } from "node:fs/promises";
import { parseSs } from "./parse-ss";
import { readAncestors } from "./proc";
import { runCommand, type RunFn } from "./run";
import type { ProcessRef, SourceResult } from "./types";

export interface WslDeps {
  run: RunFn;
  readCmdline: (pid: number) => Promise<string | null>;
  readCwd: (pid: number) => Promise<string | null>;
  readAncestors: (pid: number) => Promise<ProcessRef[]>;
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
  readAncestors: (pid) => readAncestors(pid),
};

/** Porty LISTEN w WSL: `ss -ltnpH` + `/proc/<pid>/cmdline`. Nigdy nie rzuca. */
export async function listWslListeners(deps: WslDeps = DEFAULT_DEPS): Promise<SourceResult> {
  const res = await deps.run("ss", ["-ltnpH"], 8000);
  if (res.ok === false) return { ok: false, reason: res.reason };
  const listeners = parseSs(res.stdout);
  const pids = [...new Set(listeners.flatMap((l) => (l.pid === null ? [] : [l.pid])))];
  const details = new Map<
    number,
    { commandLine: string | null; cwd: string | null; ancestors: ProcessRef[] }
  >(
    await Promise.all(
      pids.map(
        async (pid) =>
          [
            pid,
            {
              commandLine: await deps.readCmdline(pid),
              cwd: await deps.readCwd(pid),
              ancestors: await deps.readAncestors(pid),
            },
          ] as const
      )
    )
  );
  return {
    ok: true,
    listeners: listeners.map((l) => {
      const d = l.pid === null ? undefined : details.get(l.pid);
      return {
        ...l,
        commandLine: d?.commandLine ?? null,
        cwd: d?.cwd ?? null,
        ancestors: d?.ancestors ?? [],
      };
    }),
  };
}
