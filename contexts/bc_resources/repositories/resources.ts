import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import type { Resource } from "../models";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "@/lib/nexus/record-helpers";

const FILE = "Resources/resources.yaml";
const KEY = "resources";

function toResource(record: YamlRecord): Resource {
  return {
    id: str(record.id),
    noteId: optStr(record.note_id),
    description: str(record.description),
    url: str(record.url),
    title: str(record.title),
    thumbnailUrl: optStr(record.thumbnail_url),
    tags: Array.isArray(record.tags) ? record.tags.map((t) => str(t)) : [],
    isFavorite: record.favorite === true,
    createdAt: optStr(record.created),
    updatedAt: optStr(record.updated),
  };
}

export async function addResource(
  data: Omit<Resource, "id" | "createdAt" | "updatedAt">
): Promise<Resource> {
  const record = await appendRecord(FILE, KEY, (taken) => {
    const now = nowIso(); // wewnątrz build: ponowienie po konflikcie dostaje świeży czas
    return {
      id: generateId(taken),
      title: data.title,
      url: data.url,
      description: data.description,
      tags: data.tags ?? [],
      favorite: data.isFavorite ?? false,
      ...(data.thumbnailUrl != null ? { thumbnail_url: data.thumbnailUrl } : {}),
      ...(data.noteId != null ? { note_id: data.noteId } : {}),
      created: now,
      updated: now,
    };
  });
  return toResource(record);
}

export async function getResources(): Promise<Resource[]> {
  const list = readList(FILE, KEY).map((record) => toResource(record));
  return sortByCreated(list, (r) => r.createdAt, "desc");
}

export async function deleteResource(resourceId: string): Promise<void> {
  await removeRecord(FILE, KEY, resourceId);
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
  const patch: Record<string, unknown> = { updated: nowIso() };
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.url !== undefined) patch.url = data.url.trim();
  if (data.tags !== undefined) patch.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.isFavorite !== undefined) patch.favorite = data.isFavorite;
  await patchRecord(FILE, KEY, resourceId, patch, "Resource not found");
}
