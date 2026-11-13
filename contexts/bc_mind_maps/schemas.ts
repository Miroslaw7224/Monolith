import { z } from "zod";
import type { MindMap, MindMapNode } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    note: z.string(),
    collapsed: z.boolean(),
    children: z.array(MindMapNodeSchema),
  })
);

export const CreateMindMapBodySchema = z.object({
  title: z.string().optional(),
});

export const SaveMindMapBodySchema = z.object({
  title: z.string().optional(),
  rootNode: MindMapNodeSchema.optional(),
  colWidths: z.record(z.string(), z.coerce.number()).optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export interface MindMapNodeDto {
  id: string;
  label: string;
  note: string;
  collapsed: boolean;
  children: MindMapNodeDto[];
}

export interface MindMapDto {
  id: string;
  title: string;
  rootNode: MindMapNodeDto;
  /** Szerokości kolumn w px na poziom drzewa. */
  colWidths: Record<number, number>;
  createdAt?: string;
  updatedAt?: string;
}

export function toMindMapDto(map: MindMap): MindMapDto {
  return {
    id: map.id,
    title: map.title,
    rootNode: map.rootNode,
    colWidths: map.colWidths,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
  };
}
