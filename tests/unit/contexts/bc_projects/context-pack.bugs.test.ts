// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BugEntry, ContextPackRole, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const BIG = 1_000_000;

const OPEN_BUG: BugEntry = {
  id: "GP-001",
  title: "Porty",
  section: "Aktywne",
  priority: "medium",
  status: "otwarty",
  file: "`start_v2.bat`",
  description: "Launchery wypisują 5000.",
  fix: "Poprawić echo.",
  ageDays: 23,
};
const CLOSED_BUG: BugEntry = { id: "EA-001", title: "Stary", section: "Zamknięte" };

function project(bugs: BugEntry[]): ProjectWithContent {
  return {
    id: "a",
    name: "Alpha",
    status: "active",
    priority: "high",
    folder: "Projects/a/",
    localPath: "~/projects/a",
    owner: "personal",
    whereIStopped: null,
    freshness: "fresh",
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs,
    state: null,
    stateVersion: null,
    devlog: [],
  };
}

function pack(role: ContextPackRole, bugs: BugEntry[]): string {
  const input: ContextPackInput = {
    project: project(bugs),
    lastWorked: "2026-11-10",
    rules: null,
    git: { ok: true, snapshot: { status: "## main", log: "aaaaaaa c1", diffStat: "" } },
    warnings: [],
    role,
  };
  return composeContextPack(input, BIG).markdown;
}

describe("paczka kontekstu: bugi", () => {
  it("debug: pełne pola, wiek i instrukcja zamknięcia; bez zamkniętych", () => {
    const md = pack("debug", [OPEN_BUG, CLOSED_BUG]);
    expect(md).toContain("## Bugi (otwarte)");
    expect(md).toContain("- GP-001: Porty [medium] (otwarty) · otwarty 23 d");
    expect(md).toContain("  Plik: `start_v2.bat`");
    expect(md).toContain("  Opis: Launchery wypisują 5000.");
    expect(md).toContain("  Naprawa: Poprawić echo.");
    expect(md).toContain("Po naprawie zamknij bug w `Projects/<projekt>/bugs.md`");
    expect(md).toContain("docs/nexus-vault-formaty-yaml.md");
    expect(md).not.toContain("EA-001");
  });

  it("debug: bug bez pól opcjonalnych to sama linia nagłówkowa", () => {
    const md = pack("debug", [{ id: "A-1", title: "x", section: "Aktywne" }]);
    expect(md).toContain("- A-1: x");
    expect(md).not.toContain("Plik:");
    expect(md).not.toContain("Opis:");
  });

  it("debug bez otwartych bugów: brak sekcji i instrukcji", () => {
    const md = pack("debug", [CLOSED_BUG]);
    expect(md).not.toContain("## Bugi (otwarte)");
    expect(md).not.toContain("Po naprawie zamknij bug");
  });

  it.each(["full", "implementation"] as const)("%s: jedna linia na bug, jak dotąd", (role) => {
    const md = pack(role, [OPEN_BUG]);
    expect(md).toContain("- GP-001: Porty [medium] (otwarty)");
    expect(md).not.toContain("otwarty 23 d");
    expect(md).not.toContain("Plik:");
    expect(md).not.toContain("Po naprawie zamknij bug");
  });
});
