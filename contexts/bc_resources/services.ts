import { buildKnowledgeLinkIndex, normalizeHost } from "@/contexts/bc_nexus_docs/services";
import { resolveTags } from "@/contexts/bc_tags/services";
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
    tags: await resolveTags(data.tags ?? []),
    ...(data.noteId != null && { noteId: data.noteId }),
  });
}

function attachNotePaths(resources: Resource[]): Resource[] {
  if (resources.length === 0) return resources;
  let index: ReturnType<typeof buildKnowledgeLinkIndex>;
  try {
    index = buildKnowledgeLinkIndex();
  } catch {
    return resources; // most jest dodatkiem: lista zasobów ładuje się bez niego
  }
  return resources.map((r) => {
    const host = normalizeHost(r.url);
    const notePath =
      r.noteId !== undefined && index.paths.has(r.noteId)
        ? r.noteId
        : host !== null
          ? index.hostToPath.get(host)
          : undefined;
    return notePath === undefined ? r : { ...r, notePath };
  });
}

export async function getResources(): Promise<Resource[]> {
  return attachNotePaths(await repositories.getResources());
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
  return repositories.updateResource(resourceId, {
    ...data,
    ...(data.tags !== undefined && { tags: await resolveTags(data.tags) }),
  });
}

const BLOCKED_TITLE = /^(just a moment|attention required)/i;

/** Tytuł strony ochronnej (Cloudflare), nie właściwej treści. */
export function isBlockedTitle(title: string): boolean {
  return BLOCKED_TITLE.test(title.trim());
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
};

/** Dekodowanie w jednym przebiegu (bez podwójnego dekodowania); kod poza zakresem Unicode zostaje jak jest. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:(amp|lt|gt|quot|nbsp)|#(\d+)|#x([0-9a-f]+));/gi,
    (match, name?: string, dec?: string, hex?: string) => {
      if (name !== undefined) return NAMED_ENTITIES[name.toLowerCase()];
      const codePoint = dec !== undefined ? Number(dec) : parseInt(hex as string, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
  );
}

/** Host bez `www.` jako tytuł zastępczy; przy nieprawidłowym adresie sam adres. */
export function hostTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

async function fetchPageMetadata(url: string): Promise<{ title: string; thumbnailUrl?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const rawTitle = decodeHtmlEntities(titleMatch?.[1] ?? "").trim();
    return {
      title: rawTitle === "" ? url : isBlockedTitle(rawTitle) ? hostTitle(url) : rawTitle,
      thumbnailUrl: ogImage?.[1] ? decodeHtmlEntities(ogImage[1]) : undefined,
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
