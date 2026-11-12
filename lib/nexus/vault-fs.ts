import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConflictError } from "@/lib/errors";
import { getVaultRoot } from "./vault-path";

export class PathOutsideVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathOutsideVaultError";
  }
}

export type FileVersion = { size: number; hash: string };
export type VaultFile = { text: string; version: FileVersion };
type Opts = { root?: string };

function isInside(realRoot: string, abs: string): boolean {
  const relative = path.relative(realRoot, abs);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Najbliższy istniejący przodek (po realpath); wiszące dowiązanie traktujemy jako naruszenie. */
function realpathOfNearestAncestor(abs: string): string {
  let current = abs;
  for (;;) {
    try {
      return fs.realpathSync(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      let exists = true;
      try {
        fs.lstatSync(current);
      } catch (lerr) {
        if ((lerr as NodeJS.ErrnoException).code !== "ENOENT") throw lerr;
        exists = false;
      }
      if (exists) throw new PathOutsideVaultError(`Dangling symlink in path: ${abs}`);
      const parent = path.dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

export function resolveInsideVault(vaultRoot: string, rel: string): string {
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(vaultRoot);
  } catch {
    throw new Error(`Vault root does not exist: ${vaultRoot}`);
  }
  if (!fs.statSync(realRoot).isDirectory()) {
    throw new Error(`Vault root is not a directory: ${vaultRoot}`);
  }
  if (typeof rel !== "string" || rel === "") throw new PathOutsideVaultError("Empty path");
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || rel.includes("\0")) {
    throw new PathOutsideVaultError(`Absolute path not allowed: ${rel}`);
  }
  if (rel.split(/[\\/]/).some((segment) => segment === "..")) {
    throw new PathOutsideVaultError(`Path traversal not allowed: ${rel}`);
  }
  const abs = path.resolve(realRoot, rel);
  if (!isInside(realRoot, abs)) throw new PathOutsideVaultError(`Path outside vault: ${rel}`);
  const ancestor = realpathOfNearestAncestor(abs);
  if (ancestor !== realRoot && !isInside(realRoot, ancestor)) {
    throw new PathOutsideVaultError(`Path resolves outside vault: ${rel}`);
  }
  return abs;
}

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function versionOf(text: string): FileVersion {
  return {
    size: Buffer.byteLength(text, "utf8"),
    hash: createHash("sha256").update(text, "utf8").digest("hex"),
  };
}

function sameVersion(a: FileVersion | null, b: FileVersion | null): boolean {
  if (a === null || b === null) return a === b;
  return a.size === b.size && a.hash === b.hash;
}

function rootOf(opts?: Opts): string {
  return opts?.root ?? getVaultRoot();
}

export function readVaultFile(rel: string, opts?: Opts): VaultFile | null {
  const abs = resolveInsideVault(rootOf(opts), rel);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const text = normalizeEol(raw);
  return { text, version: versionOf(text) };
}

/**
 * Zapis atomowy. `expected` = wersja z ostatniego odczytu (`null` = plik nie ma istnieć).
 * Niezgodność wersji tuż przed zapisem daje `ConflictError`. Między sprawdzeniem a `rename`
 * zostaje wąskie okno wyścigu z procesem zewnętrznym (świadomie akceptowane).
 */
export function writeVaultFile(
  rel: string,
  text: string,
  opts: Opts & { expected: FileVersion | null }
): FileVersion {
  const abs = resolveInsideVault(rootOf(opts), rel);
  const current = readVaultFile(rel, opts)?.version ?? null;
  if (!sameVersion(current, opts.expected)) {
    throw new ConflictError(`Plik zmienił się w międzyczasie: ${rel}`);
  }
  const body = normalizeEol(text);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = path.join(
    path.dirname(abs),
    `.${path.basename(abs)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  );
  try {
    fs.writeFileSync(tmp, body, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tmp, abs);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  return versionOf(body);
}

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

/**
 * Odczyt, zmiana, zapis pod blokadą per plik. Zmiana zewnętrzna między odczytem a zapisem
 * powoduje ponowny odczyt i ponowne zastosowanie `mutate` (maks. `retries` razy).
 */
export async function updateVaultFile(
  rel: string,
  mutate: (current: string | null) => string,
  opts: Opts & { retries?: number } = {}
): Promise<FileVersion> {
  const abs = resolveInsideVault(rootOf(opts), rel);
  const retries = opts.retries ?? 3;
  return withLock(abs, async () => {
    for (let attempt = 0; ; attempt += 1) {
      const file = readVaultFile(rel, opts);
      const next = mutate(file?.text ?? null);
      try {
        return writeVaultFile(rel, next, { ...opts, expected: file?.version ?? null });
      } catch (err) {
        if (!(err instanceof ConflictError) || attempt >= retries) throw err;
      }
    }
  });
}
