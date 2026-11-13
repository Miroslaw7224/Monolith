import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type {
  Closing,
  Cockpit,
  CommitHistory,
  DayEvent,
  Pinned,
  QueueGroup,
  Topic,
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

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type TopicDto = Topic;
export type QueueGroupDto = QueueGroup;
export type DayEventDto = DayEvent;
export type CockpitDto = Cockpit;
export type PinnedDto = Pinned;
export type ClosingDto = Closing;
export type CommitHistoryDto = CommitHistory;

export function toCockpitDto(c: Cockpit): CockpitDto {
  return {
    date: c.date,
    topics: c.topics.map((t) => ({
      id: t.id,
      name: t.name,
      owner: t.owner,
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
      items: g.items.map((i) => ({
        kind: i.kind,
        title: i.title,
        due: i.due,
        projectName: i.projectName,
        priority: i.priority,
      })),
    })),
    events: c.events.map((e) => ({
      id: e.id,
      title: e.title,
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      type: e.type,
      color: e.color,
    })),
    nextMeeting: c.nextMeeting ? { ...c.nextMeeting } : null,
    git: c.git ? { ...c.git } : null,
    closing: {
      anchor: c.closing.anchor ? toClosingDto(c.closing.anchor) : null,
      today: c.closing.today ? toClosingDto(c.closing.today) : null,
    },
    warnings: [...c.warnings],
  };
}

export function toClosingDto(c: Closing): ClosingDto {
  return { date: c.date, text: c.text, projectId: c.projectId, commits: c.commits };
}

export function toCommitHistoryDto(h: CommitHistory): CommitHistoryDto {
  return {
    from: h.from,
    to: h.to,
    available: h.available,
    total: h.total,
    days: h.days.map((d) => ({
      date: d.date,
      total: d.total,
      projects: d.projects.map((p) => ({ projectId: p.projectId, name: p.name, count: p.count })),
    })),
  };
}

export function toPinnedDto(p: Pinned): PinnedDto {
  return { ids: [...p.ids] };
}
