import { z } from "zod";

export const OpenLinkSchema = z.object({ url: z.string().min(1).max(2048) });
export type OpenLinkInput = z.infer<typeof OpenLinkSchema>;
