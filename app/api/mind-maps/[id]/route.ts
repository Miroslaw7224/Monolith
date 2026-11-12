import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import * as mindMapService from "@/services/mindMapService";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    note: z.string(),
    collapsed: z.boolean(),
    children: z.array(MindMapNodeSchema),
  })
);

const SaveMindMapBodySchema = z.object({
  title: z.string().optional(),
  rootNode: MindMapNodeSchema.optional(),
  colWidths: z.record(z.string(), z.coerce.number()).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const map = await mindMapService.getMindMap(id);
    return NextResponse.json(map);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = await parseBody(request, SaveMindMapBodySchema);
  if (parsed.success === false) return parsed.response;

  try {
    await mindMapService.saveMindMap(id, {
      title: parsed.data.title,
      rootNode: parsed.data.rootNode,
      colWidths: parsed.data.colWidths,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await mindMapService.deleteMindMap(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
