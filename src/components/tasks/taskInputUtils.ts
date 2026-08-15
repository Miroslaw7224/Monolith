export function parseTaskInput(raw: string): { title: string; link: string; description: string } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] ?? "";
  const link = lines[1] ?? "";
  const description = lines.slice(2).join("\n").trim();
  return { title, link, description };
}

export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`
    );
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeTaskFields(task: { link?: string | null; description?: string | null }): {
  link: string;
  description: string;
} {
  let link = task.link?.trim() ?? "";
  let description = task.description?.trim() ?? "";
  if (!link && description) {
    const firstLine = description.split(/\r?\n/)[0]?.trim() ?? "";
    const rest = description.split(/\r?\n/).slice(1).join("\n").trim();
    if (firstLine && isHttpUrl(firstLine) && description === firstLine) {
      link = firstLine;
      description = rest;
    }
  }
  return { link, description };
}

export function matchTaskSearch(
  task: { title: string; link: string; description: string },
  query: string
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = `${task.title}\n${task.link}\n${task.description}`.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}
