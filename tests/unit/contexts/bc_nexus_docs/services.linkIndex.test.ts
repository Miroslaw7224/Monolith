// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockListProjects = vi.hoisted(() => vi.fn<typeof ProjectsServices.listProjects>());
vi.mock("@/contexts/bc_projects/services", async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectsServices>();
  return {
    listProjects: mockListProjects,
    isWorkProject: actual.isWorkProject,
  } satisfies Partial<typeof ProjectsServices>;
});

import { buildKnowledgeLinkIndex, normalizeHost } from "@/contexts/bc_nexus_docs/services";

type E = ReturnType<typeof ProjectsServices.listProjects>["projects"][number];
const entry = (o: Partial<E> = {}): E => ({
  id: "p",
  name: "p",
  status: "active",
  priority: "medium",
  folder: "Projects/p/",
  localPath: "",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  ...o,
});

const vault = setupTempVault();

beforeEach(() => {
  mockListProjects.mockReset();
  mockListProjects.mockReturnValue({
    projects: [entry({ id: "p", owner: "personal" })],
    warnings: [],
  });
  vault.write(
    "Knowledge/a.md",
    "---\ntitle: Alfa\nsource_urls:\n  - https://www.github.com/x/y\n  - https://docs.example.com/p\n---\nTreść A"
  );
  vault.write(
    "Knowledge/b.md",
    "---\ntitle: Beta\nsource_urls:\n  - https://github.com/z\n---\nTreść B"
  );
  vault.write("Knowledge/c.md", "---\ntitle: Gamma\nsource_urls: []\n---\nTreść C");
  vault.write(
    "Knowledge/d.md",
    "---\ntitle: Delta\nsource_urls: https://single.example.com\n---\nTreść D"
  );
  vault.write(
    "Projects/p/notes.md",
    "---\ntitle: Projektowa\nsource_urls:\n  - https://skip.example.com\n---\nTreść P"
  );
});

describe("normalizeHost", () => {
  it("zdejmuje www i wielkość liter, zwraca null dla błędnego URL", () => {
    expect(normalizeHost("https://WWW.GitHub.com/a")).toBe("github.com");
    expect(normalizeHost("nie-url")).toBeNull();
  });
});

describe("buildKnowledgeLinkIndex", () => {
  it("hostToPath wskazuje pierwszy dokument w kolejności listy (tytuł: Alfa przed Beta)", () => {
    const idx = buildKnowledgeLinkIndex();
    expect(idx.hostToPath.get("github.com")).toBe("Knowledge/a.md");
    expect(idx.hostToPath.get("docs.example.com")).toBe("Knowledge/a.md");
  });

  it("obsługuje source_urls jako łańcuch i pomija dokumenty spoza Knowledge", () => {
    const idx = buildKnowledgeLinkIndex();
    expect(idx.hostToPath.get("single.example.com")).toBe("Knowledge/d.md");
    expect(idx.hostToPath.has("skip.example.com")).toBe(false);
  });

  it("paths zawiera dokumenty Knowledge, także bez source_urls", () => {
    expect([...buildKnowledgeLinkIndex().paths].sort()).toEqual([
      "Knowledge/a.md",
      "Knowledge/b.md",
      "Knowledge/c.md",
      "Knowledge/d.md",
    ]);
  });

  it("pomija dokumenty większe niż MAX_DOC_BYTES (otwarcie dałoby 413)", () => {
    vault.write(
      "Knowledge/big.md",
      "---\ntitle: Duży\nsource_urls:\n  - https://big.example.com\n---\n" +
        "x".repeat(1_048_576 + 1)
    );
    const idx = buildKnowledgeLinkIndex();
    expect(idx.paths.has("Knowledge/big.md")).toBe(false);
    expect(idx.hostToPath.has("big.example.com")).toBe(false);
  });
});
