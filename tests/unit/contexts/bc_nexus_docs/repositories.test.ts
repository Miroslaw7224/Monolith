// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listNexusPaths, readNexusDoc } from "@/contexts/bc_nexus_docs/repositories";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();

describe("listNexusPaths", () => {
  it("zwraca pliki .md z Knowledge i Projects, bez Notes, Work i dowiązań", () => {
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/b.md", "b");
    vault.write("Knowledge/readme.txt", "x");
    vault.write("Projects/p/c.md", "c");
    vault.write("Notes/n.md", "n");
    vault.write("Work/secret.md", "s");
    vault.write("Knowledge/work/hidden.md", "h");
    fs.symlinkSync(path.join(vault.root, "Notes/n.md"), path.join(vault.root, "Knowledge/link.md"));
    expect(listNexusPaths()).toEqual(["Knowledge/a.md", "Knowledge/sub/b.md", "Projects/p/c.md"]);
  });

  it("brak katalogów daje pustą listę", () => {
    expect(listNexusPaths()).toEqual([]);
  });
});

describe("readNexusDoc", () => {
  it("parsuje frontmatter i zwraca treść bez niego", () => {
    vault.write("Knowledge/a.md", "---\ntitle: A\ntags: [x, y]\n---\nTreść\n");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({ title: "A", tags: ["x", "y"] });
    expect(raw?.body).toBe("Treść\n");
    expect(raw?.path).toBe("Knowledge/a.md");
    expect(raw?.bytes).toBeGreaterThan(0);
  });

  it("plik bez frontmattera: pusty meta, cała treść w body", () => {
    vault.write("Knowledge/a.md", "# Tytuł\ntekst");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({});
    expect(raw?.body).toBe("# Tytuł\ntekst");
  });

  it("błędny YAML traktuje jak brak frontmattera", () => {
    vault.write("Knowledge/a.md", "---\na: [unclosed\n---\ntreść");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({});
    expect(raw?.body).toBe("---\na: [unclosed\n---\ntreść");
  });

  it("bytes liczy bajty UTF-8", () => {
    vault.write("Knowledge/a.md", "żółć");
    expect(readNexusDoc("Knowledge/a.md")?.bytes).toBe(Buffer.byteLength("żółć", "utf8"));
  });

  it("brak pliku daje null", () => {
    expect(readNexusDoc("Knowledge/nie-ma.md")).toBeNull();
  });

  it("niepoprawny UTF-8 daje null zamiast wyjątku", () => {
    vault.write("Knowledge/x.md", "x");
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    expect(readNexusDoc("Knowledge/bad.md")).toBeNull();
  });
});
