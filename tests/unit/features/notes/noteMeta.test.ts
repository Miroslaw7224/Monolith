import { describe, expect, it } from "vitest";
import {
  collectPopularTags,
  computeNoteTiles,
  countWords,
  extractTags,
  joinFrontmatter,
  splitFrontmatter,
} from "@/src/features/notes/noteMeta";

const note = (id: string, created_at: string, content = "") => ({
  id,
  title: id,
  content,
  created_at,
});

describe("splitFrontmatter", () => {
  it("oddziela blok --- ... --- od treści", () => {
    const r = splitFrontmatter("---\ndata: 2026-11-10\nstatus: ok\n---\n# Tytuł\n\nTreść");
    expect(r.frontmatter).toEqual(["data: 2026-11-10", "status: ok"]);
    expect(r.body).toBe("# Tytuł\n\nTreść");
  });

  it("bez frontmattera zwraca treść bez zmian", () => {
    expect(splitFrontmatter("zwykła treść")).toEqual({ frontmatter: null, body: "zwykła treść" });
  });

  it("niedomknięty blok nie jest frontmatterem", () => {
    const text = "---\ndata: 2026-11-10\nbrak zamknięcia";
    expect(splitFrontmatter(text)).toEqual({ frontmatter: null, body: text });
  });

  it("obsługuje CRLF", () => {
    const r = splitFrontmatter("---\r\na: 1\r\n---\r\nciało");
    expect(r.frontmatter).toEqual(["a: 1"]);
    expect(r.body).toBe("ciało");
  });
});

describe("extractTags", () => {
  it("czyta listę w nawiasach z klucza tagi", () => {
    expect(extractTags(["tagi: [architektura, decyzje]"])).toEqual(["architektura", "decyzje"]);
  });

  it("czyta klucz tags, zdejmuje # i cudzysłowy", () => {
    expect(extractTags(["tags: [\"#a\", 'b']"])).toEqual(["a", "b"]);
  });

  it("czyta listę po przecinku bez nawiasów", () => {
    expect(extractTags(["tagi: a, b"])).toEqual(["a", "b"]);
  });

  it("brak klucza lub null daje pustą listę", () => {
    expect(extractTags(["status: ok"])).toEqual([]);
    expect(extractTags(null)).toEqual([]);
  });
});

describe("countWords", () => {
  it("liczy słowa rozdzielone białymi znakami", () => {
    expect(countWords("  jeden dwa\ntrzy  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("collectPopularTags", () => {
  it("sortuje malejąco po liczbie notatek, potem alfabetycznie, tnie do limitu", () => {
    const notes = [
      note("a", "", "---\ntagi: [x, y]\n---\n"),
      note("b", "", "---\ntagi: [y, z]\n---\n"),
      note("c", "", "---\ntagi: [y, x]\n---\n"),
    ];
    expect(collectPopularTags(notes, 2)).toEqual([
      { tag: "y", count: 3 },
      { tag: "x", count: 2 },
    ]);
  });

  it("nie liczy dwa razy tego samego tagu w jednej notatce", () => {
    const notes = [note("a", "", "---\ntagi: [x, x]\n---\n")];
    expect(collectPopularTags(notes)).toEqual([{ tag: "x", count: 1 }]);
  });
});

describe("computeNoteTiles", () => {
  const now = new Date(2026, 10, 14, 12, 0, 0);
  const today = new Date(2026, 10, 14, 9, 22, 0).toISOString();
  const earlier = new Date(2026, 10, 10, 17, 40, 0).toISOString();

  it("liczy notatki, dzisiejsze, a Inbox bierze z argumentu", () => {
    const tiles = computeNoteTiles([note("a", today), note("b", earlier)], now, 5);
    expect(tiles.map((t) => [t.id, t.value])).toEqual([
      ["notes", "2"],
      ["today", "1"],
      ["decisions", "—"],
      ["inbox", "5"],
    ]);
    expect(tiles[0].accent).toBe(true);
    expect(tiles[1].meta).toBe("ostatnia 09:22");
  });

  it("bez dzisiejszych pokazuje datę ostatniej notatki", () => {
    const tiles = computeNoteTiles([note("b", earlier)], now, null);
    expect(tiles[1].value).toBe("0");
    expect(tiles[1].meta).toBe("ostatnia 10.11");
    expect(tiles[3].value).toBe("—");
  });

  it("pusta baza nie wywraca kafli", () => {
    const tiles = computeNoteTiles([], now, 0);
    expect(tiles[0].value).toBe("0");
    expect(tiles[1].meta).toBe("brak notatek");
    expect(tiles[3].value).toBe("0");
  });

  it("ignoruje notatki bez poprawnej daty", () => {
    const tiles = computeNoteTiles([note("n", ""), note("x", "nie-data")], now, 1);
    expect(tiles[1].value).toBe("0");
    expect(tiles[1].meta).toBe("brak daty");
  });
});

describe("joinFrontmatter", () => {
  it("jest odwrotnością splitFrontmatter", () => {
    const text = "---\ntagi: [a]\nstatus: ok\n---\n# Tytuł";
    const { frontmatter, body } = splitFrontmatter(text);
    expect(joinFrontmatter(frontmatter, body)).toBe(text);
  });

  it("bez frontmattera zwraca samą treść", () => {
    expect(joinFrontmatter(null, "treść")).toBe("treść");
  });
});
