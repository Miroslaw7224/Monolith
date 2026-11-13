// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT, parseYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  addResource,
  deleteResource,
  getResources,
  updateResource,
} from "@/contexts/bc_resources/repositories";
import { useTempVault } from "../../helpers/tempVault";

const FILE = "Resources/resources.yaml";
const STORED = [
  {
    id: "resA",
    title: "Strona A",
    url: "https://a.example.com",
    description: "Opis A",
    tags: ["Backend", "Cloud"],
    favorite: true,
    thumbnail_url: "https://a.example.com/t.png",
    note_id: "note-1",
    created: "2026-03-01T10:00:00.000Z",
    updated: "2026-03-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  {
    id: "resB",
    title: "Strona B",
    url: "https://b.example.com",
    description: "Opis B",
    tags: [],
    favorite: false,
    created: "2026-03-05T10:00:00.000Z",
    updated: "2026-03-05T10:00:00.000Z",
  },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("resources", STORED, GENERATED_BY_IMPORT));

describe("resources repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getResources()).toEqual([]);
  });

  it("maps a 0b file and sorts descending by createdAt", async () => {
    seed();
    expect(await getResources()).toEqual([
      {
        id: "resB",
        title: "Strona B",
        url: "https://b.example.com",
        description: "Opis B",
        tags: [],
        isFavorite: false,
        createdAt: "2026-03-05T10:00:00.000Z",
        updatedAt: "2026-03-05T10:00:00.000Z",
      },
      {
        id: "resA",
        noteId: "note-1",
        title: "Strona A",
        url: "https://a.example.com",
        description: "Opis A",
        thumbnailUrl: "https://a.example.com/t.png",
        tags: ["Backend", "Cloud"],
        isFavorite: true,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  it("breaks ties by id ascending", async () => {
    vault.write(
      FILE,
      formatYamlList("resources", [
        { id: "b", title: "b", url: "u", description: "d", tags: [], favorite: false },
        { id: "a", title: "a", url: "u", description: "d", tags: [], favorite: false },
      ])
    );
    expect((await getResources()).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("creates a resource with defaults and the 0b key order", async () => {
    const res = await addResource({
      title: "Nowa",
      url: "https://n.example.com",
      description: "Opis",
      tags: [],
      thumbnailUrl: "https://n.example.com/t.png",
    });
    expect(res.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(res).toMatchObject({ isFavorite: false, tags: [] });
    expect(res.noteId).toBeUndefined();
    expect(res.createdAt).toBe(res.updatedAt);
    expect(new Date(res.createdAt!).toISOString()).toBe(res.createdAt);
    const [stored] = readList(FILE, "resources");
    expect(Object.keys(stored)).toEqual([
      "id",
      "title",
      "url",
      "description",
      "tags",
      "favorite",
      "thumbnail_url",
      "created",
      "updated",
    ]);
    expect(vault.read(FILE)).toContain("favorite: false");
    expect(vault.read(FILE)).toContain("tags: []");
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("stores note_id only when given and appends after existing records", async () => {
    seed();
    const res = await addResource({
      title: "T",
      url: "u",
      description: "d",
      tags: ["x"],
      isFavorite: true,
      noteId: "note-9",
    });
    const stored = readList(FILE, "resources");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ id: res.id, note_id: "note-9", favorite: true });
    expect(stored[2]).not.toHaveProperty("thumbnail_url");
  });

  it("updates only the passed fields, trims text and bumps updated", async () => {
    seed();
    await updateResource("resA", { title: " Nowy tytuł ", isFavorite: false });
    const [a, b] = readList(FILE, "resources");
    expect(a).toMatchObject({
      ...STORED[0],
      title: "Nowy tytuł",
      favorite: false,
      updated: expect.any(String),
    });
    expect(a.updated).not.toBe(STORED[0].updated);
    expect(Number.isNaN(Date.parse(String(a.updated)))).toBe(false);
    expect(a.created).toBe(STORED[0].created);
    expect(b).toEqual(STORED[1]);
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateResource("nope", { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("deletes a resource; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteResource("resA");
    expect(readList(FILE, "resources").map((r) => r.id)).toEqual(["resB"]);
    const before = vault.read(FILE);
    await deleteResource("nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters and YAML 1.1 words as text", async () => {
    const title = 'Google&apos;s: "app" #1 — zażółć gęślą jaźń';
    const tags = ["yes", "no", "on", "off", "123"];
    const res = await addResource({
      title,
      url: "https://x.dev",
      description: "yes",
      tags,
    });
    const [read] = await getResources();
    expect(read).toMatchObject({ id: res.id, title, description: "yes", tags });
    expect(vault.read(FILE)).not.toMatch(/- yes\n/);
  });

  it("reads a hand-written unquoted favorite: yes as text, not as true", async () => {
    vault.write(
      FILE,
      "version: 1\nresources:\n  - id: h1\n    title: t\n    url: u\n    description: d\n    tags: []\n    favorite: yes\n"
    );
    expect((await getResources())[0].isFavorite).toBe(false);
    await updateResource("h1", { title: "t2" });
    const item = parseYamlList(vault.read(FILE)!, "resources").items[0];
    expect(item.favorite).toBe("yes");
  });
});
