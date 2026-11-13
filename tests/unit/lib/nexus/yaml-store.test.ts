// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import { VaultConfigError } from "@/lib/nexus/vault-path";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList, updateList } from "@/lib/nexus/yaml-store";
import { useTempVault } from "../../helpers/tempVault";

const REL = "Resources/tags.yaml";
const vault = useTempVault();

describe("readList", () => {
  it("returns [] for a missing, empty and whitespace-only file", () => {
    expect(readList(REL, "tags")).toEqual([]);
    vault.write(REL, "");
    expect(readList(REL, "tags")).toEqual([]);
    vault.write(REL, "  \n\n");
    expect(readList(REL, "tags")).toEqual([]);
  });

  it("reads items from a file in the 0b format", () => {
    vault.write(REL, formatYamlList("tags", [{ id: "a", tag: "x" }], "import-to-vault"));
    expect(readList(REL, "tags")).toEqual([{ id: "a", tag: "x" }]);
  });

  it("names the file in the error for broken YAML", () => {
    vault.write(REL, "tags: [unclosed\n");
    expect(() => readList(REL, "tags")).toThrow(REL);
  });

  it("throws VaultConfigError when NEXUS_VAULT_PATH is unset", () => {
    delete process.env.NEXUS_VAULT_PATH;
    expect(() => readList(REL, "tags")).toThrow(VaultConfigError);
  });
});

describe("updateList", () => {
  it("creates the file with version 1 and without generated_by", async () => {
    expect(await updateList(REL, "tags", () => [{ id: "a" }])).toBe(true);
    const text = vault.read(REL)!;
    expect(text).toMatch(/^version: 1\n/);
    expect(text).not.toContain("generated_by");
    expect(readList(REL, "tags")).toEqual([{ id: "a" }]);
  });

  it("hands fn an empty list for a missing file", async () => {
    let seen: unknown;
    await updateList(REL, "tags", (items) => {
      seen = items;
      return items;
    });
    expect(seen).toEqual([]);
  });

  it("drops generated_by but keeps unknown keys and record order", async () => {
    const items = [{ id: "b", x_note: "ręcznie" }, { id: "a" }];
    vault.write(REL, formatYamlList("tags", items, "import-to-vault"));
    await updateList(REL, "tags", (list) => [...list, { id: "c" }]);
    expect(vault.read(REL)).toBe(formatYamlList("tags", [...items, { id: "c" }]));
  });

  it("does not create a file when fn returns null on a missing file", async () => {
    expect(await updateList(REL, "tags", () => null)).toBe(false);
    expect(vault.read(REL)).toBeNull();
  });

  it("leaves an existing file byte-identical when fn returns null", async () => {
    const text = formatYamlList("tags", [{ id: "a" }], "import-to-vault");
    vault.write(REL, text);
    expect(await updateList(REL, "tags", () => null)).toBe(false);
    expect(vault.read(REL)).toBe(text);
  });

  it("never overwrites an unparsable file", async () => {
    vault.write(REL, "tags: [unclosed\n");
    await expect(updateList(REL, "tags", () => [{ id: "a" }])).rejects.toThrow(REL);
    expect(vault.read(REL)).toBe("tags: [unclosed\n");
  });

  it("re-applies fn to fresh content after an external change", async () => {
    let calls = 0;
    await updateList(REL, "tags", (list) => {
      calls += 1;
      if (calls === 1) vault.write(REL, formatYamlList("tags", [{ id: "ext" }]));
      return [...list, { id: "new" }];
    });
    expect(calls).toBe(2);
    expect(readList(REL, "tags").map((r) => r.id)).toEqual(["ext", "new"]);
  });

  it("throws ConflictError when retries are exhausted", async () => {
    let calls = 0;
    await expect(
      updateList(
        REL,
        "tags",
        (list) => {
          calls += 1;
          vault.write(REL, `version: 1\ntags: []\n# zmiana ${calls}\n`);
          return [...list, { id: "x" }];
        },
        { retries: 1 }
      )
    ).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toBe(2);
  });

  it("rejects with VaultConfigError when NEXUS_VAULT_PATH is unset", async () => {
    delete process.env.NEXUS_VAULT_PATH;
    await expect(updateList(REL, "tags", () => [])).rejects.toThrow(VaultConfigError);
  });
});
