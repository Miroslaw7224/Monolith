// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_PINNED, type Cockpit } from "@/contexts/bc_cockpit/models";
import {
  ClosingInputSchema,
  CompleteQueueItemSchema,
  PinnedInputSchema,
  toCockpitDto,
  toCommitHistoryDto,
  toPinnedDto,
  toReviewHistoryDto,
  toReviewRequestsDto,
  toOpenPrsDto,
  toWeekReviewDto,
  WeekFocusInputSchema,
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
    pinnedIds: ["nexus"],
    topics: [
      {
        id: "nexus",
        name: "NEXUS",
        owner: "personal",
        kind: "wlasny",
        companyData: false,
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
        projectId: "nexus",
        name: "NEXUS",
        owner: "personal",
        kind: "etat",
        companyData: true,
        items: [],
      },
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
            source: { type: "task", taskId: "t1" },
          },
          {
            kind: "undated",
            title: "Z projektu",
            due: null,
            projectName: null,
            priority: null,
            energy: null,
            project: { id: "monolith", name: "Monolith", kind: "wlasny", companyData: false },
            source: { type: "task", taskId: "t2" },
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
        link: "https://meet.google.com/abc-defg-hij",
        brief: "Punkt 1\nPunkt 2",
      },
    ],
    nextMeeting: {
      date: "2026-11-18",
      title: "Spotkanie",
      startMinutes: 570,
      durationMinutes: 30,
      link: "https://meet.google.com/abc-defg-hij",
    },
    git: { commitsToday: 4, projectsWithCommits: 2, branch: "main" },
    inbox: { open: 3 },
    windows: [
      { startMinutes: 540, endMinutes: 615, energy: "deep", title: "Porty", projectName: "NEXUS" },
    ],
    closing: {
      anchor: { date: "2026-11-12", text: "Zacząć od K6", projectId: "nexus", commits: 4 },
      today: null,
    },
    weekFocus: { weekStart: "2026-11-16", text: "Domknąć tagi" },
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
      "pinnedIds",
      "queue",
      "topics",
      "warnings",
      "weekFocus",
      "windows",
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
      totalPrs: 1,
      days: [
        { date: "2026-11-12", total: 0, prs: 0, projects: [] },
        {
          date: "2026-11-13",
          total: 2,
          prs: 1,
          projects: [{ projectId: "a", name: "A", count: 2 }],
        },
      ],
    };
    const dto = toCommitHistoryDto({ ...model, extra: 1 } as never);
    expect(dto).toEqual(model);
    expect(Object.keys(dto).sort()).toEqual([
      "available",
      "days",
      "from",
      "to",
      "total",
      "totalPrs",
    ]);
  });
});

describe("CompleteQueueItemSchema", () => {
  it("przyjmuje zadanie ogólne i zadanie projektu", () => {
    expect(CompleteQueueItemSchema.parse({ type: "task", taskId: " t1 " })).toMatchObject({
      type: "task",
      taskId: "t1",
    });
    expect(
      CompleteQueueItemSchema.parse({ type: "project", projectId: "nexus", text: "Porty #deep" })
    ).toMatchObject({ type: "project", projectId: "nexus", text: "Porty #deep" });
  });

  it.each([
    [{}],
    [{ type: "task" }],
    [{ type: "task", taskId: " " }],
    [{ type: "project", projectId: "a" }],
    [{ type: "project", text: "t" }],
    [{ type: "inne", taskId: "x" }],
  ])("odrzuca %j", (body) => {
    expect(CompleteQueueItemSchema.safeParse(body).success).toBe(false);
  });
});

describe("toReviewRequestsDto", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    author: null,
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    state: "open" as const,
  };

  it("kopiuje pola i odrzuca nadmiarowe", () => {
    const dto = toReviewRequestsDto({
      available: true,
      total: 7,
      items: [{ ...item, extra: 1 }],
    } as never);
    expect(dto).toEqual({ available: true, total: 7, items: [item] });
  });

  it("niedostępny GitHub: available false, pusta lista", () => {
    expect(toReviewRequestsDto({ available: false, total: 0, items: [] })).toEqual({
      available: false,
      total: 0,
      items: [],
    });
  });
});

describe("toReviewHistoryDto", () => {
  const history = {
    from: "2026-11-10",
    to: "2026-11-11",
    available: true,
    approved: 2,
    comments: 1,
    prs: 2,
    days: [
      { date: "2026-11-10", approved: 2, comments: 0 },
      { date: "2026-11-11", approved: 0, comments: 1 },
    ],
  };

  it("kopiuje pola i odrzuca nadmiarowe", () => {
    const dto = toReviewHistoryDto({
      ...history,
      extra: 1,
      days: history.days.map((d) => ({ ...d, extra: 1 })),
    } as never);
    expect(dto).toEqual(history);
  });
});

describe("WeekFocusInputSchema", () => {
  it("limit 300 znaków (jak MAX_FOCUS_TEXT w services, pilnuje go test serwisu)", () => {
    expect(WeekFocusInputSchema.safeParse({ text: "a".repeat(300) }).success).toBe(true);
    expect(WeekFocusInputSchema.safeParse({ text: "a".repeat(301) }).success).toBe(false);
  });

  it("pusty tekst i brak pola to błąd; spacje są przycinane", () => {
    expect(WeekFocusInputSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(WeekFocusInputSchema.safeParse({}).success).toBe(false);
    const ok = WeekFocusInputSchema.safeParse({ text: "  Tagi " });
    expect(ok.success && ok.data.text).toBe("Tagi");
  });
});

describe("toOpenPrsDto", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: true,
  };

  it("kopiuje pola i odrzuca nadmiarowe", () => {
    const dto = toOpenPrsDto({
      available: true,
      total: 7,
      items: [{ ...item, extra: 1 }],
    } as never);
    expect(dto).toEqual({ available: true, total: 7, items: [item] });
  });
});

describe("toWeekReviewDto", () => {
  it("kopiuje kształt i nie wpuszcza dodatkowych pól", () => {
    const review = {
      from: "2026-11-10",
      to: "2026-11-16",
      weekStart: "2026-11-16",
      git: { available: true, commits: 5, prs: 1 },
      projects: [
        {
          projectId: "m",
          name: "Monolith",
          work: false,
          commits: 5,
          prs: 1,
          subjects: ["feat: a"],
          doneTasks: ["Z"],
        },
      ],
      closings: [{ date: "2026-11-12", text: null, projectId: "f" }],
      reviews: { available: true, approved: 1, comments: 2, prs: 3 },
      meetings: { count: 2, minutes: 90 },
      containsWork: true,
      prompt: "# P",
    };
    expect(toWeekReviewDto({ ...review, extra: "x" } as typeof review)).toEqual(review);
  });
});
