// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listVaultFilesRecursive } from "@/lib/nexus/vault-fs";
import { useTempVault } from "../../helpers/tempVault";

describe("listVaultFilesRecursive", () => {
  const vault = useTempVault();

  it("schodzi do podfolderów i zwraca tylko .md, posortowane, względem korzenia vaulta", () => {
    vault.write("Knowledge/b.md", "b");
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/c.md", "c");
    vault.write("Knowledge/sub/deep/d.md", "d");
    vault.write("Knowledge/sub/note.txt", "nie md");
    expect(listVaultFilesRecursive("Knowledge")).toEqual([
      "Knowledge/a.md",
      "Knowledge/b.md",
      "Knowledge/sub/c.md",
      "Knowledge/sub/deep/d.md",
    ]);
  });

  it("pomija katalog Work (także zagnieżdżony i w innej wielkości liter) bez rzucania wyjątku", () => {
    vault.write("Projects/p/index.md", "i");
    vault.write("Projects/Work/secret.md", "s");
    vault.write("Projects/p/work/secret2.md", "s");
    expect(listVaultFilesRecursive("Projects")).toEqual(["Projects/p/index.md"]);
  });

  it("pomija dowiązania do plików i katalogów", () => {
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/b.md", "b");
    fs.symlinkSync(
      path.join(vault.root, "Knowledge/a.md"),
      path.join(vault.root, "Knowledge/link.md")
    );
    fs.symlinkSync(
      path.join(vault.root, "Knowledge/sub"),
      path.join(vault.root, "Knowledge/linkdir")
    );
    expect(listVaultFilesRecursive("Knowledge")).toEqual(["Knowledge/a.md", "Knowledge/sub/b.md"]);
  });

  it("brak katalogu daje []", () => {
    expect(listVaultFilesRecursive("Nie-ma")).toEqual([]);
  });
});
