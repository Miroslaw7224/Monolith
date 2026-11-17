import os from "node:os";
import path from "node:path";
import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import type {
  Exposure,
  PortGroup,
  PortListener,
  PortsSnapshot,
  PortWarning,
  ProcessRef,
  Role,
  SourceEntry,
  SourceName,
  SourceRead,
  SourceStatus,
} from "./models";
import { readSubdirs, readWindows, readWsl } from "./repositories";

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

/** D8 (rozszerzone po review): maskuje sekrety, potem ucina do 200 znaków. */
export function redactCommand(command: string | null): string | null {
  if (command === null) return null;
  const masked = command
    // Flagi długie: `--token=x` oraz `--token x` (cmdline z /proc jest łączony spacją);
    // wartość po spacji nie może zaczynać się od `-`, żeby nie zjeść następnej flagi.
    .replace(
      /(--[\w-]*?(?:token|password|passwd|pass|pwd|secret|api-key|apikey|auth|authorization|bearer)(?:=|\s+(?=[^-\s])))\S+/gi,
      "$1***"
    )
    // Zmienne środowiskowe tylko na początku tokenu (nie w środku URL-a z `?api_key=`).
    .replace(/((?<=^|\s)[A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET|KEY)=)\S+/gi, "$1***")
    .replace(
      /([?&](?:token|access_token|api_key|apikey|key|password|pass|secret)=)[^&\s]+/gi,
      "$1***"
    )
    .replace(/(:\/\/[^\s:@/]*:)[^\s@/]+@/g, "$1***@");
  return masked.slice(0, MAX_COMMAND);
}

/** Procesy samego systemu Windows nie są tym, czego szukamy (serwery, Docker, aplikacje): pomijamy je. */
function isWindowsSystemProcess(entry: SourceEntry): boolean {
  return entry.source === "windows" && SYSTEM_PROCESSES.has(entry.process.toLowerCase());
}

/** Prefiksy nazw procesów uruchamianych przez dewelopera (serwery, runtime, bazy, kontenery). */
const DEV_PROCESS_PREFIXES = [
  "node",
  "next-server",
  "npm",
  "npx",
  "tsx",
  "vite",
  "esbuild",
  "webpack",
  "python",
  "uvicorn",
  "gunicorn",
  "java",
  "dotnet",
  "ruby",
  "php",
  "deno",
  "bun",
  "postgres",
  "mysql",
  "mongo",
  "redis",
  "nginx",
  "caddy",
  "docker",
  "com.docker",
  "containerd",
];

export function isDevProcess(name: string): boolean {
  const n = name.toLowerCase();
  return DEV_PROCESS_PREFIXES.some((prefix) => n.startsWith(prefix));
}

function warningFor(entry: SourceEntry, selfPid: number): PortWarning | null {
  return entry.source === "wsl" && entry.pid === selfPid ? "self" : null;
}

function settle(result: PromiseSettledResult<SourceRead>): SourceRead {
  return result.status === "fulfilled" ? result.value : { ok: false, reason: "error" };
}

const statusOf = (read: SourceRead): SourceStatus =>
  read.ok === false ? { ok: false, reason: read.reason } : { ok: true };

/** `root`: katalog dopasowany do `cwd` (także wariant `-prod`); `base`: główny katalog projektu. */
type ProjectRoot = { id: string; name: string; root: string; base: string };

/** `~`, `~/x` lub ścieżka bezwzględna → znormalizowana ścieżka bez końcowego `/`; inaczej `null`. */
function expandHome(raw: string, home: string): string | null {
  const p = raw.trim();
  let abs: string;
  if (p === "~") abs = home;
  else if (p.startsWith("~/")) abs = path.posix.join(home, p.slice(2));
  else if (p.startsWith("/")) abs = p;
  else return null;
  const norm = path.posix.normalize(abs).replace(/\/+$/, "");
  return norm === "" ? null : norm;
}

/**
 * Projekty z vaulta do dopasowania po katalogu. Projekty etatowe (`owner: work`) pomijamy (D7),
 * a błąd odczytu vaulta nie może psuć listy portów.
 */
function loadProjectRoots(home: string): ProjectRoot[] {
  try {
    return listProjects().projects.flatMap((p) => {
      if (isWorkProject(p)) return [];
      const root = expandHome(p.localPath, home);
      if (root === null) return [];
      // `<katalog>-prod`: worktree produkcyjny (ikona pulpitu uruchamia `main` stamtąd, zob. CLAUDE.md).
      return [
        { id: p.id, name: p.name, root, base: root },
        { id: p.id, name: p.name, root: `${root}-prod`, base: root },
      ];
    });
  } catch {
    return [];
  }
}

/** Najdłuższy prefiks `cwd` względem katalogu projektu na granicy segmentu (remis: alfabetycznie po `id`). */
function matchProject(
  cwd: string | null,
  roots: ProjectRoot[]
): { match: ProjectRoot; dir: string } | null {
  if (cwd === null || !cwd.startsWith("/")) return null;
  const dir = path.posix.normalize(cwd).replace(/\/+$/, "");
  let best: ProjectRoot | null = null;
  for (const r of roots) {
    if (dir !== r.root && !dir.startsWith(`${r.root}/`)) continue;
    if (
      best === null ||
      r.root.length > best.root.length ||
      (r.root.length === best.root.length && r.id < best.id)
    ) {
      best = r;
    }
  }
  return best === null ? null : { match: best, dir };
}

const FRONTEND_DIRS = ["frontend", "client", "web", "ui"];
const BACKEND_DIRS = ["backend", "server", "api"];
const FRONTEND_COMMAND = /\b(vite|webpack|react-scripts|parcel)\b/;
const BACKEND_COMMAND = /\b(uvicorn|gunicorn|hypercorn|daphne|flask|fastapi|django)\b/;

/** Rola procesu w aplikacji: najpierw podkatalog projektu (`frontend/`, `backend/`…), potem komenda. */
function roleOf(
  entry: SourceEntry,
  match: { match: ProjectRoot; dir: string } | null
): Role | null {
  if (match === null) return null;
  const rel = match.dir.slice(match.match.root.length).replace(/^\//, "");
  const first = rel.split("/")[0] ?? "";
  if (FRONTEND_DIRS.includes(first)) return "frontend";
  if (BACKEND_DIRS.includes(first)) return "backend";
  const text = `${entry.process} ${entry.commandLine ?? ""}`.toLowerCase();
  if (FRONTEND_COMMAND.test(text)) return "frontend";
  if (BACKEND_COMMAND.test(text)) return "backend";
  return null;
}

const isInit = (p: ProcessRef): boolean => p.pid === 1 || p.name === "systemd" || p.name === "init";

/** Rodzic procesu aplikacji to systemd/init: uruchamiający go proces (np. `concurrently`) już nie żyje. */
function isOrphan(entry: SourceEntry, hasProject: boolean): boolean {
  const parent = entry.ancestors[0];
  return hasProject && parent !== undefined && isInit(parent);
}

/** Najbliższy wspólny przodek wszystkich procesów (bez init/systemd) albo `null`. */
function commonLauncher(chains: ProcessRef[][]): ProcessRef | null {
  if (chains.length < 2) return null;
  const [first, ...rest] = chains;
  const others = rest.map((c) => new Set(c.map((a) => a.pid)));
  const found = first.find((a) => !isInit(a) && others.every((set) => set.has(a.pid)));
  return found ?? null;
}

export interface ListPortsOptions {
  /** PID serwera Monolith (domyślnie `process.pid`); tylko do testów. */
  selfPid?: number;
  now?: () => Date;
  /** Katalog domowy do rozwijania `~` w `localPath` (domyślnie `os.homedir()`); tylko do testów. */
  home?: string;
}

type Row = { port: PortListener; chain: ProcessRef[]; base: string | null };

export async function listPorts(options: ListPortsOptions = {}): Promise<PortsSnapshot> {
  const selfPid = options.selfPid ?? process.pid;
  const now = options.now ?? (() => new Date());
  const roots = loadProjectRoots(options.home ?? os.homedir());
  const [wslRes, winRes] = await Promise.allSettled([readWsl(), readWindows()]);
  const wsl = settle(wslRes);
  const windows = settle(winRes);

  // Jeden wiersz = (źródło, PID, port); adresy (IPv4/IPv6) scalane i bez powtórek.
  const merged = new Map<string, { entry: SourceEntry; addresses: Set<string> }>();
  for (const read of [wsl, windows]) {
    if (read.ok === false) continue;
    for (const e of read.entries) {
      if (isWindowsSystemProcess(e)) continue;
      const key = `${e.source}|${e.pid}|${e.port}`;
      const existing = merged.get(key);
      if (existing) existing.addresses.add(e.address);
      else merged.set(key, { entry: e, addresses: new Set([e.address]) });
    }
  }

  const rows: Row[] = [...merged.entries()].map(([id, { entry: e, addresses }]) => {
    const list = [...addresses].sort();
    const warning = warningFor(e, selfPid);
    const found = matchProject(e.cwd, roots);
    return {
      chain: e.ancestors,
      base: found?.match.base ?? null,
      port: {
        id,
        source: e.source,
        port: e.port,
        addresses: list,
        pid: e.pid,
        process: e.process,
        path: e.path,
        commandLine: redactCommand(e.commandLine),
        project: found ? { id: found.match.id, name: found.match.name } : null,
        role: roleOf(e, found),
        orphan: isOrphan(e, found !== null),
        exposure: list.every((a) => classifyExposure(a) === "local") ? "local" : "network",
        warning,
        killCommand: buildKillCommand(e.source, e.pid),
        relevant:
          warning === "self" || isDevProcess(e.process) || (e.process === "" && e.port >= 1024),
      },
    };
  });
  rows.sort(
    (a, b) => a.port.port - b.port.port || SOURCE_ORDER[a.port.source] - SOURCE_ORDER[b.port.source]
  );

  // Grupy: jeden wpis na projekt, który ma uruchomione procesy.
  const byProject = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.port.project === null) continue;
    const list = byProject.get(r.port.project.id) ?? [];
    list.push(r);
    byProject.set(r.port.project.id, list);
  }
  const groups: PortGroup[] = await Promise.all(
    [...byProject.entries()].map(async ([projectId, members]) => {
      const distinct = new Map(members.map((m) => [m.port.pid, m.chain] as const));
      const launcher = commonLauncher([...distinct.values()]);
      const roles = new Set(members.flatMap((m) => (m.port.role ? [m.port.role] : [])));
      let missingRole: Role | null = null;
      const base = members[0].base;
      if (roles.size === 1 && base !== null) {
        const dirs = await readSubdirs(base).catch(() => [] as string[]);
        const hasFront = dirs.some((d) => FRONTEND_DIRS.includes(d));
        const hasBack = dirs.some((d) => BACKEND_DIRS.includes(d));
        if (hasFront && hasBack) missingRole = roles.has("frontend") ? "backend" : "frontend";
      }
      return { projectId, launcher, missingRole };
    })
  );

  return {
    generatedAt: now().toISOString(),
    sources: { wsl: statusOf(wsl), windows: statusOf(windows) },
    ports: rows.map((r) => r.port),
    groups,
  };
}
