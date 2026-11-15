import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  AgentEntryInputSchema,
  CourseInputSchema,
  DeployQuerySchema,
  MarkDeployedBodySchema,
  toAgentEntryDto,
  toAgentsDto,
  toCatalogDto,
  toCourseDto,
  toCoursesDto,
  toEntryDto,
  toInstructionsDto,
} from "./schemas";
import * as services from "./services";

type SlugContext = { params: Promise<{ slug: string }> };

export async function getCatalog(): Promise<NextResponse> {
  try {
    return NextResponse.json(toCatalogDto(services.listArsenal()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getDeployInstructions(
  request: Request,
  ctx: SlugContext
): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const query = DeployQuerySchema.safeParse({
    project: params.get("project"),
    mode: params.get("mode"),
  });
  if (!query.success) {
    return NextResponse.json({ error: "Nieprawidłowy projekt lub tryb" }, { status: 400 });
  }
  try {
    const { slug } = await ctx.params;
    return NextResponse.json(
      toInstructionsDto(services.getDeployInstructions(slug, query.data.project, query.data.mode))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postDeployed(request: Request, ctx: SlugContext): Promise<NextResponse> {
  const parsed = await parseBody(request, MarkDeployedBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    const { slug } = await ctx.params;
    const skill = await services.markDeployed(slug, parsed.data.project, parsed.data.mode);
    return NextResponse.json(toEntryDto(skill));
  } catch (err) {
    return handleServiceError(err);
  }
}

type CourseContext = { params: Promise<{ courseId: string }> };

export async function getCourses(): Promise<NextResponse> {
  try {
    return NextResponse.json(toCoursesDto(services.listCourses()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postCourse(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, CourseInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toCourseDto(await services.createCourse(parsed.data)), {
      status: 201,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putCourse(request: Request, ctx: CourseContext): Promise<NextResponse> {
  const parsed = await parseBody(request, CourseInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    const { courseId } = await ctx.params;
    return NextResponse.json(toCourseDto(await services.updateCourse(courseId, parsed.data)));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function removeCourse(_request: Request, ctx: CourseContext): Promise<NextResponse> {
  try {
    const { courseId } = await ctx.params;
    await services.deleteCourse(courseId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}

type EntryContext = { params: Promise<{ entryId: string }> };

export async function getAgents(): Promise<NextResponse> {
  try {
    return NextResponse.json(toAgentsDto(services.listAgents()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postAgentEntry(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, AgentEntryInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toAgentEntryDto(await services.createAgentEntry(parsed.data)), {
      status: 201,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putAgentEntry(request: Request, ctx: EntryContext): Promise<NextResponse> {
  const parsed = await parseBody(request, AgentEntryInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    const { entryId } = await ctx.params;
    return NextResponse.json(
      toAgentEntryDto(await services.updateAgentEntry(entryId, parsed.data))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteAgentEntry(
  _request: Request,
  ctx: EntryContext
): Promise<NextResponse> {
  try {
    const { entryId } = await ctx.params;
    await services.removeAgentEntry(entryId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}
