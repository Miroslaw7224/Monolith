import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConflictError, DomainError } from "@/lib/errors";
import { getVaultRoot } from "./vault-path";

export class PathOutsideVaultError extends DomainError {
  constructor(message: string) {
    super(message, 400);
    this.name = "PathOutsideVaultError";
  }
}

export type FileVersion = { size: number; hash: string };
export type VaultFile = { text: string; version: FileVersion };
export type VaultFsOptions = { root?: string };

function isInside(realRoot: string, abs: string): boolean {
  const relative = path.relative(realRoot, abs);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative)
  );
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

function rootOf(opts?: VaultFsOptions): string {
  return opts?.root ?? getVaultRoot();
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function readAt(abs: string, rel: string): VaultFile | null {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let raw: string;
  try {
    raw = utf8Decoder.decode(buf);
  } catch {
    throw new Error(`Plik nie jest poprawnym UTF-8: ${rel}`);
  }
  const text = normalizeEol(raw.replace(/^\uFEFF/, ""));
  return { text, version: versionOf(text) };
}

function writeAt(
  abs: string,
  rel: string,
  text: string,
  expected: FileVersion | null
): FileVersion {
  const current = readAt(abs, rel)?.version ?? null;
  if (!sameVersion(current, expected)) {
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
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* błąd sprzątania nie może przesłonić pierwotnego błędu */
    }
    throw err;
  }
  return versionOf(body);
}

/**
 * Odczyt pliku z vaulta (`null`, gdy nie istnieje). CRLF jest normalizowany do LF przy odczycie,
 * a każdy zapis zapisuje LF; BOM jest usuwany; plik z mieszanymi końcami linii zostanie
 * przepisany jako LF. Niepoprawny UTF-8 daje błąd.
 */
export function readVaultFile(rel: string, opts?: VaultFsOptions): VaultFile | null {
  const abs = resolveInsideVault(rootOf(opts), rel);
  return readAt(abs, rel);
}

/**
 * Zapis atomowy. `expected` = wersja z ostatniego odczytu (`null` = plik nie ma istnieć).
 * Niezgodność wersji tuż przed zapisem daje `ConflictError`. Między sprawdzeniem wersji a `rename`
 * oraz między rozwiązaniem ścieżki a jej użyciem zostaje wąskie okno wyścigu z procesem
 * zewnętrznym; akceptowane w modelu lokalnego zaufania.
 */
export function writeVaultFile(
  rel: string,
  text: string,
  opts: VaultFsOptions & { expected: FileVersion | null }
): FileVersion {
  const abs = resolveInsideVault(rootOf(opts), rel);
  return writeAt(abs, rel, text, opts.expected);
}

/**
 * Odczyt, zmiana, zapis. Zmiana zewnętrzna między odczytem a zapisem powoduje ponowny odczyt
 * i ponowne zastosowanie `mutate` (maks. `retries` razy).
 * Odczyt, mutate i zapis są synchroniczne, więc w jednym procesie nic się nie przeplata;
 * ochrona przed procesami zewnętrznymi to kontrola wersji i ponawianie.
 */
export async function updateVaultFile(
  rel: string,
  mutate: (current: string | null) => string,
  opts: VaultFsOptions & { retries?: number } = {}
): Promise<FileVersion> {
  const abs = resolveInsideVault(rootOf(opts), rel);
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    const file = readAt(abs, rel);
    const next = mutate(file?.text ?? null);
    try {
      return writeAt(abs, rel, next, file?.version ?? null);
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt >= retries) throw err;
    }
  }
}
