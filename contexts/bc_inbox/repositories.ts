import { readVaultFile, updateVaultFile } from "@/lib/nexus/vault-fs";
import { INBOX_TYPES, type InboxItem, type InboxType } from "./models";

const FILE = "Inbox/inbox.md";
const LINE = /^- \[( |x|X)\] (.*)$/;
const FIELDS = /^(.*) \[type:: ([^\]]*)\] \[at:: ([^\]]*)\]$/;

/** Prosty, deterministyczny skrót linii (id wpisu); nie służy bezpieczeństwu. */
function hash(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function isClosed(raw: string): boolean {
  const m = LINE.exec(raw);
  return m !== null && m[1] !== " ";
}

type ParsedLine = { index: number; item: InboxItem };

/** Otwarte linie z ich numerem w pliku; id = skrót linii (identyczne linie mają to samo id, więc id nie przesuwa się po zamknięciu sąsiada). */
function parseOpen(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  text.split("\n").forEach((raw, index) => {
    const m = LINE.exec(raw);
    if (!m || m[1] !== " ") return;
    const f = FIELDS.exec(m[2]);
    const type =
      f && (INBOX_TYPES as readonly string[]).includes(f[2]) ? (f[2] as InboxType) : "myśl";
    out.push({
      index,
      item: {
        id: hash(raw),
        text: (f ? f[1] : m[2]).trim(),
        type,
        at: f && f[3].trim() !== "" ? f[3].trim() : null,
      },
    });
  });
  return out;
}

/** Otwarte wpisy w kolejności pliku; brak pliku to pusta lista. */
export function readOpenItems(): InboxItem[] {
  const file = readVaultFile(FILE);
  return file ? parseOpen(file.text).map((p) => p.item) : [];
}

/** Dopisuje linię na końcu pliku; reszty treści nie zmienia. Zwraca wpis z jego id. */
export async function appendItem(item: Omit<InboxItem, "id">): Promise<InboxItem> {
  const line = `- [ ] ${item.text} [type:: ${item.type}] [at:: ${item.at ?? ""}]`;
  await updateVaultFile(FILE, (current) => {
    const base = current ?? "";
    return `${base === "" || base.endsWith("\n") ? base : `${base}\n`}${line}\n`;
  });
  return { id: hash(line), ...item };
}

/** Zmienia `[ ]` na `[x]` w pierwszej otwartej linii o danym id; `false`, gdy nie ma otwartego wpisu o tym id. */
export async function resolveItem(id: string): Promise<boolean> {
  let found = false;
  await updateVaultFile(FILE, (current) => {
    found = false;
    if (current === null) return "";
    const target = parseOpen(current).find((p) => p.item.id === id);
    if (!target) return current;
    found = true;
    const lines = current.split("\n");
    lines[target.index] = lines[target.index].replace(/^- \[ \]/, "- [x]");
    return lines.join("\n");
  });
  return found;
}

/** Usuwa z pliku pierwszą otwartą linię o danym id (reszta pliku bez zmian); `false`, gdy jej nie ma. */
export async function removeItem(id: string): Promise<boolean> {
  let found = false;
  await updateVaultFile(FILE, (current) => {
    found = false;
    if (current === null) return "";
    const target = parseOpen(current).find((p) => p.item.id === id);
    if (!target) return current;
    found = true;
    const lines = current.split("\n");
    lines.splice(target.index, 1);
    return lines.join("\n");
  });
  return found;
}

/** Liczba zamkniętych linii (`[x]`/`[X]`); brak pliku to 0. */
export function countClosedItems(): number {
  const file = readVaultFile(FILE);
  return file ? file.text.split("\n").filter(isClosed).length : 0;
}

/** Trwale usuwa wszystkie zamknięte linie (reszta pliku bez zmian); zwraca ich liczbę. */
export async function removeClosedItems(): Promise<number> {
  let removed = 0;
  await updateVaultFile(FILE, (current) => {
    removed = 0;
    if (current === null) return "";
    const kept = current.split("\n").filter((raw) => !isClosed(raw));
    removed = current.split("\n").length - kept.length;
    return removed === 0 ? current : kept.join("\n");
  });
  return removed;
}
