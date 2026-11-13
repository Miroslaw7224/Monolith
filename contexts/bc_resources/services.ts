import * as repositories from "./repositories";
import type { Resource } from "./models";

// ── zasoby ──────────────────────────────────────────────────────────────────────

export async function addResource(data: {
  description: string;
  url: string;
  tags?: string[];
  noteId?: string;
}): Promise<Resource> {
  const { title, thumbnailUrl } = await fetchPageMetadata(data.url);
  return repositories.addResource({
    description: data.description,
    url: data.url,
    title,
    thumbnailUrl,
    tags: data.tags ?? [],
    ...(data.noteId != null && { noteId: data.noteId }),
  });
}

export async function getResources(): Promise<Resource[]> {
  return repositories.getResources();
}

export async function deleteResource(resourceId: string): Promise<void> {
  return repositories.deleteResource(resourceId);
}

export async function updateResource(
  resourceId: string,
  data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  return repositories.updateResource(resourceId, data);
}

async function fetchPageMetadata(url: string): Promise<{ title: string; thumbnailUrl?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    return {
      title: titleMatch?.[1]?.trim() ?? url,
      thumbnailUrl: ogImage?.[1],
    };
  } catch {
    return { title: url };
  }
}

/** Wyszukiwanie po słowach kluczowych (opis, tytuł, tagi); puste `keywords` = wszystkie. */
export async function searchResources(keywords: string[]): Promise<Resource[]> {
  const allResources = await repositories.getResources();

  if (keywords.length === 0) {
    return allResources;
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  return allResources.filter((r) => {
    const desc = (r.description ?? "").toLowerCase();
    const title = (r.title ?? "").toLowerCase();
    const tagStr = (r.tags ?? []).join(" ").toLowerCase();
    return lowerKeywords.some((k) => desc.includes(k) || title.includes(k) || tagStr.includes(k));
  });
}

// ── dokumenty ───────────────────────────────────────────────────────────────────

export async function listDocuments() {
  return repositories.getDocuments();
}

export async function ingestDocument(data: { name: string; content: string; type: string }) {
  const { id } = await repositories.createDocument(data);
  return { id, name: data.name };
}

export async function deleteDocument(id: string) {
  return repositories.deleteDocument(id);
}
