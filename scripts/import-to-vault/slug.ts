import { createHash } from "node:crypto";

export { slugify, allocateName } from "../../lib/nexus/slug";

/** Bezpieczna nazwa pliku oryginału HTML (bez rozszerzenia), deterministyczna i bez kolizji. */
export function htmlFileName(id: string): string {
  if (/^[A-Za-z0-9_-]{1,128}$/.test(id)) return id;
  const safe = id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  const hash = createHash("sha1").update(id).digest("hex").slice(0, 8);
  return `${safe}-${hash}`;
}
