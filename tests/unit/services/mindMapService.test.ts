import { describe, it, expect, vi } from "vitest";
import { DomainError } from "../../../lib/errors.js";
import type { MindMap, MindMapNode } from "../../../types/records.js";

const repo = vi.hoisted(() => ({
  getMindMaps: vi.fn(),
  getMindMap: vi.fn(),
  createMindMap: vi.fn(),
  saveMindMap: vi.fn(),
  deleteMindMap: vi.fn(),
}));

vi.mock("../../../lib/firestore-db.js", () => repo);

import {
  createMindMap,
  getMindMaps,
  getMindMap,
  saveMindMap,
  deleteMindMap,
} from "../../../services/mindMapService.js";

const NOW = "2026-11-12T10:00:00.000Z";

function root(label: string): MindMapNode {
  return { id: "root", label, note: "", collapsed: false, children: [] };
}

/** In-memory fake of the repository functions; keys are `${userId}:${id}`. */
function setupRepo() {
  const rows = new Map<string, MindMap>();
  let auto = 0;

  repo.createMindMap.mockImplementation(
    async (userId: string, data: { title: string; rootNode: MindMapNode }) => {
      const map: MindMap = {
        id: `m${++auto}`,
        userId,
        title: data.title,
        rootNode: data.rootNode,
        colWidths: {},
        createdAt: NOW,
        updatedAt: NOW,
      };
      rows.set(`${userId}:${map.id}`, map);
      return map;
    }
  );
  repo.getMindMaps.mockImplementation(async (userId: string) =>
    [...rows.entries()].filter(([k]) => k.startsWith(`${userId}:`)).map(([, v]) => v)
  );
  repo.getMindMap.mockImplementation(
    async (userId: string, mapId: string) => rows.get(`${userId}:${mapId}`) ?? null
  );
  repo.saveMindMap.mockImplementation(
    async (userId: string, mapId: string, patch: Partial<MindMap>) => {
      const key = `${userId}:${mapId}`;
      const cur = rows.get(key);
      if (!cur) throw new Error("missing doc");
      rows.set(key, { ...cur, ...patch });
    }
  );
  repo.deleteMindMap.mockImplementation(async (userId: string, mapId: string) => {
    rows.delete(`${userId}:${mapId}`);
  });

  return { rows };
}

function row(overrides: Partial<MindMap> & { id: string }): MindMap {
  return {
    userId: "u1",
    title: "T",
    rootNode: root("T"),
    colWidths: {},
    ...overrides,
  };
}

describe("mindMapService", () => {
  describe("createMindMap", () => {
    it("creates map with trimmed title and default when empty", async () => {
      setupRepo();
      const a = await createMindMap("u1", "  My map  ");
      expect(a.title).toBe("My map");
      expect(a.userId).toBe("u1");
      expect(a.rootNode.label).toBe("My map");
      expect(a.id).toMatch(/^m/);
    });

    it("uses default title when whitespace only", async () => {
      setupRepo();
      const a = await createMindMap("u1", "   ");
      expect(a.title).toBe("Nowa mapa");
      expect(a.rootNode.label).toBe("Nowa mapa");
    });

    it("passes the root node to the repository", async () => {
      setupRepo();
      await createMindMap("u1", "X");
      expect(repo.createMindMap).toHaveBeenCalledWith("u1", {
        title: "X",
        rootNode: { id: "root", label: "X", note: "", collapsed: false, children: [] },
      });
    });
  });

  describe("getMindMaps", () => {
    it("returns maps sorted by updatedAt descending", async () => {
      const { rows } = setupRepo();
      rows.set("u1:a", row({ id: "a", title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" }));
      rows.set("u1:b", row({ id: "b", title: "New", updatedAt: "2026-11-12T11:00:00.000Z" }));

      const list = await getMindMaps("u1");
      expect(list.map((m) => m.title)).toEqual(["New", "Old"]);
    });

    it("puts maps without updatedAt last", async () => {
      const { rows } = setupRepo();
      rows.set("u1:a", row({ id: "a", title: "None" }));
      rows.set("u1:b", row({ id: "b", title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" }));
      rows.set("u1:c", row({ id: "c", title: "New", updatedAt: "2026-11-12T11:00:00.000Z" }));

      const list = await getMindMaps("u1");
      expect(list.map((m) => m.title)).toEqual(["New", "Old", "None"]);
    });
  });

  describe("getMindMap", () => {
    it("throws 404 when missing", async () => {
      setupRepo();
      await expect(getMindMap("u1", "missing")).rejects.toThrow(DomainError);
      await expect(getMindMap("u1", "missing")).rejects.toMatchObject({
        message: "Mind map not found",
        statusCode: 404,
      });
    });

    it("throws 404 when document userId mismatches", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", userId: "other", title: "Hijack" }));
      await expect(getMindMap("u1", "x")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns map when owned", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", title: "OK", colWidths: { 0: 120 } }));
      const m = await getMindMap("u1", "x");
      expect(m.title).toBe("OK");
      expect(m.colWidths).toEqual({ 0: 120 });
    });
  });

  describe("saveMindMap / deleteMindMap", () => {
    it("updates title and rootNode", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x" }));
      const newRoot: MindMapNode = {
        id: "root",
        label: "T2",
        note: "n",
        collapsed: true,
        children: [],
      };
      await saveMindMap("u1", "x", { title: " T2 ", rootNode: newRoot });
      const data = rows.get("u1:x")!;
      expect(data.title).toBe("T2");
      expect(data.rootNode).toEqual(newRoot);
    });

    it("leaves the title alone when it is not provided", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", title: "Keep" }));
      await saveMindMap("u1", "x", { rootNode: root("R") });
      expect(rows.get("u1:x")!.title).toBe("Keep");
      expect(repo.saveMindMap).toHaveBeenCalledWith("u1", "x", { rootNode: root("R") });
    });

    it("does not reset colWidths when they are undefined", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", colWidths: { 0: 120 } }));
      await saveMindMap("u1", "x", { title: "A", colWidths: undefined });
      expect(rows.get("u1:x")!.colWidths).toEqual({ 0: 120 });
      expect(repo.saveMindMap.mock.calls[0][2]).not.toHaveProperty("colWidths");
    });

    it("writes colWidths when provided", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x" }));
      await saveMindMap("u1", "x", { colWidths: { 1: 200 } });
      expect(rows.get("u1:x")!.colWidths).toEqual({ 1: 200 });
    });

    it("rejects saving a foreign map with 404 and does not write", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", userId: "other" }));
      await expect(saveMindMap("u1", "x", { title: "Z" })).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(repo.saveMindMap).not.toHaveBeenCalled();
    });

    it("deleteMindMap removes document", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x" }));
      await deleteMindMap("u1", "x");
      expect(rows.has("u1:x")).toBe(false);
    });

    it("deleteMindMap on a foreign map gives 404 and the row remains", async () => {
      const { rows } = setupRepo();
      rows.set("u1:x", row({ id: "x", userId: "other" }));
      await expect(deleteMindMap("u1", "x")).rejects.toMatchObject({ statusCode: 404 });
      expect(rows.has("u1:x")).toBe(true);
      expect(repo.deleteMindMap).not.toHaveBeenCalled();
    });
  });
});
