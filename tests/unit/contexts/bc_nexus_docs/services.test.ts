// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTempVault } from "../../helpers/tempVault";

const mockListProjects = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: mockListProjects,
  isWorkProject: (entry: { owner: string }) => entry.owner === "work",
}));

import { MAX_DOC_BYTES } from "@/contexts/bc_nexus_docs/models";
import * as services from "@/contexts/bc_nexus_docs/services";

const vault = useTempVault();

beforeEach(() => {
  mockListProjects.mockReset();
  mockListProjects.mockReturnValue({
    projects: [
      { id: "p", owner: "personal" },
      { id: "w", owner: "work" },
    ],
    warnings: [],
  });
});

const statusOf = (fn: () => unknown): number | undefined => {
  try {
    fn();
  } catch (err) {
    return (err as { statusCode?: number }).statusCode;
  }
  return undefined;
};

describe("parseDocPath (400)", () => {
  const bad: [string, string[]][] = [
    ["pusta", []],
    ["segment pusty (ścieżka absolutna)", ["", "etc", "passwd.md"]],
    ["kropka", ["Knowledge", ".", "a.md"]],
    ["..", ["Knowledge", "..", "a.md"]],
    ["Projects/id/../../Knowledge/x.md", ["Projects", "id", "..", "..", "Knowledge", "x.md"]],
    ["segment z /", ["Knowledge", "a/b.md"]],
    ["segment z \\", ["Knowledge", "a\\b.md"]],
    ["segment z \\0", ["Knowledge", "a\0.md"]],
    ["inny prefiks Notes", ["Notes", "x.md"]],
    ["Work jako prefiks", ["Work", "x.md"]],
    ["wielkość liter w prefiksie", ["knowledge", "x.md"]],
    ["bez .md", ["Knowledge", "x.txt"]],
    ["sam obszar", ["Knowledge"]],
  ];
  for (const [name, segments] of bad) {
    it(name, () => {
      expect(statusOf(() => services.parseDocPath(segments))).toBe(400);
    });
  }

  it("poprawna ścieżka jest łączona przez /", () => {
    expect(services.parseDocPath(["Knowledge", "ai-security", "foo.md"])).toBe(
      "Knowledge/ai-security/foo.md"
    );
    expect(services.parseDocPath(["Projects", "p", "decyzja.md"])).toBe("Projects/p/decyzja.md");
  });
});

describe("isVisiblePath", () => {
  const ids = new Set(["p"]);
  const cases: [string, boolean][] = [
    ["Knowledge/a.md", true],
    ["Knowledge/sub/deep/b.md", true],
    ["Knowledge/_index.md", false],
    ["Knowledge/sub/_tags.md", false],
    ["Knowledge/attachments/x.md", false],
    ["Knowledge/a.txt", false],
    ["Projects/p/decyzja.md", true],
    ["Projects/p/p.md", true],
    ["Projects/p/index.md", false],
    ["Projects/p/tasks.md", false],
    ["Projects/p/bugs.md", false],
    ["Projects/p/state.md", false],
    ["Projects/p/ai-context.md", false],
    ["Projects/p/devlog.md", false],
    ["Projects/p/_x.md", false],
    ["Projects/p/sub/x.md", false],
    ["Projects/loose.md", false],
    ["Projects/unknown/u.md", false],
    ["Notes/n.md", false],
  ];
  for (const [rel, expected] of cases) {
    it(`${rel} → ${expected}`, () => {
      expect(services.isVisiblePath(rel, ids)).toBe(expected);
    });
  }
});

describe("docGroup, docTitle, docTags, frontmatterLines", () => {
  it("group: podkatalog Knowledge, id projektu, pusty dla plików luzem", () => {
    expect(services.docGroup("Knowledge/a.md")).toBe("");
    expect(services.docGroup("Knowledge/ai-security/a.md")).toBe("ai-security");
    expect(services.docGroup("Knowledge/ai-security/deep/a.md")).toBe("ai-security");
    expect(services.docGroup("Projects/p/a.md")).toBe("p");
  });

  it("tytuł: title > name > pierwszy # > nazwa pliku", () => {
    expect(services.docTitle({ title: "T", name: "N" }, "# H", "Knowledge/f.md")).toBe("T");
    expect(services.docTitle({ name: "N" }, "# H", "Knowledge/f.md")).toBe("N");
    expect(services.docTitle({}, "wstęp\n\n# Nagłówek\n", "Knowledge/f.md")).toBe("Nagłówek");
    expect(services.docTitle({}, "brak nagłówka", "Knowledge/f.md")).toBe("f");
    expect(services.docTitle({ title: "  " }, "", "Knowledge/f.md")).toBe("f");
  });

  it("tytuł: nagłówek w bloku kodu jest pomijany", () => {
    expect(services.docTitle({}, "```\n# nie tytuł\n```\n# Prawdziwy", "Knowledge/f.md")).toBe(
      "Prawdziwy"
    );
  });

  it("tagi: tablica albo napis po przecinkach, reszta daje []", () => {
    expect(services.docTags({ tags: ["a", " b ", "", 3] })).toEqual(["a", "b"]);
    expect(services.docTags({ tags: "a, b ,," })).toEqual(["a", "b"]);
    expect(services.docTags({ tags: 5 })).toEqual([]);
    expect(services.docTags({})).toEqual([]);
  });

  it("frontmatter jako linie tekstowe", () => {
    expect(
      services.frontmatterLines({
        title: "A",
        tags: ["x", "y"],
        n: 3,
        ok: true,
        empty: null,
        obj: { a: 1 },
      })
    ).toEqual([
      { key: "title", value: "A" },
      { key: "tags", value: "[x, y]" },
      { key: "n", value: "3" },
      { key: "ok", value: "true" },
      { key: "empty", value: "" },
      { key: "obj", value: '{"a":1}' },
    ]);
  });
});

function seed() {
  vault.write("Knowledge/alembic.md", "---\ntitle: Alembic\ntags: [db, migracje]\n---\nTreść A\n");
  vault.write("Knowledge/ai-security/foo.md", "# Foo\ntekst");
  vault.write("Knowledge/_index.md", "x");
  vault.write("Knowledge/ai-security/_tags.md", "x");
  vault.write("Knowledge/attachments/img.md", "x");
  vault.write("Projects/p/p.md", "---\nname: Projekt P\n---\ntreść");
  vault.write("Projects/p/decyzja.md", "decyzja");
  for (const f of ["index", "tasks", "bugs", "state", "ai-context", "devlog"]) {
    vault.write(`Projects/p/${f}.md`, "x");
  }
  vault.write("Projects/p/sub/x.md", "x");
  vault.write("Projects/p/work/x.md", "x");
  vault.write("Projects/w/w.md", "dane etatu");
  vault.write("Projects/unknown/u.md", "x");
  vault.write("Projects/loose.md", "x");
  vault.write("Notes/n.md", "notatka");
  vault.write("Work/secret.md", "sekret");
  fs.symlinkSync(path.join(vault.root, "Notes/n.md"), path.join(vault.root, "Knowledge/link.md"));
  fs.symlinkSync(
    path.join(vault.root, "Projects/p/state.md"),
    path.join(vault.root, "Projects/p/alias.md")
  );
}

describe("listDocs", () => {
  it("zwraca tylko widoczne dokumenty, posortowane po area, group, title", () => {
    seed();
    const docs = services.listDocs();
    expect(docs.map((d) => d.path)).toEqual([
      "Knowledge/alembic.md",
      "Knowledge/ai-security/foo.md",
      "Projects/p/decyzja.md",
      "Projects/p/p.md",
    ]);
    expect(docs[0]).toEqual({
      path: "Knowledge/alembic.md",
      area: "Knowledge",
      group: "",
      title: "Alembic",
      tags: ["db", "migracje"],
    });
    expect(docs[3].title).toBe("Projekt P");
  });

  it("projekt owner: work nie trafia na listę (D9)", () => {
    seed();
    expect(services.listDocs().some((d) => d.path.startsWith("Projects/w/"))).toBe(false);
  });

  it("plik z niepoprawnym UTF-8 jest pominięty, lista się nie wywraca", () => {
    seed();
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    const paths = services.listDocs().map((d) => d.path);
    expect(paths).not.toContain("Knowledge/bad.md");
    expect(paths).toContain("Knowledge/alembic.md");
  });

  it("plik większy niż limit zostaje na liście (413 dopiero przy odczycie)", () => {
    seed();
    vault.write("Knowledge/big.md", "a".repeat(MAX_DOC_BYTES + 10));
    expect(services.listDocs().map((d) => d.path)).toContain("Knowledge/big.md");
  });
});

describe("getDoc", () => {
  it("zwraca dokument z frontmatterem i treścią", () => {
    seed();
    const doc = services.getDoc(["Knowledge", "alembic.md"]);
    expect(doc.title).toBe("Alembic");
    expect(doc.frontmatter).toEqual([
      { key: "title", value: "Alembic" },
      { key: "tags", value: "[db, migracje]" },
    ]);
    expect(doc.body).toBe("Treść A\n");
  });

  it("plik bez frontmattera i z błędnym YAML: pusty frontmatter, tags [], cała treść", () => {
    seed();
    vault.write("Knowledge/plain.md", "tekst bez frontmattera");
    vault.write("Knowledge/broken.md", "---\na: [unclosed\n---\ntreść");
    const plain = services.getDoc(["Knowledge", "plain.md"]);
    expect(plain.frontmatter).toEqual([]);
    expect(plain.tags).toEqual([]);
    expect(plain.body).toBe("tekst bez frontmattera");
    const broken = services.getDoc(["Knowledge", "broken.md"]);
    expect(broken.frontmatter).toEqual([]);
    expect(broken.body).toBe("---\na: [unclosed\n---\ntreść");
  });

  const notFound: [string, string[]][] = [
    ["brak pliku", ["Knowledge", "missing.md"]],
    ["state.md projektu", ["Projects", "p", "state.md"]],
    ["podkatalog projektu", ["Projects", "p", "sub", "x.md"]],
    ["katalog work w projekcie", ["Projects", "p", "work", "x.md"]],
    ["projekt owner: work", ["Projects", "w", "w.md"]],
    ["projekt spoza rejestru", ["Projects", "unknown", "u.md"]],
    ["plik _*", ["Knowledge", "_index.md"]],
    ["attachments", ["Knowledge", "attachments", "img.md"]],
    ["plik luzem w Projects", ["Projects", "loose.md"]],
    ["dowiązanie do Notes", ["Knowledge", "link.md"]],
    ["dowiązanie do state.md", ["Projects", "p", "alias.md"]],
  ];
  for (const [name, segments] of notFound) {
    it(`404: ${name}`, () => {
      seed();
      expect(statusOf(() => services.getDoc(segments))).toBe(404);
    });
  }

  it("400 ma pierwszeństwo przed 404 (Work/x.md)", () => {
    seed();
    expect(statusOf(() => services.getDoc(["Work", "secret.md"]))).toBe(400);
  });

  it("413 dla pliku większego niż 1 MB", () => {
    seed();
    vault.write("Knowledge/big.md", "a".repeat(MAX_DOC_BYTES + 10));
    expect(statusOf(() => services.getDoc(["Knowledge", "big.md"]))).toBe(413);
  });

  it("niepoprawny UTF-8 daje 404, nie 500", () => {
    seed();
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    expect(statusOf(() => services.getDoc(["Knowledge", "bad.md"]))).toBe(404);
  });
});
