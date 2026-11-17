// @vitest-environment node
import { describe, expect, it } from "vitest";
import { listSubdirectories, parseStatPpid, readAncestors } from "@/lib/ports/proc";

describe("parseStatPpid", () => {
  it("czyta PPID z /proc/<pid>/stat", () => {
    expect(parseStatPpid("2678595 (node) S 2678588 2678588 2678588 0 -1 4194560")).toBe(2678588);
  });

  it("nazwa z nawiasami i spacjami nie psuje parsowania", () => {
    expect(parseStatPpid("2562323 (next-server (v1) S 2562293 1 2 3")).toBe(2562293);
  });

  it.each(["", "śmieci", "12 (x)", "12 (x) S abc 1"])("niepoprawny wpis %j daje null", (raw) => {
    expect(parseStatPpid(raw)).toBeNull();
  });
});

describe("readAncestors", () => {
  it("dla bieżącego procesu zaczyna od jego rodzica i kończy na init/systemd", async () => {
    const chain = await readAncestors(process.pid);
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].pid).toBe(process.ppid);
    expect(chain[0].name).not.toBe("");
    for (const a of chain) {
      expect(Number.isInteger(a.pid)).toBe(true);
      expect(a.pid).toBeGreaterThan(0);
    }
  });

  it("nieistniejący PID daje pustą listę", async () => {
    expect(await readAncestors(2 ** 22 - 1)).toEqual([]);
  });

  it("respektuje limit głębokości", async () => {
    expect((await readAncestors(process.pid, 1)).length).toBeLessThanOrEqual(1);
  });
});

describe("listSubdirectories", () => {
  it("zwraca nazwy podkatalogów (bez plików), a brak katalogu daje []", async () => {
    const dirs = await listSubdirectories(process.cwd());
    expect(dirs).toContain("lib");
    expect(dirs).not.toContain("package.json");
    expect(await listSubdirectories("/nie/ma/takiego/katalogu")).toEqual([]);
  });
});
