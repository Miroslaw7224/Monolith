export type ItemStatus = "todo" | "pass" | "fail";

export interface TextLine {
  type: "text";
  raw: string;
}

export interface ItemLine {
  type: "item";
  /** Wcięcie dokładnie jak w źródle. */
  indent: string;
  status: ItemStatus;
  text: string;
  /** Linie komentarza dokładnie jak w źródle (round-trip bajt w bajt). */
  commentRaw: string[];
}

export type ChecklistLine = TextLine | ItemLine;

export interface ChecklistModel {
  lines: ChecklistLine[];
}

const ITEM_RE = /^(\s*)- \[( |x|!)\] (.*)$/;
const COMMENT_RE = /^(\s*)> ?(.*)$/;
const MARK: Record<ItemStatus, string> = { todo: " ", pass: "x", fail: "!" };
const FROM_MARK: Record<string, ItemStatus> = { " ": "todo", x: "pass", "!": "fail" };
const EXPORT_LABEL: Record<ItemStatus, string> = {
  pass: "✅ PASS",
  fail: "❌ FAIL",
  todo: "⬜ nie sprawdzono",
};

export function parseChecklist(desc: string): ChecklistModel {
  const lines: ChecklistLine[] = [];
  let current: ItemLine | null = null;
  for (const raw of desc.split("\n")) {
    const match = ITEM_RE.exec(raw);
    if (match) {
      current = {
        type: "item",
        indent: match[1],
        status: FROM_MARK[match[2]],
        text: match[3],
        commentRaw: [],
      };
      lines.push(current);
      continue;
    }
    if (current && COMMENT_RE.test(raw)) {
      current.commentRaw.push(raw);
      continue;
    }
    current = null;
    lines.push({ type: "text", raw });
  }
  return { lines };
}

export function serializeChecklist(model: ChecklistModel): string {
  return model.lines
    .flatMap((line) =>
      line.type === "text"
        ? [line.raw]
        : [`${line.indent}- [${MARK[line.status]}] ${line.text}`, ...line.commentRaw]
    )
    .join("\n");
}

export function itemLevel(item: ItemLine): number {
  return Math.floor(item.indent.length / 2);
}

export function itemComment(item: ItemLine): string {
  return item.commentRaw.map((raw) => COMMENT_RE.exec(raw)?.[2] ?? "").join("\n");
}

export function cycleStatus(status: ItemStatus): ItemStatus {
  if (status === "todo") return "pass";
  if (status === "pass") return "fail";
  return "todo";
}

function replaceLine(model: ChecklistModel, index: number, line: ChecklistLine): ChecklistModel {
  return { lines: model.lines.map((l, i) => (i === index ? line : l)) };
}

export function setItemStatus(
  model: ChecklistModel,
  index: number,
  status: ItemStatus
): ChecklistModel {
  const line = model.lines[index];
  if (!line || line.type !== "item" || line.status === status) return model;
  return replaceLine(model, index, { ...line, status });
}

export function setItemComment(
  model: ChecklistModel,
  index: number,
  comment: string
): ChecklistModel {
  const line = model.lines[index];
  if (!line || line.type !== "item" || itemComment(line) === comment) return model;
  const commentRaw =
    comment === "" ? [] : comment.split("\n").map((part) => `${line.indent}  > ${part}`);
  return replaceLine(model, index, { ...line, commentRaw });
}

/** Opis do skopiowania: wszystkie punkty wracają do `todo`, komentarze znikają, reszta bez zmian. */
export function resetChecklist(desc: string): string {
  const model = parseChecklist(desc);
  return serializeChecklist({
    lines: model.lines.map((line) =>
      line.type === "item" ? { ...line, status: "todo", commentRaw: [] } : line
    ),
  });
}

export function countItems(model: ChecklistModel): { pass: number; fail: number; todo: number } {
  const counts = { pass: 0, fail: 0, todo: 0 };
  for (const line of model.lines) if (line.type === "item") counts[line.status] += 1;
  return counts;
}

export function summarize(model: ChecklistModel): string {
  const { pass, fail, todo } = countItems(model);
  return `PASS ${pass} · FAIL ${fail} · pozostało ${todo}`;
}

export function exportMarkdown(title: string, desc: string): string {
  const model = parseChecklist(desc);
  const intro = model.lines
    .flatMap((line) => (line.type === "text" ? [line.raw] : []))
    .join("\n")
    .trim();
  const items = model.lines.filter((line): line is ItemLine => line.type === "item");

  const parts = [`# ${title}`];
  if (intro) parts.push(intro);
  if (items.length > 0) {
    parts.push(summarize(model));
    const body = items.flatMap((it) => {
      const pad = "  ".repeat(itemLevel(it));
      const comment = itemComment(it);
      return [
        `${pad}- ${EXPORT_LABEL[it.status]} ${it.text}`,
        ...(comment ? comment.split("\n").map((part) => `${pad}  > ${part}`) : []),
      ];
    });
    parts.push(body.join("\n"));
  }
  return parts.join("\n\n");
}
