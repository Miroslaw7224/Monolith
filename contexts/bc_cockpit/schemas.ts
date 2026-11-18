import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type {
  Closing,
  Cockpit,
  CommitHistory,
  DayEvent,
  DeepWindow,
  OpenPr,
  OpenPrs,
  Pinned,
  QueueGroup,
  ReviewHistory,
  ReviewRequest,
  ReviewRequests,
  Topic,
  WeekFocus,
  WeekReview,
} from "./models";

// ── wejście ────────────────────────────────────────────────────────────────────

/** Limit 3 = `MAX_PINNED` z `models` (schemas nie importuje wartości z models; zgodność pilnuje test). */
export const PinnedInputSchema = looseObject({
  ids: z.array(z.string().trim().min(1, "id required")).max(3, "Maksymalnie 3 aktywne tematy"),
}).superRefine((body, ctx) => {
  if (new Set(body.ids).size !== body.ids.length) ctx.addIssue("Powtórzone id projektu");
});

/** Limit 300 znaków = `MAX_CLOSING_TEXT` z services (zgodność pilnuje test). */
export const ClosingInputSchema = looseObject({
  text: z.string().trim().min(1, "text required").max(300, "Maksymalnie 300 znaków"),
  projectId: z.string().trim().min(1).nullish(),
});

/** Limit 300 znaków = `MAX_FOCUS_TEXT` z services (zgodność pilnuje test). */
export const WeekFocusInputSchema = looseObject({
  text: z.string().trim().min(1, "text required").max(300, "Maksymalnie 300 znaków"),
});

export const CompleteQueueItemSchema = looseObject({
  type: z.enum(["task", "project"]),
  taskId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  text: z.string().min(1).optional(),
  occurrence: z.number().int().min(0).optional(),
}).superRefine((body, ctx) => {
  if (body.type === "task" && !body.taskId) ctx.addIssue("taskId required");
  if (body.type === "project" && (!body.projectId || !body.text)) {
    ctx.addIssue("projectId and text required");
  }
});

export const SetQueueEnergySchema = looseObject({
  type: z.enum(["task", "project"]),
  taskId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  text: z.string().min(1).optional(),
  occurrence: z.number().int().min(0).optional(),
  energy: z.enum(["deep", "quick"]).nullable(),
}).superRefine((body, ctx) => {
  if (body.type === "task" && !body.taskId) ctx.addIssue("taskId required");
  if (body.type === "project" && (!body.projectId || !body.text)) {
    ctx.addIssue("projectId and text required");
  }
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type TopicDto = Topic;
export type QueueGroupDto = QueueGroup;
export type DayEventDto = DayEvent;
export type DeepWindowDto = DeepWindow;
export type CockpitDto = Cockpit;
export type PinnedDto = Pinned;
export type ClosingDto = Closing;
export type WeekFocusDto = WeekFocus;
export type WeekReviewDto = WeekReview;
export type CommitHistoryDto = CommitHistory;
export type ReviewHistoryDto = ReviewHistory;
export type ReviewRequestDto = ReviewRequest;
export type ReviewRequestsDto = ReviewRequests;
export type OpenPrDto = OpenPr;
export type OpenPrsDto = OpenPrs;

export function toCockpitDto(c: Cockpit): CockpitDto {
  return {
    date: c.date,
    pinnedIds: [...c.pinnedIds],
    topics: c.topics.map((t) => ({
      id: t.id,
      name: t.name,
      owner: t.owner,
      kind: t.kind,
      companyData: t.companyData,
      freshness: t.freshness,
      source: t.source,
      nextStep: t.nextStep,
      blocker: t.blocker,
      whereIStopped: t.whereIStopped,
      branch: t.branch,
      lastActivity: t.lastActivity,
      confidence: t.confidence,
      nowCount: t.nowCount,
      bugCount: t.bugCount,
    })),
    queue: c.queue.map((g) => ({
      projectId: g.projectId,
      name: g.name,
      owner: g.owner,
      ...(g.kind !== undefined ? { kind: g.kind, companyData: g.companyData ?? false } : {}),
      items: g.items.map((i) => ({
        kind: i.kind,
        title: i.title,
        due: i.due,
        projectName: i.projectName,
        priority: i.priority,
        energy: i.energy,
        ...(i.urgent ? { urgent: true } : {}),
        ...(i.project
          ? {
              project: {
                id: i.project.id,
                name: i.project.name,
                kind: i.project.kind,
                companyData: i.project.companyData,
              },
            }
          : {}),
        source:
          i.source.type === "task"
            ? { type: "task", taskId: i.source.taskId }
            : {
                type: "project",
                projectId: i.source.projectId,
                text: i.source.text,
                occurrence: i.source.occurrence,
              },
      })),
    })),
    events: c.events.map((e) => ({
      id: e.id,
      title: e.title,
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      type: e.type,
      color: e.color,
      link: e.link,
      brief: e.brief,
    })),
    nextMeeting: c.nextMeeting ? { ...c.nextMeeting } : null,
    git: c.git ? { ...c.git } : null,
    inbox: c.inbox ? { open: c.inbox.open } : null,
    windows: c.windows.map((w) => ({
      startMinutes: w.startMinutes,
      endMinutes: w.endMinutes,
      energy: w.energy,
      title: w.title,
      projectName: w.projectName,
    })),
    closing: {
      anchor: c.closing.anchor ? toClosingDto(c.closing.anchor) : null,
      today: c.closing.today ? toClosingDto(c.closing.today) : null,
    },
    weekFocus: c.weekFocus ? toWeekFocusDto(c.weekFocus) : null,
    warnings: [...c.warnings],
  };
}

export function toClosingDto(c: Closing): ClosingDto {
  return { date: c.date, text: c.text, projectId: c.projectId, commits: c.commits };
}

export function toWeekFocusDto(w: WeekFocus): WeekFocusDto {
  return { weekStart: w.weekStart, text: w.text };
}

export function toCommitHistoryDto(h: CommitHistory): CommitHistoryDto {
  return {
    from: h.from,
    to: h.to,
    available: h.available,
    total: h.total,
    totalPrs: h.totalPrs,
    days: h.days.map((d) => ({
      date: d.date,
      total: d.total,
      prs: d.prs,
      projects: d.projects.map((p) => ({ projectId: p.projectId, name: p.name, count: p.count })),
    })),
  };
}

export function toReviewHistoryDto(h: ReviewHistory): ReviewHistoryDto {
  return {
    from: h.from,
    to: h.to,
    available: h.available,
    approved: h.approved,
    comments: h.comments,
    prs: h.prs,
    days: h.days.map((d) => ({ date: d.date, approved: d.approved, comments: d.comments })),
  };
}

export function toReviewRequestsDto(r: ReviewRequests): ReviewRequestsDto {
  return {
    available: r.available,
    total: r.total,
    items: r.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      author: i.author,
      url: i.url,
      updatedAt: i.updatedAt,
      state: i.state,
    })),
  };
}

export function toOpenPrsDto(r: OpenPrs): OpenPrsDto {
  return {
    available: r.available,
    total: r.total,
    items: r.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      url: i.url,
      updatedAt: i.updatedAt,
      draft: i.draft,
    })),
  };
}

export function toPinnedDto(p: Pinned): PinnedDto {
  return { ids: [...p.ids] };
}

export function toWeekReviewDto(r: WeekReview): WeekReviewDto {
  return {
    from: r.from,
    to: r.to,
    weekStart: r.weekStart,
    git: { available: r.git.available, commits: r.git.commits, prs: r.git.prs },
    projects: r.projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      work: p.work,
      commits: p.commits,
      prs: p.prs,
      subjects: [...p.subjects],
      doneTasks: [...p.doneTasks],
    })),
    closings: r.closings.map((c) => ({ date: c.date, text: c.text, projectId: c.projectId })),
    reviews: {
      available: r.reviews.available,
      approved: r.reviews.approved,
      comments: r.reviews.comments,
      prs: r.reviews.prs,
    },
    meetings: { count: r.meetings.count, minutes: r.meetings.minutes },
    containsWork: r.containsWork,
    prompt: r.prompt,
  };
}
