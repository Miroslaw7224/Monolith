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

/** In-memory fake of the repository functions; keyed by map id. */
function setupRepo() {
  const rows = new Map<string, MindMap>();
  let auto = 0;

  repo.createMindMap.mockImplementation(async (data: { title: string; rootNode: MindMapNode }) => {
    const map: MindMap = {
      id: `m${++auto}`,
      title: data.title,
      rootNode: data.rootNode,
      colWidths: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    rows.set(map.id, map);
    return map;
  });
  repo.getMindMaps.mockImplementation(async () => [...rows.values()]);
  repo.getMindMap.mockImplementation(async (mapId: string) => rows.get(mapId) ?? null);
  repo.saveMindMap.mockImplementation(async (mapId: string, patch: Partial<MindMap>) => {
    const key = mapId;
    const cur = rows.get(key);
    if (!cur) throw new Error("missing doc");
    rows.set(key, { ...cur, ...patch });
  });
  repo.deleteMindMap.mockImplementation(async (mapId: string) => {
    rows.delete(mapId);
  });

  return { rows };
}

function row(overrides: Partial<MindMap> & { id: string }): MindMap {
  return {
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
      const a = await createMindMap("  My map  ");
      expect(a.title).toBe("My map");
      expect(a.rootNode.label).toBe("My map");
      expect(a.id).toMatch(/^m/);
    });

    it("uses default title when whitespace only", async () => {
      setupRepo();
      const a = await createMindMap("   ");
      expect(a.title).toBe("Nowa mapa");
      expect(a.rootNode.label).toBe("Nowa mapa");
    });

    it("passes the root node to the repository", async () => {
      setupRepo();
      await createMindMap("X");
      expect(repo.createMindMap).toHaveBeenCalledWith({
        title: "X",
        rootNode: { id: "root", label: "X", note: "", collapsed: false, children: [] },
      });
    });
  });

  describe("getMindMaps", () => {
    it("returns maps sorted by updatedAt descending", async () => {
      const { rows } = setupRepo();
      rows.set("a", row({ id: "a", title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" }));
      rows.set("b", row({ id: "b", title: "New", updatedAt: "2026-11-12T11:00:00.000Z" }));

      const list = await getMindMaps();
      expect(list.map((m) => m.title)).toEqual(["New", "Old"]);
    });

    it("puts maps without updatedAt last", async () => {
      const { rows } = setupRepo();
      rows.set("a", row({ id: "a", title: "None" }));
      rows.set("b", row({ id: "b", title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" }));
      rows.set("c", row({ id: "c", title: "New", updatedAt: "2026-11-12T11:00:00.000Z" }));

      const list = await getMindMaps();
      expect(list.map((m) => m.title)).toEqual(["New", "Old", "None"]);
    });
  });

  describe("getMindMap", () => {
    it("throws 404 when missing", async () => {
      setupRepo();
      await expect(getMindMap("missing")).rejects.toThrow(DomainError);
      await expect(getMindMap("missing")).rejects.toMatchObject({
        message: "Mind map not found",
        statusCode: 404,
      });
    });

    it("returns the map", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x", title: "OK", colWidths: { 0: 120 } }));
      const m = await getMindMap("x");
      expect(m.title).toBe("OK");
      expect(m.colWidths).toEqual({ 0: 120 });
    });
  });

  describe("saveMindMap / deleteMindMap", () => {
    it("updates title and rootNode", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x" }));
      const newRoot: MindMapNode = {
        id: "root",
        label: "T2",
        note: "n",
        collapsed: true,
        children: [],
      };
      await saveMindMap("x", { title: " T2 ", rootNode: newRoot });
      const data = rows.get("x")!;
      expect(data.title).toBe("T2");
      expect(data.rootNode).toEqual(newRoot);
    });

    it("leaves the title alone when it is not provided", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x", title: "Keep" }));
      await saveMindMap("x", { rootNode: root("R") });
      expect(rows.get("x")!.title).toBe("Keep");
      expect(repo.saveMindMap).toHaveBeenCalledWith("x", { rootNode: root("R") });
    });

    it("does not reset colWidths when they are undefined", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x", colWidths: { 0: 120 } }));
      await saveMindMap("x", { title: "A", colWidths: undefined });
      expect(rows.get("x")!.colWidths).toEqual({ 0: 120 });
      expect(repo.saveMindMap.mock.calls[0][1]).not.toHaveProperty("colWidths");
    });

    it("writes colWidths when provided", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x" }));
      await saveMindMap("x", { colWidths: { 1: 200 } });
      expect(rows.get("x")!.colWidths).toEqual({ 1: 200 });
    });

    it("deleteMindMap removes document", async () => {
      const { rows } = setupRepo();
      rows.set("x", row({ id: "x" }));
      await deleteMindMap("x");
      expect(rows.has("x")).toBe(false);
    });

    it("saveMindMap on a missing map gives 404 and does not write", async () => {
      setupRepo();
      await expect(saveMindMap("missing", { title: "Z" })).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(repo.saveMindMap).not.toHaveBeenCalled();
    });

    it("deleteMindMap on a missing map gives 404 and does not delete", async () => {
      setupRepo();
      await expect(deleteMindMap("missing")).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.deleteMindMap).not.toHaveBeenCalled();
    });
  });
});
