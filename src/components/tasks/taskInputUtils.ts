export function parseTaskInput(raw: string): { title: string; description: string } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] ?? "";
  const description = lines.slice(1).join("\n").trim();
  return { title, description };
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

export function matchTaskSearch(
  task: { title: string; description: string },
  query: string
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = `${task.title}\n${task.description}`.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}
