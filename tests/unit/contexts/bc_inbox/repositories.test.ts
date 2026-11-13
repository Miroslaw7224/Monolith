// @vitest-environment node
import { describe, expect, it } from "vitest";
import { appendItem, readOpenItems, resolveItem } from "@/contexts/bc_inbox/repositories";
import { useTempVault } from "../../helpers/tempVault";

const REL = "Inbox/inbox.md";
const vault = useTempVault();

describe("readOpenItems", () => {
  it("brak pliku to pusta lista", () => {
    expect(readOpenItems()).toEqual([]);
  });

  it("czyta otwarte wpisy w kolejności pliku, pomija posegregowane i linie spoza listy", () => {
    vault.write(
      REL,
      [
        "# Inbox",
        "",
        "- [ ] Artykuł o vitest [type:: link] [at:: 2026-11-13T09:10]",
        "- [x] Stare [type:: myśl] [at:: 2026-11-12T08:00]",
        "- [ ] arr[0] jest dziwne [type:: bug] [at:: 2026-11-13T10:00]",
        "zwykły akapit",
        "- [ ] Ręcznie dopisane",
        "",
      ].join("\n")
    );
    const items = readOpenItems();
    expect(items.map((i) => [i.text, i.type, i.at])).toEqual([
      ["Artykuł o vitest", "link", "2026-11-13T09:10"],
      ["arr[0] jest dziwne", "bug", "2026-11-13T10:00"],
      ["Ręcznie dopisane", "myśl", null],
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("identyczne linie dostają różne, stabilne id", () => {
    vault.write(REL, "- [ ] to samo\n- [ ] to samo\n");
    const a = readOpenItems();
    const b = readOpenItems();
    expect(a[0].id).not.toBe(a[1].id);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it("nieznany typ w polu to myśl", () => {
    vault.write(REL, "- [ ] x [type:: dziwny] [at:: 2026-11-13T09:10]\n");
    expect(readOpenItems()[0].type).toBe("myśl");
  });
});

describe("appendItem", () => {
  it("tworzy plik i dopisuje linię w formacie z polami", async () => {
    await appendItem({ text: "Pierwszy", type: "myśl", at: "2026-11-13T09:10" });
    expect(vault.read(REL)).toBe("- [ ] Pierwszy [type:: myśl] [at:: 2026-11-13T09:10]\n");
  });

  it("dopisuje na końcu istniejącej treści (także bez końcowego newline), nic nie ruszając", async () => {
    vault.write(REL, "# Inbox\n\nnotatka ręczna");
    await appendItem({ text: "Drugi", type: "link", at: "2026-11-13T09:11" });
    expect(vault.read(REL)).toBe(
      "# Inbox\n\nnotatka ręczna\n- [ ] Drugi [type:: link] [at:: 2026-11-13T09:11]\n"
    );
  });
});

describe("resolveItem", () => {
  it("zmienia tylko znacznik wskazanej linii i zwraca true", async () => {
    vault.write(REL, "# Inbox\n- [ ] A [type:: myśl] [at:: t1]\n- [ ] B [type:: myśl] [at:: t2]\n");
    const [a] = readOpenItems();
    expect(await resolveItem(a.id)).toBe(true);
    expect(vault.read(REL)).toBe(
      "# Inbox\n- [x] A [type:: myśl] [at:: t1]\n- [ ] B [type:: myśl] [at:: t2]\n"
    );
    expect(readOpenItems().map((i) => i.text)).toEqual(["B"]);
  });

  it("nieznane id i brak pliku to false, plik bez zmian", async () => {
    expect(await resolveItem("nie-ma")).toBe(false);
    vault.write(REL, "- [ ] A\n");
    expect(await resolveItem("nie-ma")).toBe(false);
    expect(vault.read(REL)).toBe("- [ ] A\n");
  });

  it("z dwóch identycznych linii zamyka tę wskazaną id", async () => {
    vault.write(REL, "- [ ] to samo\n- [ ] to samo\n");
    const [, second] = readOpenItems();
    await resolveItem(second.id);
    expect(vault.read(REL)).toBe("- [ ] to samo\n- [x] to samo\n");
  });
});
