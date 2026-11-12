import {
  addResourceToFirestore,
  getResourcesFromFirestore,
  deleteResourceFromFirestore,
  updateResourceInFirestore,
  type NoteResourceRecord,
} from "@/lib/firestore-db";

// -----------------------------------------------
// CRUD (zasoby na poziomie użytkownika, niezależne od notatek)
// -----------------------------------------------

export async function addResource(data: {
  description: string;
  url: string;
  tags?: string[];
  noteId?: string;
}): Promise<NoteResourceRecord> {
  const { title, thumbnailUrl } = await fetchPageMetadata(data.url);
  const resource = await addResourceToFirestore({
    description: data.description,
    url: data.url,
    title,
    thumbnailUrl,
    tags: data.tags ?? [],
    ...(data.noteId != null && { noteId: data.noteId }),
  });
  return resource;
}

export async function getResources(): Promise<NoteResourceRecord[]> {
  return getResourcesFromFirestore();
}

export async function deleteResource(resourceId: string): Promise<void> {
  return deleteResourceFromFirestore(resourceId);
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
  return updateResourceInFirestore(resourceId, data);
}

// -----------------------------------------------
// Pobieranie metadanych strony
// -----------------------------------------------

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

// -----------------------------------------------
// Integracja z RAG (keyword search)
// -----------------------------------------------

export async function searchResources(keywords: string[]): Promise<NoteResourceRecord[]> {
  const allResources = await getResourcesFromFirestore();

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
