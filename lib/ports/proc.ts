import { readFile, readdir } from "node:fs/promises";
import type { ProcessRef } from "./types";

/** PPID z treści `/proc/<pid>/stat` (`pid (nazwa) S ppid …`; nazwa może mieć spacje i nawiasy). */
export function parseStatPpid(stat: string): number | null {
  const close = stat.lastIndexOf(")");
  if (close < 0) return null;
  const fields = stat.slice(close + 2).split(" ");
  const ppid = Number(fields[1]);
  return Number.isInteger(ppid) && fields[1] !== "" ? ppid : null;
}

async function readPpid(pid: number): Promise<number | null> {
  try {
    return parseStatPpid(await readFile(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

async function readComm(pid: number): Promise<string | null> {
  try {
    return (await readFile(`/proc/${pid}/comm`, "utf8")).trim();
  } catch {
    return null;
  }
}

/**
 * Przodkowie procesu, od najbliższego rodzica w górę (do PID 1 włącznie lub `maxDepth`).
 * Procesy znikające w trakcie odczytu kończą łańcuch; nigdy nie rzuca.
 */
export async function readAncestors(pid: number, maxDepth = 12): Promise<ProcessRef[]> {
  const out: ProcessRef[] = [];
  let current = pid;
  for (let i = 0; i < maxDepth; i++) {
    const ppid = await readPpid(current);
    if (ppid === null || ppid <= 0) break;
    const name = await readComm(ppid);
    if (name === null) break;
    out.push({ pid: ppid, name });
    if (ppid === 1) break;
    current = ppid;
  }
  return out;
}

/** Nazwy podkatalogów (bez plików); brak katalogu lub brak dostępu daje `[]`. */
export async function listSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
