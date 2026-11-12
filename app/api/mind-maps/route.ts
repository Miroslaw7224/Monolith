import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import * as mindMapService from "@/services/mindMapService";

const CreateMindMapBodySchema = z.object({
  title: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const maps = await mindMapService.getMindMaps();
    return NextResponse.json(maps);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateMindMapBodySchema);
  if (parsed.success === false) return parsed.response;

  try {
    const map = await mindMapService.createMindMap(parsed.data.title ?? "");
    return NextResponse.json(map, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
