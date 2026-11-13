// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import {
  readDevlog,
  readProjectContent,
  readProjectIndex,
  readProjectState,
  readRegistry,
} from "@/contexts/bc_projects/repositories";
import { PathOutsideVaultError, WorkAreaBlockedError } from "@/lib/nexus/vault-fs";
import { useTempVault } from "../../lib/nexus/repos/helpers";

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
