import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { PlannedFile, VaultView } from "./types";

export class PathOutsideVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathOutsideVaultError";
  }
}

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
      if (exists) {
        throw new PathOutsideVaultError(`Dangling symlink in path: ${abs}`);
      }
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
  if (typeof rel !== "string" || rel === "") {
    throw new PathOutsideVaultError("Empty path");
  }
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || rel.includes("\0")) {
    throw new PathOutsideVaultError(`Absolute path not allowed: ${rel}`);
  }
  if (rel.split(/[\\/]/).some((segment) => segment === "..")) {
    throw new PathOutsideVaultError(`Path traversal not allowed: ${rel}`);
  }
  const abs = path.resolve(realRoot, rel);
  if (!isInside(realRoot, abs)) {
    throw new PathOutsideVaultError(`Path outside vault: ${rel}`);
  }
  const ancestor = realpathOfNearestAncestor(abs);
  if (ancestor !== realRoot && !isInside(realRoot, ancestor)) {
    throw new PathOutsideVaultError(`Path resolves outside vault: ${rel}`);
  }
  return abs;
}

export function atomicWrite(abs: string, content: string): void {
  const dir = path.dirname(abs);
  const tmp = path.join(
    dir,
    `.${path.basename(abs)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  );
  try {
    fs.writeFileSync(tmp, content, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tmp, abs);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function createVaultView(vaultRoot: string): VaultView {
  return {
    read(rel: string): string | null {
      const abs = resolveInsideVault(vaultRoot, rel);
      try {
        return fs.readFileSync(abs, "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    list(relDir: string): string[] {
      const abs = resolveInsideVault(vaultRoot, relDir);
      try {
        return fs
          .readdirSync(abs, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
          .sort();
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
    },
  };
}

export function applyPlan(
  vaultRoot: string,
  files: PlannedFile[]
): { created: number; updated: number; unchanged: number } {
  const resolved = files.map((file) => ({
    file,
    abs: resolveInsideVault(vaultRoot, file.relPath),
  }));
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const { file, abs } of resolved) {
    if (file.action === "unchanged") {
      unchanged += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    atomicWrite(abs, file.content);
    if (file.action === "create") created += 1;
    else updated += 1;
  }
  return { created, updated, unchanged };
}
