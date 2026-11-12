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
} from "@/lib/nexus/repos/mindMaps";
import type { MindMapNode } from "@/types/records";
import { useTempVault } from "./helpers";

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
  it("creates MindMaps/<id>.json without storing userId", async () => {
    at(T1);
    const map = await createMindMap("u1", { title: "Mapa", rootNode: ROOT });
    expect(map).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9]{20}$/),
      userId: "u1",
      title: "Mapa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T1,
    });
    const text = vault.read(`MindMaps/${map.id}.json`)!;
    expect(text.endsWith("\n")).toBe(true);
    expect(text).not.toContain("u1");
    expect(text).not.toContain("userId");
    expect(JSON.parse(text)).toEqual({
      title: "Mapa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T1,
    });
  });

  it("reads maps with the userId from the argument and returns [] without a directory", async () => {
    expect(await getMindMaps("u")).toEqual([]);
    const { id } = await createMindMap("u1", { title: "A", rootNode: ROOT });
    expect((await getMindMap("u2", id))?.userId).toBe("u2");
    expect(await getMindMaps("u2")).toMatchObject([{ id, userId: "u2" }]);
  });

  it("saves a partial patch and bumps updatedAt only", async () => {
    at(T1);
    const { id } = await createMindMap("u", { title: "Stara", rootNode: ROOT });
    at(T2);
    await saveMindMap("u", id, { title: "Nowa" });
    expect(await getMindMap("u", id)).toMatchObject({
      title: "Nowa",
      rootNode: ROOT,
      colWidths: {},
      createdAt: T1,
      updatedAt: T2,
    });
  });

  it("saves colWidths and rootNode", async () => {
    const { id } = await createMindMap("u", { title: "A", rootNode: ROOT });
    const root2: MindMapNode = { ...ROOT, label: "Inna", children: [{ ...ROOT, id: "c1" }] };
    await saveMindMap("u", id, { colWidths: { 0: 200, 1: 150 } });
    await saveMindMap("u", id, { rootNode: root2 });
    const map = await getMindMap("u", id);
    expect(map?.colWidths).toEqual({ 0: 200, 1: 150 });
    expect(map?.rootNode).toEqual(root2);
  });

  it("rejects an unknown id: save 404, get null, delete no-op", async () => {
    const error = await saveMindMap("u", "nope", { title: "x" }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(404);
    expect(await getMindMap("u", "nope")).toBeNull();
    await expect(deleteMindMap("u", "nope")).resolves.toBeUndefined();
  });

  it.each(["../x", "a\\b", "", "a/b", "a.b", "x".repeat(65)])(
    "treats the unsafe id %j as unknown and writes nothing",
    async (id) => {
      expect(await getMindMap("u", id)).toBeNull();
      await expect(saveMindMap("u", id, { title: "x" })).rejects.toMatchObject({ statusCode: 404 });
      await expect(deleteMindMap("u", id)).resolves.toBeUndefined();
      expect(fs.existsSync(path.join(vault.root, "MindMaps"))).toBe(false);
    }
  );

  it("skips a corrupt file in the list but fails loudly on a direct read", async () => {
    const { id } = await createMindMap("u", { title: "Dobra", rootNode: ROOT });
    vault.write("MindMaps/bad.json", "{");
    expect((await getMindMaps("u")).map((m) => m.id)).toEqual([id]);
    await expect(getMindMap("u", "bad")).rejects.toThrow(/MindMaps\/bad\.json/);
  });

  it("deletes the file", async () => {
    const { id } = await createMindMap("u", { title: "A", rootNode: ROOT });
    await deleteMindMap("u", id);
    expect(vault.read(`MindMaps/${id}.json`)).toBeNull();
    await expect(deleteMindMap("u", id)).resolves.toBeUndefined();
  });

  it("creates distinct files for parallel creates", async () => {
    const [a, b] = await Promise.all([
      createMindMap("u", { title: "A", rootNode: ROOT }),
      createMindMap("u", { title: "B", rootNode: ROOT }),
    ]);
    expect(a.id).not.toBe(b.id);
    expect(await getMindMaps("u")).toHaveLength(2);
  });
});
