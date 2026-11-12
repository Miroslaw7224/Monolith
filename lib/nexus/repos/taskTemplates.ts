import type { TaskTemplateRecord } from "@/types/records";
import type { YamlRecord } from "../yaml-lists";
import { readList } from "../yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "../record-helpers";

const FILE = "Tasks/templates.yaml";
const KEY = "templates";

const link = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function toTemplate(record: YamlRecord): TaskTemplateRecord {
  return {
    id: str(record.id),
    label: str(record.label).trim(),
    title: str(record.title).trim(),
    link: link(record.link),
    created_at: optStr(record.created),
  };
}

export async function getTaskTemplates(): Promise<TaskTemplateRecord[]> {
  return sortByCreated(readList(FILE, KEY).map(toTemplate), (t) => t.created_at, "asc");
}

export async function createTaskTemplate(data: {
  label: string;
  title: string;
  link?: string;
}): Promise<TaskTemplateRecord> {
  const record = await appendRecord(FILE, KEY, (taken) => ({
    id: generateId(taken),
    label: str(data.label).trim(),
    title: str(data.title).trim(),
    link: link(data.link),
    created: nowIso(),
  }));
  return toTemplate(record);
}

export async function updateTaskTemplate(
  templateId: string,
  data: { label?: string; title?: string; link?: string }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.label !== undefined) patch.label = str(data.label).trim();
  if (data.title !== undefined) patch.title = str(data.title).trim();
  if (data.link !== undefined) patch.link = link(data.link);
  if (Object.keys(patch).length === 0) return;
  await patchRecord(FILE, KEY, templateId, patch, "Template not found");
}

export async function deleteTaskTemplate(templateId: string): Promise<void> {
  await removeRecord(FILE, KEY, templateId);
}
