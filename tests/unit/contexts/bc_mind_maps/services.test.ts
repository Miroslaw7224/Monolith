// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import type { MindMapNode } from "@/contexts/bc_mind_maps/models";
import {
  createMindMap,
  getMindMaps,
  getMindMap,
  saveMindMap,
  deleteMindMap,
} from "@/contexts/bc_mind_maps/services";
import { setupTempVault } from "../../helpers/tempVault";

const NOW = "2026-11-12T10:00:00.000Z";
const vault = setupTempVault();

afterEach(() => vi.useRealTimers());
const freeze = (iso = NOW) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

const rel = (id: string) => `MindMaps/${id}.json`;
/** Zawartość pliku mapy odczytana z vaulta. */
const stored = (id: string) => JSON.parse(vault.read(rel(id))!);

function root(label: string, over: Partial<MindMapNode> = {}): MindMapNode {
  return { id: "root", label, note: "", collapsed: false, children: [], ...over };
}

/** Zapisuje plik mapy tak, jak robi to repozytorium. */
function seed(
  id: string,
  over: { title?: string; colWidths?: Record<number, number>; updatedAt?: string } = {}
) {
  vault.write(
    rel(id),
    JSON.stringify({
      title: over.title ?? "T",
      rootNode: root(over.title ?? "T"),
      colWidths: over.colWidths ?? {},
      ...(over.updatedAt !== undefined && { updatedAt: over.updatedAt }),
    })
  );
}

describe("mindMapService", () => {
  describe("createMindMap", () => {
    it("zapisuje mapę z przyciętym tytułem i korzeniem o tej etykiecie", async () => {
      freeze();

      const a = await createMindMap("  My map  ");

      expect(a.id).toMatch(/^[A-Za-z0-9]{20}$/);
      expect(stored(a.id)).toEqual({
        title: "My map",
        rootNode: root("My map"),
        colWidths: {},
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it("uses default title when whitespace only", async () => {
      const a = await createMindMap("   ");

      const file = stored(a.id);
      expect(file.title).toBe("Nowa mapa");
      expect(file.rootNode.label).toBe("Nowa mapa");
    });
  });

  describe("getMindMaps", () => {
    it("returns maps sorted by updatedAt descending", async () => {
      seed("a", { title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" });
      seed("b", { title: "New", updatedAt: "2026-11-12T11:00:00.000Z" });

      const list = await getMindMaps();
      expect(list.map((m) => m.title)).toEqual(["New", "Old"]);
    });

    it("puts maps without updatedAt last", async () => {
      seed("a", { title: "None" });
      seed("b", { title: "Old", updatedAt: "2026-11-12T10:00:00.000Z" });
      seed("c", { title: "New", updatedAt: "2026-11-12T11:00:00.000Z" });

      const list = await getMindMaps();
      expect(list.map((m) => m.title)).toEqual(["New", "Old", "None"]);
    });
  });

  describe("getMindMap", () => {
    it("throws 404 when missing", async () => {
      await expect(getMindMap("missing")).rejects.toThrow(DomainError);
      await expect(getMindMap("missing")).rejects.toMatchObject({
        message: "Mind map not found",
        statusCode: 404,
      });
    });

    it("returns the map", async () => {
      seed("x", { title: "OK", colWidths: { 0: 120 } });
      const m = await getMindMap("x");
      expect(m.title).toBe("OK");
      expect(m.colWidths).toEqual({ 0: 120 });
    });
  });

  describe("saveMindMap / deleteMindMap", () => {
    it("zapisuje przycięty tytuł i korzeń w pliku, a updatedAt przesuwa", async () => {
      seed("x", { updatedAt: "2026-01-01T00:00:00.000Z" });
      freeze();
      const newRoot = root("T2", { note: "n", collapsed: true });

      await saveMindMap("x", { title: " T2 ", rootNode: newRoot });

      expect(stored("x")).toEqual({
        title: "T2",
        rootNode: newRoot,
        colWidths: {},
        updatedAt: NOW,
      });
    });

    it("leaves the title alone when it is not provided", async () => {
      seed("x", { title: "Keep" });

      await saveMindMap("x", { rootNode: root("R") });

      const file = stored("x");
      expect(file.title).toBe("Keep");
      expect(file.rootNode).toEqual(root("R"));
    });

    it("does not reset colWidths when they are undefined", async () => {
      seed("x", { colWidths: { 0: 120 } });

      await saveMindMap("x", { title: "A", colWidths: undefined });

      expect(stored("x").colWidths).toEqual({ 0: 120 });
    });

    it("writes colWidths when provided", async () => {
      seed("x");

      await saveMindMap("x", { colWidths: { 1: 200 } });

      expect(stored("x").colWidths).toEqual({ 1: 200 });
    });

    it("deleteMindMap removes the file and leaves other maps", async () => {
      seed("x");
      seed("y");

      await deleteMindMap("x");

      expect(vault.read(rel("x"))).toBeNull();
      expect(vault.read(rel("y"))).not.toBeNull();
    });

    it("saveMindMap on a missing map gives 404 and does not create a file", async () => {
      await expect(saveMindMap("missing", { title: "Z" })).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(vault.read(rel("missing"))).toBeNull();
    });

    it("deleteMindMap on a missing map gives 404 and leaves other maps", async () => {
      seed("y");

      await expect(deleteMindMap("missing")).rejects.toMatchObject({ statusCode: 404 });

      expect(vault.read(rel("y"))).not.toBeNull();
    });
  });
});
