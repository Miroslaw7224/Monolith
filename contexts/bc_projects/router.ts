import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { toDetailDto, toSummaryDto } from "./schemas";
import * as services from "./services";

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
