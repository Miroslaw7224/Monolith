// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectState, RegistryEntry } from "@/contexts/bc_projects/models";
import {
  appendDevlogEntry,
  readDevlog,
  readProjectContent,
  readProjectIndex,
  readProjectState,
  readRegistry,
  writeProjectState,
  writeProjectType,
} from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import { PathOutsideVaultError, WorkAreaBlockedError } from "@/lib/nexus/vault-fs";
import { useTempVault } from "../../helpers/tempVault";

const REGISTRY = "Projects/_registry.yaml";

const vault = useTempVault();

function entry(
  partial: Partial<RegistryEntry> & Pick<RegistryEntry, "id" | "folder">
): RegistryEntry {
  return {
    name: partial.name ?? partial.id,
    status: partial.status ?? "",
    priority: partial.priority ?? "",
    localPath: partial.localPath ?? "",
    owner: "personal",
    ...partial,
  };
}

describe("bc_projects repositories", () => {
  it("brak _registry.yaml", () => {
    expect(readRegistry()).toEqual({
      entries: [],
      warnings: ["Brak Projects/_registry.yaml w vaulcie"],
    });
  });

  it("brak klucza projects", () => {
    vault.write(REGISTRY, "inne: 1\n");
    const result = readRegistry();
    expect(result.entries).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("projects nie jest listą", () => {
    vault.write(REGISTRY, "projects: tekst\n");
    const result = readRegistry();
    expect(result.entries).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("zepsuty YAML", () => {
    vault.write(REGISTRY, "projects: [\n");
    expect(() => readRegistry()).toThrow(/Nie można odczytać pliku Projects\/_registry.yaml/);
  });

  it("mapowanie pól", () => {
    vault.write(
      REGISTRY,
      [
        "projects:",
        "  - id: nexus",
        "    name: NEXUS",
        "    status: active",
        "    priority: high",
        "    folder: Projects/nexus/",
        "    local_path: 'E:\\x'",
        "    github: https://g",
        "",
      ].join("\n")
    );
    expect(readRegistry().entries[0]).toEqual({
      id: "nexus",
      name: "NEXUS",
      status: "active",
      priority: "high",
      folder: "Projects/nexus/",
      localPath: "E:\\x",
      github: "https://g",
      owner: "personal",
    });
  });

  it("wpis bez id / bez folder", () => {
    vault.write(
      REGISTRY,
      [
        "projects:",
        "  - name: bez-id",
        "    folder: Projects/a/",
        "  - id: bez-folder",
        "    name: X",
        "  - id: ok",
        "    name: OK",
        "    folder: Projects/ok/",
        "    status: active",
        "    priority: high",
        "",
      ].join("\n")
    );
    const result = readRegistry();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe("ok");
    expect(result.warnings).toHaveLength(2);
  });

  it("element listy nie-mapą", () => {
    vault.write(REGISTRY, 'projects: [ "x" ]\n');
    const result = readRegistry();
    expect(result.entries).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("name brak", () => {
    vault.write(
      REGISTRY,
      [
        "projects:",
        "  - id: alone",
        "    folder: Projects/alone/",
        "    status: active",
        "    priority: low",
        "",
      ].join("\n")
    );
    expect(readRegistry().entries[0].name).toBe("alone");
  });

  it('deploy: ""', () => {
    vault.write(
      REGISTRY,
      [
        "projects:",
        "  - id: d",
        "    name: D",
        "    folder: Projects/d/",
        "    status: active",
        "    priority: low",
        '    deploy: ""',
        "",
      ].join("\n")
    );
    expect(readRegistry().entries[0]).not.toHaveProperty("deploy");
  });

  it("index: frontmatter + sekcja", () => {
    const e = entry({ id: "p", folder: "Projects/p/" });
    vault.write(
      "Projects/p/index.md",
      "---\nlast_worked: 2026-05-19\nstate_confidence: verified\n---\n\n## O projekcie\nx\n\n## Gdzie skończyłem\nKoniec X.\n\n## Historia sesji\n- y\n"
    );
    expect(readProjectIndex(e)).toEqual({
      lastWorked: "2026-05-19",
      stateConfidence: "verified",
      whereIStopped: "Koniec X.",
    });
  });

  it("index: liczba w frontmatterze", () => {
    const e = entry({ id: "p", folder: "Projects/p/" });
    vault.write(
      "Projects/p/index.md",
      "---\nlast_worked: 2026-05-19\nstate_confidence: 80\n---\n\n## Gdzie skończyłem\nA\n"
    );
    expect(readProjectIndex(e).stateConfidence).toBe("80");
  });

  it("index: zepsuty frontmatter", () => {
    const e = entry({ id: "p", folder: "Projects/p/" });
    vault.write("Projects/p/index.md", "---\n: [\n---\n## Gdzie skończyłem\nA\n");
    expect(() => readProjectIndex(e)).toThrow(/index\.md/);
  });

  it("brak index.md, tasks.md, bugs.md", () => {
    const e = entry({ id: "p", folder: "Projects/p/" });
    expect(readProjectIndex(e)).toEqual({ whereIStopped: null });
    expect(readProjectContent(e)).toEqual({ tasks: [], bugs: [] });
  });

  it("tasks.md z trzema sekcjami", () => {
    const e = entry({ id: "p", folder: "Projects/p/" });
    vault.write(
      "Projects/p/tasks.md",
      "## Blokery\n_Brak_\n## Next\n- [ ] A\n## Backlog\n- [x] B\n"
    );
    const { tasks } = readProjectContent(e);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ heading: "Blokery", items: [] });
  });

  it("folder: ../../x", () => {
    const e = entry({ id: "bad", folder: "../../x" });
    expect(() => readProjectIndex(e)).toThrow(PathOutsideVaultError);
  });

  it("folder: Work/x/", () => {
    const e = entry({ id: "work", folder: "Work/x/" });
    expect(() => readProjectIndex(e)).toThrow(WorkAreaBlockedError);
  });
});

describe("bc_projects repositories: type, state.md, devlog.md (odczyt)", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  const STATE =
    "---\nbranch: main\nenv: local\nblocker: X\nnext_step: Y\nlinks:\n  - https://a\nmilestone: M\n---\n\nnotatka\n";

  it("type z index.md", () => {
    vault.write("Projects/p/index.md", "---\ntype: wlasny\n---\n\ntreść\n");
    expect(readProjectIndex(e).type).toBe("wlasny");
  });

  it("nieznany type jest pomijany", () => {
    vault.write("Projects/p/index.md", "---\ntype: coś\n---\n\ntreść\n");
    expect(readProjectIndex(e).type).toBeUndefined();
  });

  it("brak state.md", () => {
    expect(readProjectState(e)).toEqual({ state: null, version: null });
  });

  it("state.md z frontmatterem i wersją", () => {
    vault.write("Projects/p/state.md", STATE);
    const { state, version } = readProjectState(e);
    expect(state?.branch).toBe("main");
    expect(state?.links).toEqual(["https://a"]);
    expect(version?.size).toBeGreaterThan(0);
    expect(version?.hash).toHaveLength(64);
  });

  it("zepsuty state.md rzuca błąd z nazwą pliku", () => {
    vault.write("Projects/p/state.md", "---\nbranch: [\n---\n");
    expect(() => readProjectState(e)).toThrow(/Projects\/p\/state\.md: zepsuty frontmatter/);
  });

  it("brak devlog.md", () => {
    expect(readDevlog(e)).toEqual([]);
  });

  it("devlog.md z dwoma wpisami w kolejności pliku", () => {
    vault.write(
      "Projects/p/devlog.md",
      "# Devlog\n\n## 2026-11-13 — B\n\nb\n\n## 2026-11-12 — A\n\na\n"
    );
    expect(readDevlog(e).map((x) => x.title)).toEqual(["B", "A"]);
  });

  it("folder: Work/x/ przy odczycie state.md i devlog.md", () => {
    const work = entry({ id: "w", folder: "Work/x/" });
    expect(() => readProjectState(work)).toThrow(WorkAreaBlockedError);
    expect(() => readDevlog(work)).toThrow(WorkAreaBlockedError);
  });
});

describe("bc_projects repositories: zapisy", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  const STATE: ProjectState = {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "krok",
    links: ["https://a"],
    milestone: "M",
    updated: "2026-11-13T09:15",
    notes: "",
  };
  const ENTRY = { date: "2026-11-13", title: "T", why: "W" };

  it("writeProjectState: nowy plik i zwrócona wersja", () => {
    const version = writeProjectState(e, STATE, null);
    expect(vault.read("Projects/p/state.md")).toContain("branch: main");
    expect(version).toEqual(readProjectState(e).version);
  });

  it("writeProjectState: zapis ze zgodną wersją", () => {
    const v1 = writeProjectState(e, STATE, null);
    writeProjectState(e, { ...STATE, branch: "inny" }, v1);
    expect(readProjectState(e).state?.branch).toBe("inny");
  });

  it("writeProjectState: stara wersja daje ConflictError i nie nadpisuje zmiany zewnętrznej", () => {
    const v1 = writeProjectState(e, STATE, null);
    vault.write("Projects/p/state.md", "---\nbranch: zewnętrzny\n---\n");
    expect(() => writeProjectState(e, { ...STATE, branch: "nasz" }, v1)).toThrow(ConflictError);
    expect(vault.read("Projects/p/state.md")).toContain("zewnętrzny");
  });

  it("writeProjectState: expected null przy istniejącym pliku", () => {
    writeProjectState(e, STATE, null);
    expect(() => writeProjectState(e, STATE, null)).toThrow(ConflictError);
  });

  it("writeProjectState: oczekiwana wersja przy braku pliku", () => {
    expect(() => writeProjectState(e, STATE, { size: 1, hash: "x" })).toThrow(ConflictError);
  });

  it("appendDevlogEntry: brak pliku", async () => {
    await appendDevlogEntry(e, ENTRY);
    expect(vault.read("Projects/p/devlog.md")).toBe("# Devlog\n\n## 2026-11-13 — T\n\nW\n");
  });

  it("appendDevlogEntry: nowy wpis przed starym", async () => {
    vault.write("Projects/p/devlog.md", "# Devlog\n\n## 2026-11-12 — Stary\n\nS\n");
    await appendDevlogEntry(e, ENTRY);
    expect(vault.read("Projects/p/devlog.md")).toBe(
      "# Devlog\n\n## 2026-11-13 — T\n\nW\n\n## 2026-11-12 — Stary\n\nS\n"
    );
  });

  it("writeProjectType: tylko linia type, reszta pliku bez zmian", async () => {
    vault.write("Projects/p/index.md", '---\n# komentarz\nname: "A"\ntype: "etat"\n---\n\nTreść\n');
    await writeProjectType(e, "wlasny");
    expect(vault.read("Projects/p/index.md")).toBe(
      '---\n# komentarz\nname: "A"\ntype: wlasny\n---\n\nTreść\n'
    );
  });

  it("writeProjectType: CRLF zapisane jako LF, treść i pola zachowane", async () => {
    vault.write("Projects/p/index.md", "---\r\nname: A\r\ntype: etat\r\n---\r\n\r\nTreść\r\n");
    await writeProjectType(e, "biblioteka");
    expect(vault.read("Projects/p/index.md")).toBe(
      "---\nname: A\ntype: biblioteka\n---\n\nTreść\n"
    );
  });

  it("writeProjectType: brak index.md", async () => {
    await expect(writeProjectType(e, "etat")).rejects.toThrow(NotFoundError);
    expect(vault.read("Projects/p/index.md")).toBeNull();
  });

  it("writeProjectType: index.md bez frontmattera", async () => {
    vault.write("Projects/p/index.md", "Treść bez frontmattera\n");
    const error = await writeProjectType(e, "etat").catch((err: unknown) => err);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(422);
    expect(vault.read("Projects/p/index.md")).toBe("Treść bez frontmattera\n");
  });

  it("folder: Work/x/ i ../x/ przy zapisach", async () => {
    const work = entry({ id: "w", folder: "Work/x/" });
    const out = entry({ id: "o", folder: "../x/" });
    expect(() => writeProjectState(work, STATE, null)).toThrow(WorkAreaBlockedError);
    expect(() => writeProjectState(out, STATE, null)).toThrow(PathOutsideVaultError);
    await expect(appendDevlogEntry(work, ENTRY)).rejects.toThrow(WorkAreaBlockedError);
    await expect(appendDevlogEntry(out, ENTRY)).rejects.toThrow(PathOutsideVaultError);
    await expect(writeProjectType(work, "etat")).rejects.toThrow(WorkAreaBlockedError);
    await expect(writeProjectType(out, "etat")).rejects.toThrow(PathOutsideVaultError);
  });
});

describe("bc_projects repositories: zapis tylko w Projects/<id>/", () => {
  const ENTRY = { date: "2026-11-13", title: "T", why: "W" };
  const STATE: ProjectState = {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "",
    links: [],
    milestone: "",
    notes: "",
  };

  it.each([
    ["Notes/x/"],
    ["Projects/"],
    ["Projects/."],
    ["Projects/./"],
    ["Projects/a/b/"],
    ["Archive/Projects/x/"],
    ["projects-x/y/"],
  ])("folder %s: zapis odrzucony (422), nic nie powstaje", async (folder) => {
    const e = entry({ id: "n", folder });
    const check = (err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).statusCode).toBe(422);
    };
    try {
      writeProjectState(e, STATE, null);
      expect.unreachable();
    } catch (err) {
      check(err);
    }
    check(await appendDevlogEntry(e, ENTRY).catch((err: unknown) => err));
    check(await writeProjectType(e, "etat").catch((err: unknown) => err));
    expect(vault.read(`${folder}state.md`)).toBeNull();
    expect(vault.read(`${folder}devlog.md`)).toBeNull();
  });
});

function registryWithOwner(ownerLine: string | null): string {
  return [
    "projects:",
    "  - id: a",
    "    folder: Projects/a/",
    ...(ownerLine === null ? [] : [`    ${ownerLine}`]),
    "",
  ].join("\n");
}

const UNKNOWN_OWNER = (shown: string) =>
  `Projects/_registry.yaml: pozycja 1: nieznane owner "${shown}", traktuję jako work`;

describe("bc_projects repositories: readRegistry, owner", () => {
  it.each([
    ["brak pola", null, "personal", []],
    ["personal", "owner: personal", "personal", []],
    ["work", "owner: work", "work", []],
    ["pusty tekst", 'owner: ""', "personal", []],
    ["null (puste pole)", "owner:", "personal", []],
    ["work ze spacjami", 'owner: " work "', "work", []],
    ["Work (wielka litera)", "owner: Work", "work", [UNKNOWN_OWNER("Work")]],
    ["firma", "owner: firma", "work", [UNKNOWN_OWNER("firma")]],
    ["bool", "owner: true", "work", [UNKNOWN_OWNER("true")]],
    ["liczba", "owner: 1", "work", [UNKNOWN_OWNER("1")]],
    ["lista", "owner: [work]", "work", [UNKNOWN_OWNER("(nie tekst)")]],
    ["mapa", "owner: {a: 1}", "work", [UNKNOWN_OWNER("(nie tekst)")]],
  ] as const)("%s", (_label, line, owner, warnings) => {
    vault.write(REGISTRY, registryWithOwner(line));
    const result = readRegistry();
    expect(result.entries[0].owner).toBe(owner);
    expect(result.warnings).toEqual(warnings);
  });

  it("ostrzeżenie dotyczy właściwej pozycji", () => {
    vault.write(
      REGISTRY,
      [
        "projects:",
        "  - id: a",
        "    folder: Projects/a/",
        "  - id: b",
        "    folder: Projects/b/",
        "    owner: Work",
        "",
      ].join("\n")
    );
    const result = readRegistry();
    expect(result.entries.map((e) => e.owner)).toEqual(["personal", "work"]);
    expect(result.warnings).toEqual([
      'Projects/_registry.yaml: pozycja 2: nieznane owner "Work", traktuję jako work',
    ]);
  });
});
