// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  createMindMap,
  deleteMindMap,
  getMindMap,
  getMindMaps,
  saveMindMap,
} from "@/contexts/bc_mind_maps/repositories";
import type { MindMapNode } from "@/contexts/bc_mind_maps/models";
import { useTempVault } from "../../lib/nexus/repos/helpers";

const T1 = "2026-11-12T10:00:00.000Z";
const T2 = "2026-11-12T11:00:00.000Z";
const ROOT: MindMapNode = { id: "root", label: "Mapa", note: "", collapsed: false, children: [] };

const vault = useTempVault();
afterEach(() => vi.useRealTimers());
const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe("mind map repository", () => {
  it("creates MindMaps/<id>.json without an owner key", async () => {
    at(T1);
    const map = await createMindMap({ title: "Mapa", rootNode: ROOT });
    expect(map).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9]{20}$/),
      title: "Mapa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T1,
    });
    const text = vault.read(`MindMaps/${map.id}.json`)!;
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({
      title: "Mapa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T1,
    });
  });

  it("reads maps and returns [] without a directory", async () => {
    expect(await getMindMaps()).toEqual([]);
    const { id } = await createMindMap({ title: "A", rootNode: ROOT });
    expect((await getMindMap(id))?.id).toBe(id);
    expect(await getMindMaps()).toMatchObject([{ id }]);
  });

  it("saves a partial patch and bumps updatedAt only", async () => {
    at(T1);
    const { id } = await createMindMap({ title: "Stara", rootNode: ROOT });
    at(T2);
    await saveMindMap(id, { title: "Nowa" });
    expect(await getMindMap(id)).toMatchObject({
      title: "Nowa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T2,
    });
  });

  it("saves colWidths and rootNode", async () => {
    const { id } = await createMindMap({ title: "A", rootNode: ROOT });
    const root2: MindMapNode = { ...ROOT, label: "Inna", children: [{ ...ROOT, id: "c1" }] };
    await saveMindMap(id, { colWidths: { 0: 200, 1: 150 } });
    await saveMindMap(id, { rootNode: root2 });
    const map = await getMindMap(id);
    expect(map?.colWidths).toEqual({ 0: 200, 1: 150 });
    expect(map?.rootNode).toEqual(root2);
  });

  it("rejects an unknown id: save 404, get null, delete no-op", async () => {
    const error = await saveMindMap("nope", { title: "x" }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(404);
    expect(await getMindMap("nope")).toBeNull();
    await expect(deleteMindMap("nope")).resolves.toBeUndefined();
  });

  it.each(["../x", "a\\b", "", "a/b", "a.b", "x".repeat(65)])(
    "treats the unsafe id %j as unknown and writes nothing",
    async (id) => {
      expect(await getMindMap(id)).toBeNull();
      await expect(saveMindMap(id, { title: "x" })).rejects.toMatchObject({ statusCode: 404 });
      await expect(deleteMindMap(id)).resolves.toBeUndefined();
      expect(fs.existsSync(path.join(vault.root, "MindMaps"))).toBe(false);
    }
  );

  it("skips a corrupt file in the list but fails loudly on a direct read", async () => {
    const { id } = await createMindMap({ title: "Dobra", rootNode: ROOT });
    vault.write("MindMaps/bad.json", "{");
    expect((await getMindMaps()).map((m) => m.id)).toEqual([id]);
    await expect(getMindMap("bad")).rejects.toThrow(/MindMaps\/bad\.json/);
  });

  it("deletes the file", async () => {
    const { id } = await createMindMap({ title: "A", rootNode: ROOT });
    await deleteMindMap(id);
    expect(vault.read(`MindMaps/${id}.json`)).toBeNull();
    await expect(deleteMindMap(id)).resolves.toBeUndefined();
  });

  it("creates distinct files for parallel creates", async () => {
    const [a, b] = await Promise.all([
      createMindMap({ title: "A", rootNode: ROOT }),
      createMindMap({ title: "B", rootNode: ROOT }),
    ]);
    expect(a.id).not.toBe(b.id);
    expect(await getMindMaps()).toHaveLength(2);
  });
});
