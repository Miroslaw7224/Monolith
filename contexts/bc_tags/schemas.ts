import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { UserTag } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const CreateTagBodySchema = looseObject({
  tag: z.unknown().optional(),
  title: z.unknown().optional(),
  color: z.unknown().optional(),
}).superRefine((body, ctx) => {
  if (typeof body.tag !== "string" || !body.tag.trim()) {
    ctx.addIssue("tag required");
  }
});

export const UpdateTagBodySchema = looseObject({
  tag: z.unknown().optional(),
  title: z.unknown().optional(),
  color: z.unknown().optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type UserTagDto = {
  id: string;
  tag: string;
  title: string;
  color?: string;
  created_at?: string;
};

export function toUserTagDto(tag: UserTag): UserTagDto {
  return {
    id: tag.id,
    tag: tag.tag,
    title: tag.title,
    color: tag.color,
    created_at: tag.created_at,
  };
}
