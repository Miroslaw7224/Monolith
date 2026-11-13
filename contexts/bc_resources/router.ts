import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { parseUploadFormFile } from "@/lib/http/uploadFormFile";
import {
  CreateResourceBodySchema,
  UpdateResourceBodySchema,
  toDocumentDto,
  toResourceDto,
} from "./schemas";
import * as services from "./services";

type ResourceContext = { params: Promise<{ resourceId: string }> };
type DocumentContext = { params: Promise<{ id: string }> };

// ── zasoby ──────────────────────────────────────────────────────────────────────

export async function listResources(): Promise<NextResponse> {
  try {
    const resources = await services.getResources();
    return NextResponse.json(resources.map(toResourceDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createResource(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateResourceBodySchema);
  if (parsed.success === false) {
    return parsed.response;
  }
  const { description, url, tags } = parsed.data;
  try {
    const resource = await services.addResource({
      description: description.trim(),
      url: url.trim(),
      tags: tags ?? [],
    });
    return NextResponse.json(toResourceDto(resource), { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateResource(
  request: NextRequest,
  ctx: ResourceContext
): Promise<NextResponse> {
  const { resourceId } = await ctx.params;

  const parsed = await parseBody(request, UpdateResourceBodySchema);
  if (parsed.success === false) return parsed.response;
  const { title, description, url, tags, isFavorite } = parsed.data;
  const data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  } = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();
  if (url !== undefined) data.url = url.trim();
  if (tags !== undefined) data.tags = tags;
  if (isFavorite !== undefined) data.isFavorite = isFavorite;

  try {
    await services.updateResource(resourceId, data);
    const resources = await services.getResources();
    const updated = resources.find((r) => r.id === resourceId);
    return NextResponse.json(updated ? toResourceDto(updated) : { success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteResource(
  _request: NextRequest,
  ctx: ResourceContext
): Promise<NextResponse> {
  const { resourceId } = await ctx.params;
  try {
    await services.deleteResource(resourceId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}

// ── dokumenty i upload ──────────────────────────────────────────────────────────

export async function listDocuments(): Promise<NextResponse> {
  try {
    const docs = await services.listDocuments();
    return NextResponse.json(docs.map(toDocumentDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteDocument(
  _request: NextRequest,
  ctx: DocumentContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function uploadDocument(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const parsed = await parseUploadFormFile(formData);
  if (parsed.ok === false) {
    return parsed.response;
  }
  const { name, type, content } = parsed;
  try {
    const result = await services.ingestDocument({ name, content, type });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
