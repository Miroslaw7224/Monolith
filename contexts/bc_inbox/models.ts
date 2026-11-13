export const INBOX_TYPES = ["myśl", "link", "bug", "snippet"] as const;
export type InboxType = (typeof INBOX_TYPES)[number];

/** Wpis `Inbox/inbox.md`: jedna otwarta linia `- [ ] <tekst> [type:: …] [at:: …]`. */
export type InboxItem = {
  /** Skrót linii (+ numer powtórzenia); zmienia się, gdy ktoś edytuje linię ręcznie. */
  id: string;
  text: string;
  type: InboxType;
  /** Lokalny znacznik czasu `RRRR-MM-DDTHH:mm`; `null` dla linii dopisanych ręcznie. */
  at: string | null;
};

export const MAX_INBOX_TEXT = 500;
