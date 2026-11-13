// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_PINNED, type Cockpit } from "@/contexts/bc_cockpit/models";
import {
  ClosingInputSchema,
  PinnedInputSchema,
  toCockpitDto,
  toCommitHistoryDto,
  toPinnedDto,
} from "@/contexts/bc_cockpit/schemas";

describe("PinnedInputSchema", () => {
  it("przyjmuje 0..3 różnych niepustych id i przycina spacje", () => {
    expect(PinnedInputSchema.parse({ ids: [] })).toEqual({ ids: [] });
    expect(PinnedInputSchema.parse({ ids: [" nexus ", "monolith"] })).toEqual({
      ids: ["nexus", "monolith"],
    });
  });

  it("odrzuca więcej niż MAX_PINNED id (literał 3 w schemas zgodny z models)", () => {
    const ok = Array.from({ length: MAX_PINNED }, (_, i) => `p${i}`);
    expect(PinnedInputSchema.safeParse({ ids: ok }).success).toBe(true);
    expect(PinnedInputSchema.safeParse({ ids: [...ok, "extra"] }).success).toBe(false);
  });

  it("odrzuca duplikaty, puste id, brak pola i nie-tablicę", () => {
    expect(PinnedInputSchema.safeParse({ ids: ["a", "a"] }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: ["  "] }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({}).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: "nexus" }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: [1] }).success).toBe(false);
  });
});

describe("ClosingInputSchema", () => {
  it("przycina tekst, projectId opcjonalne", () => {
    expect(ClosingInputSchema.parse({ text: "  Zacząć od K6 " })).toEqual({ text: "Zacząć od K6" });
    expect(ClosingInputSchema.parse({ text: "x", projectId: " nexus " })).toEqual({
      text: "x",
      projectId: "nexus",
    });
    expect(ClosingInputSchema.parse({ text: "x", projectId: null })).toEqual({
      text: "x",
      projectId: null,
    });
  });

  it("odrzuca pusty tekst, tekst > 300 znaków i brak pola", () => {
    expect(ClosingInputSchema.safeParse({ text: "  " }).success).toBe(false);
    expect(ClosingInputSchema.safeParse({ text: "a".repeat(301) }).success).toBe(false);
    expect(ClosingInputSchema.safeParse({ text: "a".repeat(300) }).success).toBe(true);
    expect(ClosingInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("mapery DTO", () => {
  const model: Cockpit = {
    date: "2026-11-13",
    topics: [
      {
        id: "nexus",
        name: "NEXUS",
        owner: "personal",
        freshness: "fresh",
        source: "state",
        nextStep: "Plan",
        blocker: null,
        whereIStopped: null,
        branch: "main",
        lastActivity: "2026-11-12T21:40",
        confidence: "sure",
        nowCount: 2,
        bugCount: 1,
      },
    ],
    queue: [
      {
        projectId: null,
        name: "Ogólne",
        owner: "personal",
        items: [
          {
            kind: "today",
            title: "Faktura",
            due: "2026-11-13",
            projectName: null,
            priority: null,
            energy: "quick",
          },
        ],
      },
    ],
    events: [
      {
        id: "e1",
        title: "Spotkanie",
        startMinutes: 570,
        durationMinutes: 30,
        type: "meeting",
        color: "#fff",
      },
    ],
    nextMeeting: { title: "Spotkanie", startMinutes: 570, durationMinutes: 30 },
    git: { commitsToday: 4, projectsWithCommits: 2, branch: "main" },
    inbox: { open: 3 },
    closing: {
      anchor: { date: "2026-11-12", text: "Zacząć od K6", projectId: "nexus", commits: 4 },
      today: null,
    },
    warnings: ["uwaga"],
  };

  it("toCockpitDto zachowuje kształt i nie wpuszcza dodatkowych pól", () => {
    const dto = toCockpitDto({ ...model, extra: "x" } as Cockpit);
    expect(dto).toEqual(model);
    expect(Object.keys(dto).sort()).toEqual([
      "closing",
      "date",
      "events",
      "git",
      "inbox",
      "nextMeeting",
      "queue",
      "topics",
      "warnings",
    ]);
  });

  it("toPinnedDto", () => {
    expect(toPinnedDto({ ids: ["a"] })).toEqual({ ids: ["a"] });
  });
});

describe("toCommitHistoryDto", () => {
  it("zachowuje kształt i nie wpuszcza dodatkowych pól", () => {
    const model = {
      from: "2026-11-12",
      to: "2026-11-13",
      available: true,
      total: 2,
      days: [
        { date: "2026-11-12", total: 0, projects: [] },
        { date: "2026-11-13", total: 2, projects: [{ projectId: "a", name: "A", count: 2 }] },
      ],
    };
    const dto = toCommitHistoryDto({ ...model, extra: 1 } as never);
    expect(dto).toEqual(model);
    expect(Object.keys(dto).sort()).toEqual(["available", "days", "from", "to", "total"]);
  });
});
