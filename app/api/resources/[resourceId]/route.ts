import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { UpdateResourceBodySchema } from "@/lib/validation/resources";
import * as resourceService from "@/services/resourceService";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const { resourceId } = await params;

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
    await resourceService.updateResource(auth.uid, resourceId, data);
    const resources = await resourceService.getResources(auth.uid);
    const updated = resources.find((r) => r.id === resourceId);
    return NextResponse.json(updated ?? { success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const auth = await getAuthUserId(_request);
  if (auth instanceof NextResponse) return auth;
  const { resourceId } = await params;
  try {
    await resourceService.deleteResource(auth.uid, resourceId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}
