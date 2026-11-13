import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { InboxItem } from "./models";

/** Limit 500 = `MAX_INBOX_TEXT` z models (schemas nie importuje wartości z models; zgodność pilnuje test). */
export const CreateInboxItemSchema = looseObject({
  text: z.string().trim().min(1, "text required").max(500, "Maksymalnie 500 znaków"),
});

export type InboxItemDto = InboxItem;
export type InboxDto = { items: InboxItemDto[]; open: number };

export function toInboxItemDto(i: InboxItem): InboxItemDto {
  return { id: i.id, text: i.text, type: i.type, at: i.at };
}

export function toInboxDto(items: InboxItem[]): InboxDto {
  return { items: items.map(toInboxItemDto), open: items.length };
}
