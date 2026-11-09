import { z } from "zod";

export const CreateCalendarEventBodySchema = z
  .object({
    date: z.unknown().optional(),
    start_minutes: z.unknown().optional(),
    duration_minutes: z.unknown().optional(),
    title: z.unknown().optional(),
    tags: z.unknown().optional(),
    color: z.unknown().optional(),
    type: z.unknown().optional(),
  })
  .superRefine((body, ctx) => {
    const missingDuration = body.duration_minutes === undefined || body.duration_minutes === null;
    if (!body.date || missingDuration) {
      ctx.addIssue("date and duration_minutes required");
    }
  });

export const UpdateCalendarEventBodySchema = z.object({
  date: z.unknown().optional(),
  start_minutes: z.unknown().optional(),
  duration_minutes: z.unknown().optional(),
  title: z.unknown().optional(),
  tags: z.unknown().optional(),
  color: z.unknown().optional(),
  type: z.unknown().optional(),
});
