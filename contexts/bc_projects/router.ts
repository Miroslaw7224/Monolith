import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  DevlogInputSchema,
  ProjectTypeInputSchema,
  StateInputSchema,
  toDetailDto,
  toSummaryDto,
} from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listProjects(): Promise<NextResponse> {
  try {
    const { projects, warnings } = services.listProjects();
    return NextResponse.json({
      projects: projects.map(toSummaryDto),
      warnings,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getProject(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const project = services.getProject(id);
    return NextResponse.json(toDetailDto(project));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function patchProject(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, ProjectTypeInputSchema);
    if (parsed.success === false) return parsed.response;
    const { id } = await ctx.params;
    const project = await services.setProjectType(id, parsed.data.type);
    return NextResponse.json(toDetailDto(project));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putProjectState(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, StateInputSchema);
    if (parsed.success === false) return parsed.response;
    const { id } = await ctx.params;
    // `strict: false`: zod oznacza pola z `null` jako opcjonalne w typie (runtime je wymaga), stąd jawne domknięcie.
    const project = await services.saveState(id, {
      ...parsed.data,
      version: parsed.data.version ?? null,
    });
    return NextResponse.json(toDetailDto(project));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postDevlog(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, DevlogInputSchema);
    if (parsed.success === false) return parsed.response;
    const { id } = await ctx.params;
    const project = await services.addDevlogEntry(id, {
      title: parsed.data.title,
      why: parsed.data.why ?? "",
    });
    return NextResponse.json(toDetailDto(project), { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
