import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { CreateMindMapBodySchema, SaveMindMapBodySchema, toMindMapDto } from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listMindMaps(): Promise<NextResponse> {
  try {
    const maps = await services.getMindMaps();
    return NextResponse.json(maps.map(toMindMapDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createMindMap(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateMindMapBodySchema);
  if (parsed.success === false) return parsed.response;

  try {
    const map = await services.createMindMap(parsed.data.title ?? "");
    return NextResponse.json(toMindMapDto(map), { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getMindMap(_request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const map = await services.getMindMap(id);
    return NextResponse.json(toMindMapDto(map));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function saveMindMap(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, SaveMindMapBodySchema);
  if (parsed.success === false) return parsed.response;

  try {
    await services.saveMindMap(id, {
      title: parsed.data.title,
      rootNode: parsed.data.rootNode,
      colWidths: parsed.data.colWidths,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteMindMap(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteMindMap(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
