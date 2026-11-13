// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  createUserTag,
  deleteUserTag,
  getUserTags,
  updateUserTag,
} from "@/contexts/bc_tags/repositories";
import { useTempVault } from "../../lib/nexus/repos/helpers";

const FILE = "Resources/tags.yaml";
const STORED = [
  {
    id: "tagA",
    tag: "Alpha",
    title: "Alfa",
    color: "#ff0000",
    created: "2026-03-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  { id: "tagB", tag: "Beta", title: "Beta title", created: "2026-03-01T10:00:00.000Z" },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("tags", STORED, GENERATED_BY_IMPORT));

describe("tags repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getUserTags()).toEqual([]);
  });

  it("maps a 0b file and sorts ascending by created", async () => {
    seed();
    expect(await getUserTags()).toEqual([
      { id: "tagB", tag: "Beta", title: "Beta title", created_at: "2026-03-01T10:00:00.000Z" },
      {
        id: "tagA",
        tag: "Alpha",
        title: "Alfa",
        color: "#ff0000",
        created_at: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  it("breaks ties and missing dates by id", async () => {
    vault.write(
      FILE,
      formatYamlList("tags", [
        { id: "b", tag: "b", title: "b" },
        { id: "a", tag: "a", title: "a" },
      ])
    );
    expect((await getUserTags()).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("creates a normalized tag, creating the file when missing", async () => {
    const tag = await createUserTag({ tag: " #Gamma ", title: " Gamma title ", color: "  " });
    expect(tag.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(tag).toMatchObject({ tag: "Gamma", title: "Gamma title" });
    expect(tag.color).toBeUndefined();
    expect(new Date(tag.created_at!).toISOString()).toBe(tag.created_at);
    const [stored] = readList(FILE, "tags");
    expect(Object.keys(stored)).toEqual(["id", "tag", "title", "created"]);
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("appends to existing records without losing them", async () => {
    seed();
    const tag = await createUserTag({ tag: "Gamma", title: "G", color: " #00ff00 " });
    const stored = readList(FILE, "tags");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ id: tag.id, color: "#00ff00" });
  });

  it("updates only the passed fields and keeps unknown keys and order", async () => {
    seed();
    await updateUserTag("tagA", { title: " Nowy " });
    expect(readList(FILE, "tags")).toEqual([{ ...STORED[0], title: "Nowy" }, STORED[1]]);
  });

  it("normalizes the tag on update", async () => {
    seed();
    await updateUserTag("tagB", { tag: "#Nowy" });
    expect(readList(FILE, "tags")[1]).toMatchObject({ tag: "Nowy" });
  });

  it("removes the color key instead of writing null", async () => {
    seed();
    await updateUserTag("tagA", { color: null });
    expect(readList(FILE, "tags")[0]).toEqual({
      id: "tagA",
      tag: "Alpha",
      title: "Alfa",
      created: "2026-03-02T10:00:00.000Z",
      x_note: "ręcznie",
    });
    expect(vault.read(FILE)).not.toContain("color: null");
  });

  it("rewriting with unchanged values differs from the original only by generated_by", async () => {
    seed();
    const before = vault.read(FILE)!;
    await updateUserTag("tagB", { title: "Beta title" });
    expect(vault.read(FILE)).toBe(before.replace("generated_by: import-to-vault\n", ""));
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateUserTag("nope", { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("update with no fields does no I/O", async () => {
    await expect(updateUserTag("nope", {})).resolves.toBeUndefined();
    expect(vault.read(FILE)).toBeNull();
  });

  it("deletes a tag; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteUserTag("tagA");
    expect(readList(FILE, "tags").map((r) => r.id)).toEqual(["tagB"]);
    const before = vault.read(FILE);
    await deleteUserTag("nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters and YAML 1.1 words", async () => {
    const title = 'Tom & Jerry: "cytat" #hash — zażółć gęślą jaźń &apos;';
    const tag = await createUserTag({ tag: "no", title });
    expect(await getUserTags()).toEqual([
      expect.objectContaining({ id: tag.id, tag: "no", title }),
    ]);
  });
});
