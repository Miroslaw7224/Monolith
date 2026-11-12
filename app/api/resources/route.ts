import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateResourceBodySchema } from "@/lib/validation/resources";
import * as resourceService from "@/services/resourceService";

export async function GET(request: NextRequest) {
  try {
    const resources = await resourceService.getResources();
    return NextResponse.json(resources);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateResourceBodySchema);
  if (parsed.success === false) {
    return parsed.response;
  }
  const { description, url, tags } = parsed.data;
  try {
    const resource = await resourceService.addResource({
      description: description.trim(),
      url: url.trim(),
      tags: tags ?? [],
    });
    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
