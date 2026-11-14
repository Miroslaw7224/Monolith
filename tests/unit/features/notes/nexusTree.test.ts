import { describe, expect, it } from "vitest";
import { collectNexusTags, filterNexusDocs, groupNexusDocs } from "@/src/features/notes/nexusTree";

const doc = (path: string, title: string, tags: string[] = []) => {
  const parts = path.split("/");
  return {
    path,
    area: parts[0] as "Knowledge" | "Projects",
    group: parts[0] === "Projects" ? parts[1] : parts.length > 2 ? parts[1] : "",
    title,
    tags,
  };
};

const docs = [
  doc("Knowledge/alembic.md", "Alembic", ["db", "migracje"]),
  doc("Knowledge/ai-security/foo.md", "Foo", ["db"]),
  doc("Projects/p/decyzja.md", "Decyzja", ["adr"]),
];

describe("filterNexusDocs", () => {
  it("po tytule i ścieżce, bez rozróżniania wielkości liter", () => {
    expect(filterNexusDocs(docs, "ALEM", null).map((d) => d.title)).toEqual(["Alembic"]);
    expect(filterNexusDocs(docs, "ai-security", null).map((d) => d.title)).toEqual(["Foo"]);
  });
  it("po tagu, także w połączeniu z tekstem", () => {
    expect(filterNexusDocs(docs, "", "db").map((d) => d.title)).toEqual(["Alembic", "Foo"]);
    expect(filterNexusDocs(docs, "foo", "db").map((d) => d.title)).toEqual(["Foo"]);
    expect(filterNexusDocs(docs, "", "brak")).toEqual([]);
  });
  it("puste zapytanie i brak tagu zwracają wszystko", () => {
    expect(filterNexusDocs(docs, "  ", null)).toHaveLength(3);
  });
});

describe("groupNexusDocs", () => {
  it("grupuje po obszarze i grupie, zachowując kolejność wejścia", () => {
    expect(groupNexusDocs(docs).map((f) => [f.label, f.docs.length])).toEqual([
      ["Knowledge/", 1],
      ["Knowledge/ai-security/", 1],
      ["Projects/p/", 1],
    ]);
  });
});

describe("collectNexusTags", () => {
  it("najpopularniejsze najpierw, remis alfabetycznie, z limitem", () => {
    expect(collectNexusTags(docs)).toEqual(["db", "adr", "migracje"]);
    expect(collectNexusTags(docs, 2)).toEqual(["db", "adr"]);
  });
});
