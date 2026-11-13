// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  appendItem,
  countClosedItems,
  readOpenItems,
  removeClosedItems,
  removeItem,
  resolveItem,
} from "@/contexts/bc_inbox/repositories";
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

  it("id jest skrótem linii: stabilne, a identyczne linie mają to samo id (nie przesuwa się po zamknięciu sąsiada)", async () => {
    vault.write(REL, "- [ ] to samo\n- [ ] to samo\n- [ ] inne\n");
    const a = readOpenItems();
    expect(a.map((i) => i.id)).toEqual(readOpenItems().map((i) => i.id));
    expect(a[0].id).toBe(a[1].id);
    expect(a[2].id).not.toBe(a[0].id);
    const staleId = a[1].id;
    await resolveItem(a[0].id);
    // „stare” id drugiego duplikatu nadal działa (nie 404)
    expect(readOpenItems().map((i) => i.id)).toContain(staleId);
    expect(await resolveItem(staleId)).toBe(true);
    expect(readOpenItems().map((i) => i.text)).toEqual(["inne"]);
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

  it("zwraca wpis z id równym id odczytanym z pliku (można go od razu zamknąć)", async () => {
    const item = await appendItem({ text: "Nowy", type: "bug", at: "2026-11-13T09:10" });
    expect(item).toEqual({ ...readOpenItems()[0], id: item.id });
    expect(item.id).not.toBe("");
    expect(await resolveItem(item.id)).toBe(true);
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

  it("z dwóch identycznych linii zamyka pierwszą otwartą", async () => {
    vault.write(REL, "- [ ] to samo\n- [ ] to samo\n");
    const [first] = readOpenItems();
    await resolveItem(first.id);
    expect(vault.read(REL)).toBe("- [x] to samo\n- [ ] to samo\n");
  });
});

describe("removeItem", () => {
  it("usuwa tylko wskazaną linię; reszta pliku (nagłówek, zamknięte, akapity) bez zmian", async () => {
    vault.write(
      REL,
      "# Inbox\n- [x] Stare [type:: myśl] [at:: t0]\n- [ ] A [type:: myśl] [at:: t1]\n\nakapit\n- [ ] B [type:: bug] [at:: t2]\n"
    );
    const [a] = readOpenItems();
    expect(await removeItem(a.id)).toBe(true);
    expect(vault.read(REL)).toBe(
      "# Inbox\n- [x] Stare [type:: myśl] [at:: t0]\n\nakapit\n- [ ] B [type:: bug] [at:: t2]\n"
    );
    expect(readOpenItems().map((i) => i.text)).toEqual(["B"]);
  });

  it("z identycznych linii usuwa pierwszą otwartą", async () => {
    vault.write(REL, "- [ ] to samo\n- [ ] to samo\n- [ ] inne\n");
    await removeItem(readOpenItems()[0].id);
    expect(vault.read(REL)).toBe("- [ ] to samo\n- [ ] inne\n");
  });

  it("nieznane id, zamknięty wpis i brak pliku to false, plik bez zmian", async () => {
    expect(await removeItem("nie-ma")).toBe(false);
    vault.write(REL, "- [x] zamknięty [type:: myśl] [at:: t]\n- [ ] A\n");
    expect(await removeItem("nie-ma")).toBe(false);
    expect(vault.read(REL)).toBe("- [x] zamknięty [type:: myśl] [at:: t]\n- [ ] A\n");
  });
});

describe("countClosedItems / removeClosedItems", () => {
  const FILE =
    "# Inbox\n- [x] Stare [type:: myśl] [at:: t0]\n- [ ] A [type:: myśl] [at:: t1]\n\nakapit\n- [X] Duże X\n- [ ] B [type:: bug] [at:: t2]\n";

  it("liczy zamknięte linie ([x] i [X]); brak pliku to 0", () => {
    expect(countClosedItems()).toBe(0);
    vault.write(REL, FILE);
    expect(countClosedItems()).toBe(2);
  });

  it("usuwa tylko zamknięte linie i zwraca ich liczbę; reszta pliku bez zmian", async () => {
    vault.write(REL, FILE);
    expect(await removeClosedItems()).toBe(2);
    expect(vault.read(REL)).toBe(
      "# Inbox\n- [ ] A [type:: myśl] [at:: t1]\n\nakapit\n- [ ] B [type:: bug] [at:: t2]\n"
    );
    expect(readOpenItems().map((i) => i.text)).toEqual(["A", "B"]);
  });

  it("brak zamkniętych albo brak pliku: 0 i plik bez zmian", async () => {
    expect(await removeClosedItems()).toBe(0);
    vault.write(REL, "- [ ] A\n");
    expect(await removeClosedItems()).toBe(0);
    expect(vault.read(REL)).toBe("- [ ] A\n");
  });
});
