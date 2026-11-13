import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { Cockpit, DayEvent, Pinned, QueueGroup, Topic } from "./models";

// ── wejście ────────────────────────────────────────────────────────────────────

/** Limit 3 = `MAX_PINNED` z `models` (schemas nie importuje wartości z models; zgodność pilnuje test). */
export const PinnedInputSchema = looseObject({
  ids: z.array(z.string().trim().min(1, "id required")).max(3, "Maksymalnie 3 aktywne tematy"),
}).superRefine((body, ctx) => {
  if (new Set(body.ids).size !== body.ids.length) ctx.addIssue("Powtórzone id projektu");
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type TopicDto = Topic;
export type QueueGroupDto = QueueGroup;
export type DayEventDto = DayEvent;
export type CockpitDto = Cockpit;
export type PinnedDto = Pinned;

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
    })),
    queue: c.queue.map((g) => ({
      projectId: g.projectId,
      name: g.name,
      owner: g.owner,
      items: g.items.map((i) => ({ kind: i.kind, title: i.title, due: i.due })),
    })),
    events: c.events.map((e) => ({
      id: e.id,
      title: e.title,
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      type: e.type,
      color: e.color,
    })),
    warnings: [...c.warnings],
  };
}

export function toPinnedDto(p: Pinned): PinnedDto {
  return { ids: [...p.ids] };
}
