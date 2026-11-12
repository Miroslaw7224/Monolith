// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATH_TS = "lib/nexus/vault-path.ts";
const FS_TS = "lib/nexus/vault-fs.ts";
const FILES = [PATH_TS, FS_TS];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function hits(pattern: RegExp, allowed: string[] = []): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of FILES) {
    if (allowed.includes(rel)) continue;
    const text = read(rel);
    for (const m of text.matchAll(global))
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
  }
  return out;
}

describe("lib/nexus vault-* static guards", () => {
  it("scans existing sources", () => {
    for (const rel of FILES) expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });
  it("1. has no forbidden words or process APIs", () => {
    expect(hits(/firebase|child_process|execSync|spawn|node:os|homedir|backups/i)).toEqual([]);
  });
  it("2. imports node:fs only in vault-fs", () => {
    expect(
      hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/, [FS_TS])
    ).toEqual([]);
    expect(read(FS_TS)).toMatch(/from\s+["']node:fs["']/);
  });
  it("3. mutates the file system only in vault-fs, with a single rmSync", () => {
    expect(
      hits(
        /writeFileSync|renameSync|rmSync|mkdirSync|appendFileSync|unlinkSync|createWriteStream/,
        [FS_TS]
      )
    ).toEqual([]);
    const text = read(FS_TS);
    expect(text.match(/rmSync\(/g) ?? []).toHaveLength(1);
    expect(text).not.toMatch(/unlinkSync|rmdirSync/);
  });
  it("4. resolves every path inside the vault before reading or writing", () => {
    const text = read(FS_TS);
    expect(text).toMatch(/export function readVaultFile[\s\S]*?resolveInsideVault\(/);
    expect(text).toMatch(/export function writeVaultFile[\s\S]*?resolveInsideVault\(/);
    expect(text).toMatch(/export async function updateVaultFile[\s\S]*?resolveInsideVault\(/);
  });
  it("5. reads process.env only in vault-path", () => {
    expect(hits(/process\.env/, [PATH_TS])).toEqual([]);
  });
});
