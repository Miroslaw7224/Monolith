// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectState } from "@/contexts/bc_projects/models";
import { parseState, serializeState } from "@/contexts/bc_projects/repositories/markdown";

const base: ProjectState = {
  branch: "main",
  env: "",
  blocker: "",
  nextStep: "krok",
  links: [],
  milestone: "",
  notes: "notatki",
};

describe("state.md: code_commit", () => {
  it("czyta ręcznie dopisane pole, notatki bez zmian", () => {
    const state = parseState(
      "---\nbranch: main\ncode_commit: abc1234\n---\n\nnotatki\n",
      "state.md"
    );
    expect(state.codeCommit).toBe("abc1234");
    expect(state.notes).toBe("notatki");
  });

  it("brak pola: codeCommit undefined i brak klucza w pliku", () => {
    expect(parseState(serializeState(base), "state.md").codeCommit).toBeUndefined();
    expect(serializeState(base)).not.toContain("code_commit");
  });

  it.each([
    "abc1234def5678",
    "0123456", // zaczyna się od zera: YAML mógłby zmienić na liczbę
    "1234567", // same cyfry
    "1e30000", // wygląda na liczbę zmiennoprzecinkową
    "abcdef0123456789abcdef0123456789abcdef01",
  ])("round-trip sha %s", (sha) => {
    const out = serializeState({ ...base, codeCommit: sha });
    expect(parseState(out, "state.md").codeCommit).toBe(sha);
    expect(parseState(out, "state.md").notes).toBe("notatki");
  });
});
