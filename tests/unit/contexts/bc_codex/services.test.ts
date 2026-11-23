// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CODEX_PATH } from "@/contexts/bc_codex/models";
import {
  getChecklistState,
  getCodex,
  recordEvent,
  replayJournal,
} from "@/contexts/bc_codex/services";
import { DomainError } from "@/lib/errors";
import { WorkAccessBlockedError } from "@/lib/workGuard";
import { setupTempVault } from "../../helpers/tempVault";

const CODEX =
  "---\nname: K\n---\n# Kodeks\n## 1. TDD\n- **[TDD-1] MUST** a\n- **[TDD-2] SHOULD** b\n";
const month = new Date().toISOString().slice(0, 7);
const personalFile = `Checklists/${month}.jsonl`;
const workFile = `Work/Checklists/${month}.jsonl`;

describe("getCodex", () => {
  const vault = setupTempVault();

  it("bez pliku: status missing i ścieżka", () => {
    expect(getCodex()).toEqual({ status: "missing", path: CODEX_PATH });
  });

  it("z plikiem: status ok, sparsowane reguły i dodatni mtime", () => {
    vault.write(CODEX_PATH, CODEX);
    const result = getCodex();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.path).toBe(CODEX_PATH);
    expect(result.mtimeMs).toBeGreaterThan(0);
    expect(result.parsed.rules.map((r) => r.id)).toEqual(["TDD-1", "TDD-2"]);
  });

  it("bez NEXUS_VAULT_PATH: status config-error z komunikatem", () => {
    delete process.env.NEXUS_VAULT_PATH;
    const result = getCodex();
    expect(result.status).toBe("config-error");
    if (result.status !== "config-error") return;
    expect(result.message).toContain("NEXUS_VAULT_PATH");
  });
});

describe("recordEvent i getChecklistState (strefa personal)", () => {
  const vault = setupTempVault();

  it("start tworzy plik dziennika z jedną linią JSON i nadaje run oraz ts", async () => {
    const event = await recordEvent({
      type: "start",
      owner: "personal",
      checklist: "definition-of-done",
      task: "Zadanie",
    });
    expect(event.run.length).toBeGreaterThan(0);
    expect(event.ts.slice(0, 7)).toBe(month);
    const lines = (vault.read(personalFile) ?? "").split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("");
    expect(JSON.parse(lines[0])).toMatchObject({
      type: "start",
      owner: "personal",
      run: event.run,
      checklist: "definition-of-done",
      task: "Zadanie",
    });
  });

  it("toggle i note po start odtwarzają się w getChecklistState", async () => {
    const start = await recordEvent({
      type: "start",
      owner: "personal",
      checklist: "definition-of-done",
      task: "Z",
    });
    await recordEvent({
      type: "toggle",
      owner: "personal",
      run: start.run,
      item: "dod-1",
      checked: true,
    });
    await recordEvent({
      type: "note",
      owner: "personal",
      run: start.run,
      item: "dod-1",
      text: "ok",
    });
    const state = getChecklistState();
    expect(state.month).toBe(month);
    expect(state.personal.eventCount).toBe(3);
    expect(state.personal.runs[0].items["dod-1"]).toEqual({ checked: true, note: "ok" });
  });

  it("uszkodzona linia w pliku jest pomijana i liczona", () => {
    vault.write(personalFile, "{zepsute\n");
    expect(getChecklistState().personal.skippedLines).toBe(1);
  });

  it("20 równoległych zapisów daje 20 poprawnych, niesklejonych linii", async () => {
    const start = await recordEvent({
      type: "start",
      owner: "personal",
      checklist: "c",
      task: "",
    });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        recordEvent({
          type: "toggle",
          owner: "personal",
          run: start.run,
          item: `c-${i + 1}`,
          checked: true,
        })
      )
    );
    const text = vault.read(personalFile) ?? "";
    const lines = text.split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(21);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
    const replayed = replayJournal(text);
    expect(replayed.skippedLines).toBe(0);
    expect(Object.keys(replayed.runs[0].items)).toHaveLength(20);
  });

  it("nieprawidłowy miesiąc daje błąd walidacji 400", () => {
    expect(() => getChecklistState("2026-13")).toThrow(DomainError);
    let err: unknown;
    try {
      getChecklistState("2026-13");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).statusCode).toBe(400);
  });
});

describe("prywatność strefy work", () => {
  const vault = setupTempVault();
  const workStart = {
    type: "start",
    owner: "work",
    checklist: "definition-of-done",
    task: "tajne zadanie z etatu",
  } as const;

  it("bez ignorowania Work/ przez git zapis jest odrzucony i nic nie powstaje", async () => {
    await expect(recordEvent(workStart)).rejects.toBeInstanceOf(WorkAccessBlockedError);
    expect(vault.read(workFile)).toBeNull();
    expect(vault.read(personalFile)).toBeNull();
  });

  it("z ignorowanym Work/ zdarzenie ląduje tylko w Work/Checklists, a personal zostaje pusty", async () => {
    execFileSync("git", ["init", "-q"], { cwd: vault.root, stdio: "ignore" });
    vault.write(".gitignore", "/Work/\n");
    const event = await recordEvent(workStart);
    expect(vault.read(workFile)).toContain("tajne zadanie z etatu");
    expect(vault.read(workFile)).toContain(event.run);
    expect(vault.read(personalFile)).toBeNull();
    const state = getChecklistState();
    expect("blocked" in state.work).toBe(false);
    if ("blocked" in state.work) return;
    expect(state.work.runs[0].task).toBe("tajne zadanie z etatu");
    expect(state.personal.runs).toEqual([]);
  });

  it("zablokowane work nie psuje personal: getChecklistState zwraca blocked z komunikatem", async () => {
    await recordEvent({
      type: "start",
      owner: "personal",
      checklist: "definition-of-done",
      task: "jawne",
    });
    const state = getChecklistState();
    expect(state.work).toEqual({ blocked: expect.stringContaining("Work/") });
    expect(state.personal.runs).toHaveLength(1);
  });
});
