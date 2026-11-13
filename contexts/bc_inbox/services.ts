import { DomainError, NotFoundError } from "@/lib/errors";
import { MAX_INBOX_TEXT, type InboxItem, type InboxType } from "./models";
import * as repositories from "./repositories";

const PREFIX = /^(bug|snippet|kod)(?::\s*|\s+)(.*)$/i;
const URL_ONLY = /^https?:\/\/\S+$/i;

/** Typ z treści: sam URL → link; prefiks `bug`/`snippet`/`kod` (i `:` lub spacja) jest zdejmowany. */
export function detectType(input: string): { type: InboxType; text: string } {
  const text = input.trim();
  if (URL_ONLY.test(text)) return { type: "link", text };
  const m = PREFIX.exec(text);
  if (m) return { type: m[1].toLowerCase() === "bug" ? "bug" : "snippet", text: m[2].trim() };
  return { type: "myśl", text };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Lokalny `RRRR-MM-DDTHH:mm` (jak `state.updated`). */
function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function addItem(input: string, now: Date = new Date()): Promise<InboxItem> {
  const { type, text } = detectType(input.replace(/\s+/g, " "));
  if (text === "") throw new DomainError("Wpisz treść wpisu");
  if (text.length > MAX_INBOX_TEXT) throw new DomainError(`Maksymalnie ${MAX_INBOX_TEXT} znaków`);
  const at = stamp(now);
  return repositories.appendItem({ text, type, at });
}

/** Otwarte wpisy, najnowsze (z końca pliku) pierwsze. */
export function listItems(): InboxItem[] {
  return [...repositories.readOpenItems()].reverse();
}

export function countOpen(): number {
  return repositories.readOpenItems().length;
}

export async function resolve(id: string): Promise<void> {
  if (!(await repositories.resolveItem(id)))
    throw new NotFoundError(`Nie ma otwartego wpisu ${id}`);
}
