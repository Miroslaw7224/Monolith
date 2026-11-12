// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument, deleteDocument, getDocuments } from "@/lib/nexus/repos/documents";
import { useTempVault } from "./helpers";

const vault = useTempVault();
afterEach(() => vi.useRealTimers());

describe("documents repository", () => {
  it("returns [] when Documents/ does not exist", async () => {
    expect(await getDocuments("u")).toEqual([]);
  });

  it("creates Documents/<slug>.md and reads the document back", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
    const created = await createDocument("u", {
      name: "raport.txt",
      content: "A\n\nB",
      type: "text/plain",
    });
    expect(created).toEqual({ id: expect.stringMatching(/^[A-Za-z0-9]{20}$/), name: "raport.txt" });
    expect(vault.read("Documents/raport-txt.md")).not.toBeNull();
    expect(await getDocuments("u")).toEqual([
      {
        id: created.id,
        name: "raport.txt",
        content: "A\n\nB",
        type: "text/plain",
        created_at: "2026-11-12T10:00:00.000Z",
      },
    ]);
  });

  it("round-trips content with horizontal rules and headings, and an empty type", async () => {
    const content = "# H1\n\ntekst\n\n---\n\nkoniec";
    await createDocument("u", { name: "x", content, type: "" });
    expect(await getDocuments("u")).toMatchObject([{ content, type: "" }]);
  });

  it("suffixes colliding slugs", async () => {
    await createDocument("u", { name: "a.txt", content: "1", type: "t" });
    await createDocument("u", { name: "a-txt", content: "2", type: "t" });
    expect(vault.read("Documents/a-txt.md")).not.toBeNull();
    expect(vault.read("Documents/a-txt-2.md")).not.toBeNull();
  });

  it("sorts newest created first", async () => {
    vault.write(
      "Documents/old.md",
      "---\nid: o\nname: old\ncreated: 2026-01-01T00:00:00.000Z\n---\n\nx\n"
    );
    vault.write(
      "Documents/new.md",
      "---\nid: n\nname: new\ncreated: 2026-02-01T00:00:00.000Z\n---\n\nx\n"
    );
    expect((await getDocuments("u")).map((d) => d.id)).toEqual(["n", "o"]);
  });

  it("deletes a document and ignores an unknown id", async () => {
    const { id } = await createDocument("u", { name: "a", content: "1", type: "t" });
    await deleteDocument("u", id);
    expect(vault.read("Documents/a.md")).toBeNull();
    await expect(deleteDocument("u", id)).resolves.toBeUndefined();
  });
});
