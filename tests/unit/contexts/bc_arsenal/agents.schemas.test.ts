// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AgentEntryInputSchema, toAgentEntryDto, toAgentsDto } from "@/contexts/bc_arsenal/schemas";

describe("AgentEntryInputSchema", () => {
  it("agent: wymaga nazwy i roli, przycina, puste pola opcjonalne = undefined", () => {
    const parsed = AgentEntryInputSchema.parse({
      kind: "agent",
      name: " agy ",
      role: " Review ",
      model: " ",
    });
    expect(parsed).toMatchObject({ kind: "agent", name: "agy", role: "Review" });
    expect("model" in parsed ? parsed.model : "x").toBeUndefined();
  });

  it("preset: wymaga polecenia; skrypt: wymaga ścieżki", () => {
    expect(
      AgentEntryInputSchema.safeParse({ kind: "preset", name: "P", command: " " }).success
    ).toBe(false);
    expect(AgentEntryInputSchema.safeParse({ kind: "script", name: "S", path: "" }).success).toBe(
      false
    );
    expect(
      AgentEntryInputSchema.safeParse({ kind: "preset", name: "P", command: "x" }).success
    ).toBe(true);
    expect(
      AgentEntryInputSchema.safeParse({ kind: "script", name: "S", path: "scripts/x.sh" }).success
    ).toBe(true);
  });

  it("odrzuca nieznany rodzaj i pustą nazwę", () => {
    expect(AgentEntryInputSchema.safeParse({ kind: "inny", name: "x" }).success).toBe(false);
    expect(AgentEntryInputSchema.safeParse({ kind: "agent", name: "", role: "r" }).success).toBe(
      false
    );
  });
});

describe("DTO", () => {
  it("pomija nieustawione pola opcjonalne i grupuje rodzaje", () => {
    const overview = {
      agents: [{ kind: "agent" as const, id: "a", name: "agy", role: "Review" }],
      presets: [
        { kind: "preset" as const, id: "p", name: "P", command: "cmd", description: "opis" },
      ],
      scripts: [{ kind: "script" as const, id: "s", name: "S", path: "scripts/x.sh" }],
      skipped: 2,
    };
    expect(toAgentEntryDto(overview.agents[0])).toEqual({
      kind: "agent",
      id: "a",
      name: "agy",
      role: "Review",
    });
    expect(toAgentsDto(overview)).toEqual({
      agents: [{ kind: "agent", id: "a", name: "agy", role: "Review" }],
      presets: [{ kind: "preset", id: "p", name: "P", command: "cmd", description: "opis" }],
      scripts: [{ kind: "script", id: "s", name: "S", path: "scripts/x.sh" }],
      skipped: 2,
    });
  });
});
